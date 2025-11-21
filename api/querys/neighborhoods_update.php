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
$stmt = $pdo->prepare('SELECT * FROM neighborhoods WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$neighborhood = $stmt->fetch();
if (!$neighborhood) {
    json_error('NOT_FOUND', 'Barrio no encontrado.', [], 404);
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

if (isset($data['city'])) {
    $city = trim((string)$data['city']);
    if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
        send_validation_error(['city' => 'Ciudad inválida.']);
    }
    $fields[] = 'city = :city';
    $params[':city'] = $city;
}

if (empty($fields)) {
    json_error('VALIDATION_ERROR', 'No hay campos válidos para actualizar.', [], 422);
}

// Check duplicates
if (isset($params[':name']) || isset($params[':city'])) {
    $checkName = $params[':name'] ?? $neighborhood['name'];
    $checkCity = $params[':city'] ?? $neighborhood['city'];
    
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM neighborhoods WHERE name = :name AND city = :city AND id <> :id');
    $stmt->execute([':name' => $checkName, ':city' => $checkCity, ':id' => (int)$id]);
    if ((int)$stmt->fetchColumn() > 0) {
        json_error('VALIDATION_ERROR', 'El barrio ya existe en esta ciudad.', ['name' => 'Duplicado'], 422);
    }
}

$fields[] = 'updated_at = NOW()';
$sql = 'UPDATE neighborhoods SET ' . implode(', ', $fields) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$stmt = $pdo->prepare('SELECT * FROM neighborhoods WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$neighborhood = $stmt->fetch();

json_success(['neighborhood' => $neighborhood]);
