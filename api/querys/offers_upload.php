<?php

declare(strict_types=1);

// Enable error reporting for debugging
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

try {
    require_http_method(['POST']);
    require_admin();

// Check if file was uploaded
if (!isset($_FILES['image']) || $_FILES['image']['error'] === UPLOAD_ERR_NO_FILE) {
    json_error('No se ha subido ninguna imagen', 400);
}

$supermarketId = (int)($_POST['supermarket_id'] ?? 0);
if ($supermarketId <= 0) {
    json_error('ID de supermercado inválido', 400);
}

// Validate supermarket exists
$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id FROM supermarkets WHERE id = :id');
$stmt->execute([':id' => $supermarketId]);
if (!$stmt->fetch()) {
    json_error('El supermercado especificado no existe', 404);
}

$file = $_FILES['image'];
$allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
$maxSize = 10 * 1024 * 1024; // 10MB

// Validate file type
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeType = $finfo->file($file['tmp_name']);

if (!in_array($mimeType, $allowedTypes)) {
    json_error('Tipo de archivo no permitido. Solo JPG, PNG y WebP.', 400);
}

// Validate file size
if ($file['size'] > $maxSize) {
    json_error('El archivo es demasiado grande. Máximo 10MB.', 400);
}

// Create upload directory if not exists
$uploadDir = __DIR__ . '/../uploads/offers/';
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        json_error('Error interno: No se pudo crear el directorio de subida', 500);
    }
}

// Generate unique filename
$extension = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = $supermarketId . '_' . uniqid() . '.' . $extension;
$destination = $uploadDir . $filename;

// Move uploaded file
if (!move_uploaded_file($file['tmp_name'], $destination)) {
    json_error('Error al guardar la imagen', 500);
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
    
    // TODO: Queue job for processing
    
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
    json_error('Error de base de datos: ' . $e->getMessage(), 500);
}

} catch (Throwable $e) {
    // Clean up file if it was created but script failed
    if (isset($destination) && file_exists($destination)) {
        @unlink($destination);
    }
    
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Error fatal: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    exit;
}
