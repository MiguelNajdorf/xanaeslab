<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['PUT', 'PATCH']);
require_admin();

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', ['id' => 'Debe ser entero.'], 422);
}

$data = read_json_input();
if (empty($data)) {
    json_error('VALIDATION_ERROR', 'No hay datos para actualizar.', [], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT * FROM categories WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$category = $stmt->fetch();
if (!$category) {
    json_error('NOT_FOUND', 'Categoría no encontrada.', [], 404);
}

$fields = [];
$params = [':id' => (int)$id];

if (isset($data['name'])) {
    if (!is_string($data['name']) || trim($data['name']) === '') {
        send_validation_error(['name' => 'Debe ser texto no vacío.']);
    }
    $fields[] = 'name = :name';
    $params[':name'] = trim((string)$data['name']);
}

if (isset($data['slug'])) {
    if (!is_string($data['slug']) || slugify($data['slug']) === '') {
        send_validation_error(['slug' => 'Slug inválido.']);
    }
    $fields[] = 'slug = :slug';
    $params[':slug'] = slugify($data['slug']);
}

if (array_key_exists('description', $data)) {
    if ($data['description'] !== null && !is_string($data['description'])) {
        send_validation_error(['description' => 'Debe ser texto o null.']);
    }
    $fields[] = 'description = :description';
    $params[':description'] = $data['description'] === null ? null : trim((string)$data['description']);
}

if (empty($fields)) {
    json_error('VALIDATION_ERROR', 'No hay campos válidos para actualizar.', [], 422);
}

if (isset($params[':name']) || isset($params[':slug'])) {
    $dupSql = 'SELECT COUNT(*) FROM categories WHERE id <> :id AND (';
    $cond = [];
    if (isset($params[':name'])) {
        $cond[] = 'name = :name';
    }
    if (isset($params[':slug'])) {
        $cond[] = 'slug = :slug';
    }
    $dupSql .= implode(' OR ', $cond) . ')';
    $stmt = $pdo->prepare($dupSql);
    $stmt->execute($params);
    if ((int)$stmt->fetchColumn() > 0) {
        json_error('VALIDATION_ERROR', 'Nombre o slug duplicado.', ['name' => 'Duplicado', 'slug' => 'Duplicado'], 422);
    }
}

$fields[] = 'updated_at = NOW()';
$sql = 'UPDATE categories SET ' . implode(', ', $fields) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$stmt = $pdo->prepare('SELECT id, name, slug, description FROM categories WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$category = $stmt->fetch();

json_success(['category' => $category]);

