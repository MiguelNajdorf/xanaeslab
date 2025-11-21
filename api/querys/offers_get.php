<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['GET']);
require_admin();

$id = (int)get_query_param('id', '0');

if ($id <= 0) {
    json_error('ID inválido', 400);
}

$pdo = get_pdo();

// Fetch offer details
$stmt = $pdo->prepare('
    SELECT 
        o.id,
        o.supermarket_id,
        s.name AS supermarket_name,
        o.image_path,
        o.uploaded_at,
        o.status,
        o.error_message
    FROM offers o
    INNER JOIN supermarkets s ON o.supermarket_id = s.id
    WHERE o.id = :id
');
$stmt->execute([':id' => $id]);
$offer = $stmt->fetch();

if (!$offer) {
    json_error('Oferta no encontrada', 404);
}

// Fetch parsed items
$stmt = $pdo->prepare('
    SELECT 
        po.id,
        po.product_name,
        po.price,
        po.currency,
        po.valid_from,
        po.valid_to,
        po.promo_type_id,
        pt.name AS promo_type_name,
        po.confidence_score
    FROM parsed_offers po
    LEFT JOIN promo_types pt ON po.promo_type_id = pt.id
    WHERE po.offer_id = :id
    ORDER BY po.confidence_score DESC, po.product_name ASC
');
$stmt->execute([':id' => $id]);
$parsedItems = $stmt->fetchAll();

json_success([
    'offer' => $offer,
    'parsed_items' => $parsedItems
]);
