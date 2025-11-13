<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID de supermercado inválido.', ['id' => 'Debe ser un número entero.'], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT s.id, s.city_id, c.slug AS city_slug, c.name AS city_name, c.state AS city_state, '
    . 's.name, s.slug, s.address, s.city, s.state, s.zip, s.phone, s.website, s.is_active, s.created_at, s.updated_at '
    . 'FROM supermarkets s INNER JOIN cities c ON c.id = s.city_id WHERE s.id = :id');
$stmt->execute([':id' => (int)$id]);
$supermarket = $stmt->fetch();

if (!$supermarket) {
    json_error('NOT_FOUND', 'Supermercado no encontrado.', [], 404);
}

$stmt = $pdo->prepare('SELECT id, weekday, open_time, close_time FROM store_hours WHERE supermarket_id = :id ORDER BY weekday');
$stmt->execute([':id' => (int)$id]);
$hours = $stmt->fetchAll();

$supermarket['store_hours'] = $hours;

json_success(['supermarket' => $supermarket]);

