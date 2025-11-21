<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();

$city = get_query_param('city');
$limit = (int)get_query_param('limit', '100');
$offset = (int)get_query_param('offset', '0');

// Build query
$where = [];
$params = [];

if ($city !== null && trim($city) !== '') {
    $where[] = 'p.city = :city';
    $params[':city'] = trim($city);
}

$whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

$sql = "SELECT p.*, n.name as neighborhood_name 
        FROM pharmacies p 
        LEFT JOIN neighborhoods n ON p.neighborhood_id = n.id 
        $whereClause
        ORDER BY p.city, p.name
        LIMIT :limit OFFSET :offset";

$stmt = $pdo->prepare($sql);
foreach ($params as $key => $value) {
    $stmt->bindValue($key, $value);
}
$stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
$stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
$stmt->execute();

$items = $stmt->fetchAll();

// Get total count
$countSql = "SELECT COUNT(*) FROM pharmacies p $whereClause";
$countStmt = $pdo->prepare($countSql);
foreach ($params as $key => $value) {
    $countStmt->bindValue($key, $value);
}
$countStmt->execute();
$total = (int)$countStmt->fetchColumn();

json_success([
    'items' => $items,
    'total' => $total,
    'limit' => $limit,
    'offset' => $offset,
]);
