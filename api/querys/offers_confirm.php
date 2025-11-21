<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
require_admin();

$data = read_json_input();
$id = (int)($data['id'] ?? 0);
$status = $data['status'] ?? '';

if ($id <= 0) {
    json_error('ID inválido', 400);
}

$allowedStatuses = ['pending', 'processing', 'ready', 'error', 'completed'];
if (!in_array($status, $allowedStatuses)) {
    json_error('Estado inválido', 400);
}

$pdo = get_pdo();

// Check if offer exists
$stmt = $pdo->prepare('SELECT id FROM offers WHERE id = :id');
$stmt->execute([':id' => $id]);
if (!$stmt->fetch()) {
    json_error('Oferta no encontrada', 404);
}

// Update status
$stmt = $pdo->prepare('UPDATE offers SET status = :status WHERE id = :id');
$stmt->execute([
    ':status' => $status,
    ':id' => $id
]);

json_success(['message' => 'Estado de oferta actualizado correctamente']);
