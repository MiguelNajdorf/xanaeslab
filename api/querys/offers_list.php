<?php

declare(strict_types=1);

// Enable error reporting for debugging
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

try {
    require_http_method(['GET']);
    require_admin();

$params = [];
$conditions = ['1=1'];

// Filter by supermarket
$supermarketId = get_query_param('supermarket_id', '');
if ($supermarketId !== '') {
    $conditions[] = 'o.supermarket_id = :supermarket_id';
    $params[':supermarket_id'] = (int)$supermarketId;
}

// Filter by status
$status = get_query_param('status', '');
if ($status !== '') {
    $conditions[] = 'o.status = :status';
    $params[':status'] = $status;
}

// Pagination
[$limit, $offset, $page] = parse_pagination();

$pdo = get_pdo();

// Count total
$countSql = 'SELECT COUNT(*) FROM offers o WHERE ' . implode(' AND ', $conditions);
$stmt = $pdo->prepare($countSql);
$stmt->execute($params);
$total = (int)$stmt->fetchColumn();

// Fetch data
$sql = 'SELECT 
            o.id,
            o.supermarket_id,
            s.name AS supermarket_name,
            o.image_path,
            o.uploaded_at,
            o.status,
            o.error_message,
            (SELECT COUNT(*) FROM parsed_offers po WHERE po.offer_id = o.id) as parsed_count
        FROM offers o
        INNER JOIN supermarkets s ON o.supermarket_id = s.id
        WHERE ' . implode(' AND ', $conditions) . '
        ORDER BY o.uploaded_at DESC
        LIMIT :limit OFFSET :offset';

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
        'total' => $total,
        'page' => $page,
        'limit' => $limit,
        'pages' => (int)ceil($total / $limit),
    ],
]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Error fatal: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    exit;
}
