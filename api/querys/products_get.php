<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', ['id' => 'Debe ser entero.'], 422);
}

$pdo = get_pdo();
$sql = 'SELECT p.id, p.name, p.brand, p.barcode, p.unit, p.size, p.category_id, p.created_at, p.updated_at, '
    . 'c.name AS category_name, c.slug AS category_slug '
    . 'FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute([':id' => (int)$id]);
$product = $stmt->fetch();

if (!$product) {
    json_error('NOT_FOUND', 'Producto no encontrado.', [], 404);
}

json_success(['product' => $product]);

