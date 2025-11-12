<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$supermarketId = get_query_param('supermarket_id');
$productId = get_query_param('product_id');
if ($supermarketId === null || !ctype_digit((string)$supermarketId) || $productId === null || !ctype_digit((string)$productId)) {
    json_error('VALIDATION_ERROR', 'Parámetros inválidos.', ['supermarket_id' => 'Requerido', 'product_id' => 'Requerido'], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT sp.supermarket_id, sp.product_id, sp.price, sp.currency, sp.promo_label, sp.stock_status, sp.updated_at, '
    . 's.name AS supermarket_name, p.name AS product_name '
    . 'FROM store_products sp '
    . 'JOIN supermarkets s ON s.id = sp.supermarket_id '
    . 'JOIN products p ON p.id = sp.product_id '
    . 'WHERE sp.supermarket_id = :supermarket_id AND sp.product_id = :product_id');
$stmt->execute([':supermarket_id' => (int)$supermarketId, ':product_id' => (int)$productId]);
$record = $stmt->fetch();

if (!$record) {
    json_error('NOT_FOUND', 'Precio no encontrado.', [], 404);
}

json_success(['store_product' => $record]);

