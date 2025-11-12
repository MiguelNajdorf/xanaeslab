<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['PUT', 'PATCH']);
require_admin();

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID de supermercado inválido.', ['id' => 'Debe ser entero.'], 422);
}

$data = read_json_input();
if (empty($data)) {
    json_error('VALIDATION_ERROR', 'No hay datos para actualizar.', [], 422);
}

$fields = [];
$params = [':id' => (int)$id];

if (isset($data['name'])) {
    if (!is_string($data['name']) || trim($data['name']) === '') {
        send_validation_error(['name' => 'Debe ser un texto no vacío.']);
    }
    $fields[] = 'name = :name';
    $params[':name'] = trim((string)$data['name']);
}

if (isset($data['slug'])) {
    if (!is_string($data['slug']) || slugify($data['slug']) === '') {
        send_validation_error(['slug' => 'Slug inválido.']);
    }
    $slug = slugify($data['slug']);
    if ($slug === '') {
        send_validation_error(['slug' => 'Slug inválido.']);
    }
    $fields[] = 'slug = :slug';
    $params[':slug'] = $slug;
}

foreach (['address', 'city', 'state', 'zip', 'phone', 'website'] as $field) {
    if (array_key_exists($field, $data)) {
        $value = $data[$field];
        if ($value !== null && !is_string($value)) {
            send_validation_error([$field => 'Debe ser texto o null.']);
        }
        $fields[] = "$field = :$field";
        $params[":" . $field] = $value === null ? null : trim((string)$value);
    }
}

if (array_key_exists('is_active', $data)) {
    $fields[] = 'is_active = :is_active';
    $params[':is_active'] = (bool)$data['is_active'] ? 1 : 0;
}

if (empty($fields)) {
    json_error('VALIDATION_ERROR', 'No hay campos válidos para actualizar.', [], 422);
}

$pdo = get_pdo();

// Check duplicates for name/slug
if (isset($params[':name']) || isset($params[':slug'])) {
    $sql = 'SELECT COUNT(*) FROM supermarkets WHERE id <> :id';
    $dupParams = [':id' => (int)$id];
    if (isset($params[':name'])) {
        $sql .= ' AND name = :name';
        $dupParams[':name'] = $params[':name'];
    }
    if (isset($params[':slug'])) {
        $sql .= isset($params[':name']) ? ' OR slug = :slug' : ' AND slug = :slug';
        $dupParams[':slug'] = $params[':slug'];
    }
    $stmt = $pdo->prepare('SELECT name, slug FROM supermarkets WHERE id = :id');
    $stmt->execute([':id' => (int)$id]);
    $exists = $stmt->fetch();
    if (!$exists) {
        json_error('NOT_FOUND', 'Supermercado no encontrado.', [], 404);
    }

    $dupSql = 'SELECT COUNT(*) FROM supermarkets WHERE id <> :id AND (';
    $conds = [];
    if (isset($params[':name'])) {
        $conds[] = 'name = :name';
    }
    if (isset($params[':slug'])) {
        $conds[] = 'slug = :slug';
    }
    $dupSql .= implode(' OR ', $conds) . ')';
    $stmt = $pdo->prepare($dupSql);
    $stmt->execute($dupParams);
    if ((int)$stmt->fetchColumn() > 0) {
        json_error('VALIDATION_ERROR', 'Nombre o slug duplicado.', ['name' => 'Duplicado', 'slug' => 'Duplicado'], 422);
    }
} else {
    $stmt = $pdo->prepare('SELECT id FROM supermarkets WHERE id = :id');
    $stmt->execute([':id' => (int)$id]);
    if (!$stmt->fetch()) {
        json_error('NOT_FOUND', 'Supermercado no encontrado.', [], 404);
    }
}

$fields[] = 'updated_at = NOW()';
$sql = 'UPDATE supermarkets SET ' . implode(', ', $fields) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$stmt = $pdo->prepare('SELECT id, name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at FROM supermarkets WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$supermarket = $stmt->fetch();

json_success(['supermarket' => $supermarket]);

