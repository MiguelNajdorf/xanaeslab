<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
require_admin();

$data = read_json_input();
validate_required($data, [
    'name' => 'string',
    'address' => 'string',
    'city_id' => 'int',
    'zip' => 'string',
]);

$name = trim((string)$data['name']);
$slug = isset($data['slug']) && is_string($data['slug']) && trim($data['slug']) !== ''
    ? slugify($data['slug'])
    : slugify($name);
if ($slug === '') {
    json_error('VALIDATION_ERROR', 'No se pudo generar un slug válido.', ['slug' => 'Slug inválido.'], 422);
}

$pdo = get_pdo();

$cityId = (int)$data['city_id'];
$cityStmt = $pdo->prepare('SELECT id, name, state FROM cities WHERE id = :id');
$cityStmt->execute([':id' => $cityId]);
$cityRow = $cityStmt->fetch();
if (!$cityRow) {
    json_error('VALIDATION_ERROR', 'Ciudad no encontrada.', ['city_id' => 'Debe ser una ciudad válida.'], 422);
}

$stmt = $pdo->prepare('SELECT COUNT(*) FROM supermarkets WHERE name = :name OR slug = :slug');
$stmt->execute([':name' => $name, ':slug' => $slug]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error(
        'VALIDATION_ERROR',
        'El nombre o slug ya existe.',
        ['name' => 'Duplicado', 'slug' => 'Duplicado'],
        422
    );
}

$sql = 'INSERT INTO supermarkets (city_id, name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at) '
    . 'VALUES (:city_id, :name, :slug, :address, :city, :state, :zip, :phone, :website, :is_active, NOW(), NOW())';
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':city_id' => $cityId,
    ':name' => $name,
    ':slug' => $slug,
    ':address' => trim((string)$data['address']),
    ':city' => $cityRow['name'],
    ':state' => $cityRow['state'],
    ':zip' => trim((string)$data['zip']),
    ':phone' => isset($data['phone']) ? trim((string)$data['phone']) : null,
    ':website' => isset($data['website']) ? trim((string)$data['website']) : null,
    ':is_active' => isset($data['is_active']) ? ((bool)$data['is_active'] ? 1 : 0) : 1,
]);

$id = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare('SELECT s.id, s.city_id, c.slug AS city_slug, c.name AS city_name, c.state AS city_state, '
    . 's.name, s.slug, s.address, s.city, s.state, s.zip, s.phone, s.website, s.is_active, s.created_at, s.updated_at '
    . 'FROM supermarkets s INNER JOIN cities c ON c.id = s.city_id WHERE s.id = :id');
$stmt->execute([':id' => $id]);
$supermarket = $stmt->fetch();

json_success(['supermarket' => $supermarket], 201);

