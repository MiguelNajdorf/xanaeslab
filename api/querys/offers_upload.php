<?php

declare(strict_types=1);

// Enable error reporting for debugging
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

try {
    // Require POST method
    require_http_method(['POST']);
    
    // Require authentication
    require_user_auth();
    
    $pdo = get_pdo();
    
    // Validate supermarket_id
    $supermarketId = $_POST['supermarket_id'] ?? null;
    if (!$supermarketId || !ctype_digit((string)$supermarketId)) {
        json_error('VALIDATION_ERROR', 'supermarket_id es requerido y debe ser un número.', [], 400);
    }
    $supermarketId = (int)$supermarketId;
    
    // Validate file upload
    if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
        $errorMsg = 'No se recibió ningún archivo o hubo un error en la subida.';
        if (isset($_FILES['image']['error'])) {
            $errorMsg .= ' Error code: ' . $_FILES['image']['error'];
        }
        json_error('UPLOAD_ERROR', $errorMsg, [], 400);
    }
    
    $file = $_FILES['image'];
    
    // Validate file type
    $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes, true)) {
        json_error('VALIDATION_ERROR', 'Tipo de archivo no permitido. Solo JPG, PNG, WebP.', [], 400);
    }
    
    // Validate file size (max 10MB)
    if ($file['size'] > 10 * 1024 * 1024) {
        json_error('VALIDATION_ERROR', 'El archivo es demasiado grande. Máximo 10MB.', [], 400);
    }
    
    // Create upload directory if it doesn't exist
    $uploadDir = __DIR__ . '/../uploads/offers/';
    if (!is_dir($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            json_error('SERVER_ERROR', 'No se pudo crear el directorio de uploads.', [], 500);
        }
    }
    
    // Generate unique filename
    $extension = 'jpg';
    switch($mimeType) {
        case 'image/jpeg':
            $extension = 'jpg';
            break;
        case 'image/png':
            $extension = 'png';
            break;
        case 'image/webp':
            $extension = 'webp';
            break;
    }
    
    $filename = sprintf(
        'offer_%d_%s.%s',
        $supermarketId,
        date('YmdHis') . '_' . bin2hex(random_bytes(4)),
        $extension
    );
    
    $destination = $uploadDir . $filename;
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $destination)) {
        json_error('SERVER_ERROR', 'Error al guardar la imagen.', [], 500);
    }
    
    // Relative path for DB
    $dbPath = 'uploads/offers/' . $filename;
    
    try {
        $stmt = $pdo->prepare('INSERT INTO offers (supermarket_id, image_path, status) VALUES (:sid, :path, "pending")');
        $stmt->execute([
            ':sid' => $supermarketId,
            ':path' => $dbPath
        ]);
        
        $offerId = (int)$pdo->lastInsertId();
        
        json_success([
            'id' => $offerId,
            'image_path' => $dbPath,
            'message' => 'Oferta subida correctamente. Procesamiento pendiente.',
            'status' => 'pending'
        ]);
        
    } catch (PDOException $e) {
        // Clean up file if DB insert fails
        if (file_exists($destination)) {
            unlink($destination);
        }
        json_error('DATABASE_ERROR', 'Error de base de datos: ' . $e->getMessage(), [], 500);
    }
    
} catch (Throwable $e) {
    // Clean up file if it was created but script failed
    if (isset($destination) && file_exists($destination)) {
        @unlink($destination);
    }
    
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => [
            'code' => 'INTERNAL_ERROR',
            'message' => 'Error fatal: ' . $e->getMessage(),
            'details' => [
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]
        ]
    ]);
    exit;
}
