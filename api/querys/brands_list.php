<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

[$limit, $offset, $page] = parse_pagination();

$pdo = get_pdo();

// Filtros
$where = [];
$params = [];

$q = get_query_param('q');
if ($q !== null && trim($q) !== '') {
    $where[] = '(name LIKE :q OR slug LIKE :q)';
    $params[':q'] = '%' . trim($q) . '%';
}

$whereSql = '';
if (!empty($where)) {
    $whereSql = 'WHERE ' . implode(' AND ', $where);
}

// Contar total
$stmt = $pdo->prepare("SELECT COUNT(*) FROM brands $whereSql");
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// Obtener resultados
$sql = "SELECT * FROM brands $whereSql ORDER BY name ASC LIMIT $limit OFFSET $offset";
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
