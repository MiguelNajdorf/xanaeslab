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

$q = get_query_param('q');
if ($q !== null && trim($q) !== '') {
    $where[] = 'name LIKE :q';
    $params[':q'] = '%' . trim($q) . '%';
}

$whereSql = '';
if (!empty($where)) {
    $whereSql = 'WHERE ' . implode(' AND ', $where);
}

// Contar total
$stmt = $pdo->prepare("SELECT COUNT(*) FROM neighborhoods $whereSql");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// Obtener resultados
$sql = "SELECT * FROM neighborhoods $whereSql ORDER BY city ASC, name ASC LIMIT $limit OFFSET $offset";
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
