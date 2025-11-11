<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID de categoría inválido.', ['id' => 'Debe ser entero.'], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id, name, slug, description FROM categories WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$category = $stmt->fetch();

if (!$category) {
    json_error('NOT_FOUND', 'Categoría no encontrada.', [], 404);
}

json_success(['category' => $category]);

