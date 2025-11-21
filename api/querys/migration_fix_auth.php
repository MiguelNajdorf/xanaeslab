<?php
declare(strict_types=1);

ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo = get_pdo();
    
    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM refresh_tokens LIKE 'revoked_at'");
    if ($stmt->fetch()) {
        echo json_encode(['status' => 'success', 'message' => 'Column revoked_at already exists']);
        exit;
    }

    // Add column
    $pdo->exec("ALTER TABLE refresh_tokens ADD COLUMN revoked_at DATETIME NULL AFTER expires_at");
    
    echo json_encode(['status' => 'success', 'message' => 'Column revoked_at added successfully']);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error', 
        'message' => $e->getMessage()
    ]);
}
