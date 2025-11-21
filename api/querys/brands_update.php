<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['PUT', 'PATCH']);
$user = require_user_auth();
if (($user['role'] ?? null) !== 'admin') {
    json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
}

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', ['id' => 'Debe ser entero.'], 422);
}

$data = read_json_input();
if (empty($data)) {
    json_error('VALIDATION_ERROR', 'No hay datos para actualizar.', [], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT * FROM brands WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$brand = $stmt->fetch();
if (!$brand) {
    json_error('NOT_FOUND', 'Marca no encontrada.', [], 404);
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

if (empty($fields)) {
    json_error('VALIDATION_ERROR', 'No hay campos válidos para actualizar.', [], 422);
}

// Check duplicates
if (isset($params[':name']) || isset($params[':slug'])) {
    $dupSql = 'SELECT COUNT(*) FROM brands WHERE id <> :id AND (';
    $cond = [];
    if (isset($params[':name'])) {
        $cond[] = 'name = :name';
    }
    if (isset($params[':slug'])) {
        $cond[] = 'slug = :slug';
    }
    $dupSql .= implode(' OR ', $cond) . ')';
    
    // Filter params for duplicate check to avoid "Invalid parameter number" error
    $dupParams = [':id' => (int)$id];
    if (isset($params[':name'])) $dupParams[':name'] = $params[':name'];
    if (isset($params[':slug'])) $dupParams[':slug'] = $params[':slug'];

    $stmt = $pdo->prepare($dupSql);
    $stmt->execute($dupParams);
    if ((int)$stmt->fetchColumn() > 0) {
        json_error('VALIDATION_ERROR', 'Nombre o slug duplicado.', ['name' => 'Duplicado', 'slug' => 'Duplicado'], 422);
    }
}

$fields[] = 'updated_at = NOW()';
$sql = 'UPDATE brands SET ' . implode(', ', $fields) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$stmt = $pdo->prepare('SELECT * FROM brands WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$brand = $stmt->fetch();

json_success(['brand' => $brand]);
