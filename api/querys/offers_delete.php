<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['DELETE', 'POST']);
require_admin();

$data = read_json_input();
$id = (int)($data['id'] ?? 0);

if ($id <= 0) {
    json_error('ID inválido', 400);
}

$pdo = get_pdo();

// Fetch offer to get image path
$stmt = $pdo->prepare('SELECT image_path FROM offers WHERE id = :id');
$stmt->execute([':id' => $id]);
$offer = $stmt->fetch();

if (!$offer) {
    json_error('Oferta no encontrada', 404);
}

try {
    // Delete from database (this will cascade to parsed_offers)
    $stmt = $pdo->prepare('DELETE FROM offers WHERE id = :id');
    $stmt->execute([':id' => $id]);

    // Delete physical file
    $imagePath = __DIR__ . '/../uploads/' . $offer['image_path'];
    if (file_exists($imagePath)) {
        @unlink($imagePath);
    }

    json_success(['message' => 'Oferta eliminada correctamente']);

} catch (PDOException $e) {
    json_error('Error al eliminar oferta: ' . $e->getMessage(), 500);
}
