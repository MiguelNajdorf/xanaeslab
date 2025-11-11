<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
require_admin();

$data = read_json_input();
validate_required($data, [
    'supermarket_id' => 'int',
    'product_id' => 'int',
    'price' => 'float',
    'currency' => 'string',
]);

$supermarketId = (int)$data['supermarket_id'];
$productId = (int)$data['product_id'];
$price = decimal_value($data['price']);
$currency = strtoupper(substr(trim((string)$data['currency']), 0, 3));
if (strlen($currency) !== 3) {
    send_validation_error(['currency' => 'Debe tener 3 caracteres.']);
}

$stockStatus = $data['stock_status'] ?? 'unknown';
$allowedStatuses = ['in_stock', 'out_of_stock', 'unknown'];
if (!in_array($stockStatus, $allowedStatuses, true)) {
    send_validation_error(['stock_status' => 'Valor inválido.']);
}

$pdo = get_pdo();

$stmt = $pdo->prepare('SELECT id FROM supermarkets WHERE id = :id');
$stmt->execute([':id' => $supermarketId]);
if (!$stmt->fetch()) {
    json_error('VALIDATION_ERROR', 'Supermercado inválido.', ['supermarket_id' => 'No existe.'], 422);
}

$stmt = $pdo->prepare('SELECT id FROM products WHERE id = :id');
$stmt->execute([':id' => $productId]);
if (!$stmt->fetch()) {
    json_error('VALIDATION_ERROR', 'Producto inválido.', ['product_id' => 'No existe.'], 422);
}

$sql = 'INSERT INTO store_products (supermarket_id, product_id, price, currency, promo_label, stock_status, updated_at) '
    . 'VALUES (:supermarket_id, :product_id, :price, :currency, :promo_label, :stock_status, NOW()) '
    . 'ON DUPLICATE KEY UPDATE price = VALUES(price), currency = VALUES(currency), promo_label = VALUES(promo_label), '
    . 'stock_status = VALUES(stock_status), updated_at = NOW()';
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':supermarket_id' => $supermarketId,
    ':product_id' => $productId,
    ':price' => $price,
    ':currency' => $currency,
    ':promo_label' => isset($data['promo_label']) && $data['promo_label'] !== null ? trim((string)$data['promo_label']) : null,
    ':stock_status' => $stockStatus,
]);

$stmt = $pdo->prepare('SELECT sp.supermarket_id, sp.product_id, sp.price, sp.currency, sp.promo_label, sp.stock_status, sp.updated_at, '
    . 's.name AS supermarket_name, p.name AS product_name '
    . 'FROM store_products sp '
    . 'JOIN supermarkets s ON s.id = sp.supermarket_id '
    . 'JOIN products p ON p.id = sp.product_id '
    . 'WHERE sp.supermarket_id = :supermarket_id AND sp.product_id = :product_id');
$stmt->execute([':supermarket_id' => $supermarketId, ':product_id' => $productId]);
$record = $stmt->fetch();

json_success(['store_product' => $record]);

