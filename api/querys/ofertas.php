<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();
$params = [];
$conditions = ['1=1'];

// Parámetro de vigencia (para store_products, asumimos que todos son vigentes)
if (($vigentes = get_query_param('vigentes')) !== null) {
    if (!in_array($vigentes, ['0', '1'], true)) {
        json_error('VALIDATION_ERROR', 'vigentes debe ser 0 o 1.', [], 422);
    }
    // En store_products no hay campo de vigencia, así que no filtramos por vigencia
}

// Parámetro de supermercado
if (($supermarketId = get_query_param('supermercado_id')) !== null) {
    if (!ctype_digit((string)$supermarketId)) {
        json_error('VALIDATION_ERROR', 'supermercado_id inválido.', [], 422);
    }
    $conditions[] = 'sp.supermarket_id = :supermarket_id';
    $params[':supermarket_id'] = (int)$supermarketId;
}

// Parámetro de producto
if (($productId = get_query_param('producto_id')) !== null) {
    if (!ctype_digit((string)$productId)) {
        json_error('VALIDATION_ERROR', 'producto_id inválido.', [], 422);
    }
    $conditions[] = 'sp.product_id = :producto_id';
    $params[':producto_id'] = (int)$productId;
}

// Parámetro de ciudad
if (($ciudad = get_query_param('ciudad')) !== null) {
    if (empty(trim($ciudad))) {
        json_error('VALIDATION_ERROR', 'ciudad no puede estar vacía.', [], 422);
    }
    $conditions[] = 's.city = :ciudad';
    $params[':ciudad'] = trim($ciudad);
}

// Parámetros de precio
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

// Parámetros de fecha
if (($updatedSince = get_query_param('updated_since')) !== null) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/', $updatedSince)) {
        json_error('VALIDATION_ERROR', 'updated_since debe tener formato YYYY-MM-DD HH:MM:SS.', [], 422);
    }
    $conditions[] = 'sp.updated_at >= :updated_since';
    $params[':updated_since'] = $updatedSince;
}

[$limit, $offset, $page] = parse_pagination();

// Contar total de ofertas
$countSql = 'SELECT COUNT(*) FROM prices sp WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// Consulta principal de ofertas
$sql = 'SELECT sp.id, sp.supermarket_id, sp.product_id, sp.price AS precio_individual, NULL AS precio_por_base, '
    . 'NULL AS precio_efectivo, NULL AS precio_por_base_efectivo, NULL AS promo_tipo, NULL AS promo_param, '
    . 'NULL AS promo_condicion, NULL AS min_cantidad_para_promo, NULL AS cantidad_base, NULL AS cantidad_base_normalizada, '
    . 'NULL AS unidad_base, NULL AS vigencia_desde, NULL AS vigencia_hasta, NULL AS imagen_url, '
    . 's.city AS ciudad, s.name AS supermercado, p.name AS producto, p.brand AS marca, p.size AS presentacion, '
    . 'c.name AS categoria, sp.updated_at, sp.updated_at AS created_at, sp.promo_label, sp.stock_status, sp.currency '
    . 'FROM prices sp '
    . 'JOIN supermarkets s ON s.id = sp.supermarket_id '
    . 'JOIN products p ON p.id = sp.product_id '
    . 'LEFT JOIN categories c ON c.id = p.category_id '
    . 'WHERE ' . implode(' AND ', $conditions)
    . ' ORDER BY sp.updated_at DESC, sp.price ASC LIMIT :limit OFFSET :offset';

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