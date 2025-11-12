<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['DELETE']);
require_admin();

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', ['id' => 'Debe ser entero.'], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id FROM products WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
if (!$stmt->fetch()) {
    json_error('NOT_FOUND', 'Producto no encontrado.', [], 404);
}

$stmt = $pdo->prepare('SELECT COUNT(*) FROM store_products WHERE product_id = :id');
$stmt->execute([':id' => (int)$id]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'El producto tiene precios asociados.', ['product' => 'No se puede eliminar.'], 422);
}

$stmt = $pdo->prepare('SELECT COUNT(*) FROM cart_items WHERE product_id = :id');
$stmt->execute([':id' => (int)$id]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'El producto está en carritos.', ['product' => 'No se puede eliminar.'], 422);
}

$stmt = $pdo->prepare('DELETE FROM products WHERE id = :id');
$stmt->execute([':id' => (int)$id]);

json_success(['deleted' => true]);

