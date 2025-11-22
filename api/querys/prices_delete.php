<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['DELETE']);
$user = require_user_auth();
if (($user['role'] ?? null) !== 'admin') {
    json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
}

$id = get_query_param('id');
if ($id === null) {
    $data = read_json_input();
    $id = $data['id'] ?? null;
}

if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', ['id' => 'Debe ser entero.'], 422);
}

$pdo = get_pdo();

// Check if price exists
$stmt = $pdo->prepare('SELECT id FROM prices WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
if (!$stmt->fetch()) {
    json_error('NOT_FOUND', 'Precio no encontrado.', [], 404);
}

// Delete
$stmt = $pdo->prepare('DELETE FROM prices WHERE id = :id');
$stmt->execute([':id' => (int)$id]);

json_success(['message' => 'Precio eliminado correctamente.']);
