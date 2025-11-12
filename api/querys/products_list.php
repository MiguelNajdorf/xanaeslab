<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();
$params = [];
$conditions = ['1=1'];

$q = trim((string)get_query_param('q', ''));
if ($q !== '') {
    $conditions[] = '(p.name LIKE :q OR p.brand LIKE :q OR p.barcode LIKE :q)';
    $params[':q'] = '%' . $q . '%';
}

$categoryId = get_query_param('category_id');
if ($categoryId !== null) {
    if (!ctype_digit((string)$categoryId)) {
        json_error('VALIDATION_ERROR', 'category_id inválido.', ['category_id' => 'Debe ser entero.'], 422);
    }
    $conditions[] = 'p.category_id = :category_id';
    $params[':category_id'] = (int)$categoryId;
}

$barcode = trim((string)get_query_param('barcode', ''));
if ($barcode !== '') {
    $conditions[] = 'p.barcode = :barcode';
    $params[':barcode'] = $barcode;
}

[$limit, $offset, $page] = parse_pagination();

$countSql = 'SELECT COUNT(*) FROM products p WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

$sql = 'SELECT p.id, p.name, p.brand, p.barcode, p.unit, p.size, p.category_id, p.created_at, p.updated_at, '
    . 'c.name AS category_name, c.slug AS category_slug '
    . 'FROM products p LEFT JOIN categories c ON c.id = p.category_id '
    . 'WHERE ' . implode(' AND ', $conditions)
    . ' ORDER BY p.name ASC LIMIT :limit OFFSET :offset';
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

