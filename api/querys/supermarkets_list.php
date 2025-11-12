<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['GET']);

$pdo = get_pdo();

$params = [];
$conditions = ['1=1'];

$q = trim((string)(get_query_param('q', '')));
if ($q !== '') {
    $conditions[] = '(name LIKE :q OR city LIKE :q OR state LIKE :q)';
    $params[':q'] = '%' . $q . '%';
}

$isActiveParam = get_query_param('is_active');
$boolActive = boolval_from_param($isActiveParam);
if ($boolActive !== null) {
    $conditions[] = 'is_active = :is_active';
    $params[':is_active'] = $boolActive ? 1 : 0;
}

[$limit, $offset, $page] = parse_pagination();

$countSql = 'SELECT COUNT(*) FROM supermarkets WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$order = strtolower((string)get_query_param('order', 'name'));
$orderColumn = 'name';
if ($order === 'created_at') {
    $orderColumn = 'created_at';
}
$orderDir = strtolower((string)get_query_param('dir', 'asc')) === 'desc' ? 'DESC' : 'ASC';

$sql = 'SELECT id, name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at '
    . 'FROM supermarkets WHERE ' . implode(' AND ', $conditions)
    . " ORDER BY $orderColumn $orderDir LIMIT :limit OFFSET :offset";

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

