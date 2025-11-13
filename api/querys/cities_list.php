<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();

$params = [];
$conditions = ['1=1'];

$q = trim((string)get_query_param('q', ''));
if ($q !== '') {
    $conditions[] = '(name LIKE :q OR state LIKE :q)';
    $params[':q'] = '%' . $q . '%';
}

$state = trim((string)get_query_param('state', ''));
if ($state !== '') {
    $conditions[] = 'state = :state';
    $params[':state'] = $state;
}

[$limit, $offset, $page] = parse_pagination();

$countSql = 'SELECT COUNT(*) FROM cities WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$sql = 'SELECT id, name, slug, state, created_at, updated_at '
    . 'FROM cities WHERE ' . implode(' AND ', $conditions)
    . ' ORDER BY name ASC LIMIT :limit OFFSET :offset';

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
