<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$id = (int)get_query_param('id', '0');

if ($id <= 0) {
    json_error('ID inválido', 400);
}

$sql = 'SELECT 
            p.id,
            p.supermarket_id,
            s.name AS supermarket_name,
            p.product_id,
            CONCAT(pr.name, " - ", pr.brand, " - ", pr.size) AS product_name,
            p.price,
            p.currency,
            p.valid_from,
            p.valid_to,
            p.promo_type_id,
            pt.name AS promo_type_name,
            p.created_at,
            p.updated_at
        FROM prices p
        INNER JOIN supermarkets s ON p.supermarket_id = s.id
        INNER JOIN products pr ON p.product_id = pr.id
        LEFT JOIN promo_types pt ON p.promo_type_id = pt.id
        WHERE p.id = :id';

$stmt = $pdo->prepare($sql);
$stmt->execute([':id' => $id]);
$price = $stmt->fetch();

if (!$price) {
    json_error('Precio no encontrado', 404);
}

json_success($price);
