<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['DELETE']);
$user = require_user_auth();
if (($user['role'] ?? null) !== 'admin') {
    json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
}

$data = read_json_input();
$id = $data['id'] ?? null;

if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', [], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('DELETE FROM pharmacies_on_duty WHERE id = :id');
$stmt->execute([':id' => (int)$id]);

if ($stmt->rowCount() === 0) {
    json_error('NOT_FOUND', 'Farmacia no encontrada.', [], 404);
}

json_success(['message' => 'Farmacia eliminada.']);
