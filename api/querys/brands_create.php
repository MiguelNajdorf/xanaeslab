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
]);

$name = trim((string)$data['name']);
$slug = isset($data['slug']) && is_string($data['slug']) && trim($data['slug']) !== ''
    ? slugify($data['slug'])
    : slugify($name);

if ($slug === '') {
    send_validation_error(['slug' => 'Slug inválido.']);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT COUNT(*) FROM brands WHERE name = :name OR slug = :slug');
$stmt->execute([':name' => $name, ':slug' => $slug]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'Nombre o slug ya existe.', ['name' => 'Duplicado', 'slug' => 'Duplicado'], 422);
}

$stmt = $pdo->prepare('INSERT INTO brands (name, slug, created_at, updated_at) VALUES (:name, :slug, NOW(), NOW())');
$stmt->execute([
    ':name' => $name,
    ':slug' => $slug,
]);

$id = (int)$pdo->lastInsertId();
$stmt = $pdo->prepare('SELECT * FROM brands WHERE id = :id');
$stmt->execute([':id' => $id]);
$brand = $stmt->fetch();

json_success(['brand' => $brand], 201);
