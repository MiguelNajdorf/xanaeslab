<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$params = [];
$conditions = ['1=1'];

// Filter by supermarket
$supermarketId = get_query_param('supermarket_id', '');
if ($supermarketId !== '') {
    $conditions[] = 'p.supermarket_id = :supermarket_id';
    $params[':supermarket_id'] = (int)$supermarketId;
}

// Filter by product
$productId = get_query_param('product_id', '');
if ($productId !== '') {
    $conditions[] = 'p.product_id = :product_id';
    $params[':product_id'] = (int)$productId;
}

// Filter by promo type
$promoTypeId = get_query_param('promo_type_id', '');
if ($promoTypeId !== '') {
    $conditions[] = 'p.promo_type_id = :promo_type_id';
    $params[':promo_type_id'] = (int)$promoTypeId;
}

// Filter by active only (default: true)
$activeOnly = get_query_param('active_only', '1');
$date = get_query_param('date', '');

if ($activeOnly === '1') {
    $checkDate = $date !== '' ? $date : date('Y-m-d');
    $conditions[] = 'p.valid_from <= :check_date';
    $conditions[] = '(p.valid_to IS NULL OR p.valid_to >= :check_date)';
    $params[':check_date'] = $checkDate;
}

// Pagination
[$limit, $offset, $page] = parse_pagination();

$pdo = get_pdo();

// Count total
$countSql = 'SELECT COUNT(*) FROM prices p WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// Fetch data with JOINs
$sql = 'SELECT 
            p.id,
            p.supermarket_id,
            s.name AS supermarket_name,
            p.product_id,
            CONCAT(pr.name, " - ", pr.brand, " - ", pr.size) AS product_name,
            p.price,
            p.currency,
            p.valid_from,
            p.valid_to,
            p.promo_type_id,
            pt.name AS promo_type_name,
            p.created_at,
            p.updated_at,
            CASE 
                WHEN p.valid_from <= CURDATE() AND (p.valid_to IS NULL OR p.valid_to >= CURDATE())
                THEN 1 
                ELSE 0 
            END AS is_active
        FROM prices p
        INNER JOIN supermarkets s ON p.supermarket_id = s.id
        INNER JOIN products pr ON p.product_id = pr.id
        LEFT JOIN promo_types pt ON p.promo_type_id = pt.id
        WHERE ' . implode(' AND ', $conditions) . '
        ORDER BY p.valid_from DESC, p.created_at DESC
        LIMIT :limit OFFSET :offset';

$stmt = $pdo->prepare($sql);
foreach ($params as $key => $value) {
    $stmt->bindValue($key, $value);
}
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();

$items = $stmt->fetchAll();

// Convert is_active to boolean
foreach ($items as &$item) {
    $item['is_active'] = (bool)$item['is_active'];
}

json_success([
    'items' => $items,
    'pagination' => [
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => (int)ceil($total / $limit),
    ],
]);
