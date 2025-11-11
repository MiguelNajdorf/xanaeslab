<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID de supermercado inválido.', ['id' => 'Debe ser un número entero.'], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id, name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at '
    . 'FROM supermarkets WHERE id = :id');
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

