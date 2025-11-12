<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();
$params = [];
$conditions = ['1=1'];

if (($supermarketId = get_query_param('supermarket_id')) !== null) {
    if (!ctype_digit((string)$supermarketId)) {
        json_error('VALIDATION_ERROR', 'supermarket_id inválido.', [], 422);
    }
    $conditions[] = 'sp.supermarket_id = :supermarket_id';
    $params[':supermarket_id'] = (int)$supermarketId;
}

if (($productId = get_query_param('product_id')) !== null) {
    if (!ctype_digit((string)$productId)) {
        json_error('VALIDATION_ERROR', 'product_id inválido.', [], 422);
    }
    $conditions[] = 'sp.product_id = :product_id';
    $params[':product_id'] = (int)$productId;
}

if (($minPrice = get_query_param('min_price')) !== null) {
    if (!is_numeric($minPrice)) {
        json_error('VALIDATION_ERROR', 'min_price inválido.', [], 422);
    }
    $conditions[] = 'sp.price >= :min_price';
    $params[':min_price'] = decimal_value($minPrice);
}

if (($maxPrice = get_query_param('max_price')) !== null) {
    if (!is_numeric($maxPrice)) {
        json_error('VALIDATION_ERROR', 'max_price inválido.', [], 422);
    }
    $conditions[] = 'sp.price <= :max_price';
    $params[':max_price'] = decimal_value($maxPrice);
}

if (($updatedSince = get_query_param('updated_since')) !== null) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/', $updatedSince)) {
        json_error('VALIDATION_ERROR', 'updated_since debe tener formato YYYY-MM-DD HH:MM:SS.', [], 422);
    }
    $conditions[] = 'sp.updated_at >= :updated_since';
    $params[':updated_since'] = $updatedSince;
}

[$limit, $offset, $page] = parse_pagination();

$countSql = 'SELECT COUNT(*) FROM store_products sp WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$sql = 'SELECT sp.supermarket_id, sp.product_id, sp.price, sp.currency, sp.promo_label, sp.stock_status, sp.updated_at, '
    . 's.name AS supermarket_name, p.name AS product_name '
    . 'FROM store_products sp '
    . 'JOIN supermarkets s ON s.id = sp.supermarket_id '
    . 'JOIN products p ON p.id = sp.product_id '
    . 'WHERE ' . implode(' AND ', $conditions)
    . ' ORDER BY sp.updated_at DESC LIMIT :limit OFFSET :offset';
$stmt = $pdo->prepare($sql);
foreach ($params as $key => $value) {
    $stmt->bindValue($key, $value);
}
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();
$items = $stmt->fetchAll();

json_success([
    'items' => $items,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'total_pages' => $limit > 0 ? (int)ceil($total / $limit) : 0,
    ],
]);

