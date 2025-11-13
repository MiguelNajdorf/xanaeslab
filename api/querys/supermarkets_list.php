<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();

$params = [];
$conditions = ['1=1'];

$joins = 'FROM supermarkets s INNER JOIN cities c ON c.id = s.city_id';

$q = trim((string)get_query_param('q', ''));
if ($q !== '') {
    $conditions[] = '(s.name LIKE :q OR c.name LIKE :q OR c.state LIKE :q OR s.address LIKE :q)';
    $params[':q'] = '%' . $q . '%';
}

$isActiveParam = get_query_param('is_active');
$boolActive = boolval_from_param($isActiveParam);
if ($boolActive !== null) {
    $conditions[] = 's.is_active = :is_active';
    $params[':is_active'] = $boolActive ? 1 : 0;
}

$city = trim((string)get_query_param('city', ''));
if ($city !== '') {
    $conditions[] = 's.city = :city';
    $params[':city'] = $city;
}

$cityId = get_query_param('city_id');
if ($cityId !== null && $cityId !== '') {
    if (!ctype_digit((string)$cityId)) {
        json_error('VALIDATION_ERROR', 'city_id inválido.', ['city_id' => 'Debe ser un entero.'], 422);
    }
    $conditions[] = 's.city_id = :city_id';
    $params[':city_id'] = (int)$cityId;
}

$citySlug = trim((string)get_query_param('city_slug', ''));
if ($citySlug !== '') {
    $conditions[] = 'c.slug = :city_slug';
    $params[':city_slug'] = $citySlug;
}

$state = trim((string)get_query_param('state', ''));
if ($state !== '') {
    $conditions[] = 's.state = :state';
    $params[':state'] = $state;
}

[$limit, $offset, $page] = parse_pagination();

$countSql = 'SELECT COUNT(*) ' . $joins . ' WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$orderRaw = (string)get_query_param('order', 'name');
$orderDir = strtolower((string)get_query_param('dir', '')) === 'desc' ? 'DESC' : 'ASC';
if (strlen($orderRaw) > 0 && $orderRaw[0] === '-') {
    $orderDir = 'DESC';
    $orderRaw = substr($orderRaw, 1);
}
$order = strtolower($orderRaw);
$allowedOrderColumns = [
    'name' => 's.name',
    'created_at' => 's.created_at',
    'updated_at' => 's.updated_at',
    'city' => 'c.name',
];
$orderColumn = $allowedOrderColumns[$order] ?? 's.name';

$sql = 'SELECT s.id, s.city_id, c.slug AS city_slug, c.name AS city_name, c.state AS city_state, '
    . 's.name, s.slug, s.address, s.city, s.state, s.zip, s.phone, s.website, s.is_active, s.created_at, s.updated_at '
    . $joins . ' WHERE ' . implode(' AND ', $conditions)
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

