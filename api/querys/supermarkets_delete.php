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
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', ['id' => 'Debe ser entero.'], 422);
}

$data = read_json_input();
$force = isset($data['force']) ? (bool)$data['force'] : false;

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id FROM supermarkets WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
if (!$stmt->fetch()) {
    json_error('NOT_FOUND', 'Supermercado no encontrado.', [], 404);
}

if ($force) {
    $stmt = $pdo->prepare('DELETE FROM supermarkets WHERE id = :id');
    $stmt->execute([':id' => (int)$id]);
    json_success(['deleted' => true]);
}

$stmt = $pdo->prepare('UPDATE supermarkets SET is_active = 0, updated_at = NOW() WHERE id = :id');
$stmt->execute([':id' => (int)$id]);

json_success(['deleted' => false, 'is_active' => false]);

