<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$params = [];
$conditions = ['1=1'];

// Filter by is_active (default: true)
$isActive = get_query_param('is_active', '1');
if ($isActive !== '') {
    $conditions[] = 'is_active = :is_active';
    $params[':is_active'] = (int)$isActive;
}

$pdo = get_pdo();

$sql = 'SELECT id, name, description, is_active, created_at, updated_at 
        FROM promo_types 
        WHERE ' . implode(' AND ', $conditions) . '
        ORDER BY name ASC';

$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$items = $stmt->fetchAll();

json_success(['items' => $items]);
