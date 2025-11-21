<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

[$limit, $offset, $page] = parse_pagination();

$pdo = get_pdo();

// Filtros
$where = [];
$params = [];

$city = get_query_param('city');
if ($city !== null && trim($city) !== '') {
    $where[] = 'city = :city';
    $params[':city'] = trim($city);
}

$date = get_query_param('date');
if ($date !== null && trim($date) !== '') {
    $where[] = 'date = :date';
    $params[':date'] = trim($date);
}

$dateFrom = get_query_param('date_from');
if ($dateFrom !== null && trim($dateFrom) !== '') {
    $where[] = 'date >= :date_from';
    $params[':date_from'] = trim($dateFrom);
}

$dateTo = get_query_param('date_to');
if ($dateTo !== null && trim($dateTo) !== '') {
    $where[] = 'date <= :date_to';
    $params[':date_to'] = trim($dateTo);
}

$whereSql = '';
if (!empty($where)) {
    $whereSql = 'WHERE ' . implode(' AND ', $where);
}

// Contar total
$stmt = $pdo->prepare("SELECT COUNT(*) FROM pharmacies_on_duty $whereSql");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// Obtener resultados
$sql = "SELECT p.*, n.name as neighborhood_name 
        FROM pharmacies_on_duty p 
        LEFT JOIN neighborhoods n ON p.neighborhood_id = n.id 
        $whereSql 
        ORDER BY p.date DESC, p.city ASC, p.name ASC 
        LIMIT $limit OFFSET $offset";
$stmt = $pdo->prepare($sql);
foreach ($params as $key => $val) {
    $stmt->bindValue($key, $val);
}
$stmt->execute();
$items = $stmt->fetchAll();

json_success([
    'items' => $items,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total' => $total,
        'pages' => ceil($total / $limit),
    ],
]);
