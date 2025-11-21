<?php

declare(strict_types=1);

// Enable error reporting for debugging
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

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
