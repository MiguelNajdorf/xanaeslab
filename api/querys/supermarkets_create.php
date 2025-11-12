<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
$user = require_user_auth();
if (($user['role'] ?? null) !== 'admin') {
    json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
}

$data = read_json_input();
validate_required($data, [
    'name' => 'string',
    'address' => 'string',
    'city' => 'string',
    'state' => 'string',
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

$stmt = $pdo->prepare('SELECT COUNT(*) FROM supermarkets WHERE name = :name OR slug = :slug');
$stmt->execute([':name' => $name, ':slug' => $slug]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'El nombre o slug ya existe.', ['name' => 'Duplicado', 'slug' => 'Duplicado'], 422);
}

$sql = 'INSERT INTO supermarkets (name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at) '
    . 'VALUES (:name, :slug, :address, :city, :state, :zip, :phone, :website, :is_active, NOW(), NOW())';
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':name' => $name,
    ':slug' => $slug,
    ':address' => trim((string)$data['address']),
    ':city' => trim((string)$data['city']),
    ':state' => trim((string)$data['state']),
    ':zip' => trim((string)$data['zip']),
    ':phone' => isset($data['phone']) ? trim((string)$data['phone']) : null,
    ':website' => isset($data['website']) ? trim((string)$data['website']) : null,
    ':is_active' => isset($data['is_active']) ? (bool)$data['is_active'] : true,
]);

$id = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare('SELECT id, name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at FROM supermarkets WHERE id = :id');
$stmt->execute([':id' => $id]);
$supermarket = $stmt->fetch();

json_success(['supermarket' => $supermarket], 201);

