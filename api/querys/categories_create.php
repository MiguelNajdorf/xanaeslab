<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
require_admin();

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
$stmt = $pdo->prepare('SELECT COUNT(*) FROM categories WHERE name = :name OR slug = :slug');
$stmt->execute([':name' => $name, ':slug' => $slug]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'Nombre o slug ya existe.', ['name' => 'Duplicado', 'slug' => 'Duplicado'], 422);
}

$stmt = $pdo->prepare('INSERT INTO categories (name, slug, description, created_at, updated_at) VALUES (:name, :slug, :description, NOW(), NOW())');
$stmt->execute([
    ':name' => $name,
    ':slug' => $slug,
    ':description' => isset($data['description']) && $data['description'] !== null ? trim((string)$data['description']) : null,
]);

$id = (int)$pdo->lastInsertId();
$stmt = $pdo->prepare('SELECT id, name, slug, description FROM categories WHERE id = :id');
$stmt->execute([':id' => $id]);
$category = $stmt->fetch();

json_success(['category' => $category], 201);

