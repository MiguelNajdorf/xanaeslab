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

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id FROM categories WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
if (!$stmt->fetch()) {
    json_error('NOT_FOUND', 'Categoría no encontrada.', [], 404);
}

$stmt = $pdo->prepare('SELECT COUNT(*) FROM products WHERE category_id = :id');
$stmt->execute([':id' => (int)$id]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'La categoría tiene productos asociados.', ['category' => 'No se puede eliminar.'], 422);
}

$stmt = $pdo->prepare('DELETE FROM categories WHERE id = :id');
$stmt->execute([':id' => (int)$id]);

json_success(['deleted' => true]);

