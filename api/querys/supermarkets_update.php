<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['PUT', 'PATCH']);
require_admin();

$idParam = get_query_param('id');
if ($idParam === null || !ctype_digit((string)$idParam)) {
    json_error('VALIDATION_ERROR', 'ID de supermercado inválido.', ['id' => 'Debe ser entero.'], 422);
}
$supermarketId = (int)$idParam;

$data = read_json_input();
if (!is_array($data) || $data === []) {
    json_error('VALIDATION_ERROR', 'No hay datos para actualizar.', [], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare(
    'SELECT id, name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at '
    . 'FROM supermarkets WHERE id = :id'
);
$stmt->execute([':id' => $supermarketId]);
$existing = $stmt->fetch();

if (!$existing) {
    json_error('NOT_FOUND', 'Supermercado no encontrado.', [], 404);
}

$fields = [];
$params = [':id' => $supermarketId];

if (array_key_exists('name', $data)) {
    if (!is_string($data['name']) || trim($data['name']) === '') {
        send_validation_error(['name' => 'Debe ser un texto no vacío.']);
    }
    $params[':name'] = trim($data['name']);
    $fields['name'] = ':name';
}

if (array_key_exists('slug', $data)) {
    if (!is_string($data['slug']) || trim($data['slug']) === '') {
        send_validation_error(['slug' => 'Debe ser un texto no vacío.']);
    }
    $slug = slugify($data['slug']);
    if ($slug === '') {
        send_validation_error(['slug' => 'Slug inválido.']);
    }
    $params[':slug'] = $slug;
    $fields['slug'] = ':slug';
}

$optionalStrings = ['address', 'city', 'state', 'zip', 'phone', 'website'];
foreach ($optionalStrings as $field) {
    if (array_key_exists($field, $data)) {
        $value = $data[$field];
        if ($value !== null && !is_string($value)) {
            send_validation_error([$field => 'Debe ser texto o null.']);
        }
        $params[":$field"] = $value === null ? null : trim((string)$value);
        $fields[$field] = ":$field";
    }
}

if (array_key_exists('is_active', $data)) {
    $params[':is_active'] = (bool)$data['is_active'] ? 1 : 0;
    $fields['is_active'] = ':is_active';
}

if ($fields === []) {
    json_error('VALIDATION_ERROR', 'No hay campos válidos para actualizar.', [], 422);
}

$dupConditions = [];
$dupParams = [':id' => $supermarketId];
if (isset($fields['name'])) {
    $dupConditions[] = 'name = :dup_name';
    $dupParams[':dup_name'] = $params[':name'];
}
if (isset($fields['slug'])) {
    $dupConditions[] = 'slug = :dup_slug';
    $dupParams[':dup_slug'] = $params[':slug'];
}

if ($dupConditions) {
    $dupSql = 'SELECT COUNT(*) FROM supermarkets WHERE id <> :id AND (' . implode(' OR ', $dupConditions) . ')';
    $dupStmt = $pdo->prepare($dupSql);
    $dupStmt->execute($dupParams);
    if ((int)$dupStmt->fetchColumn() > 0) {
        json_error(
            'VALIDATION_ERROR',
            'Nombre o slug duplicado.',
            ['name' => 'Duplicado', 'slug' => 'Duplicado'],
            422
        );
    }
}

$setClauses = [];
foreach ($fields as $column => $placeholder) {
    $setClauses[] = "$column = $placeholder";
}
$setClauses[] = 'updated_at = NOW()';

$sql = 'UPDATE supermarkets SET ' . implode(', ', $setClauses) . ' WHERE id = :id';
$updateStmt = $pdo->prepare($sql);
$updateStmt->execute($params);

$stmt = $pdo->prepare(
    'SELECT id, name, slug, address, city, state, zip, phone, website, is_active, created_at, updated_at '
    . 'FROM supermarkets WHERE id = :id'
);
$stmt->execute([':id' => $supermarketId]);
$supermarket = $stmt->fetch();

json_success(['supermarket' => $supermarket]);
