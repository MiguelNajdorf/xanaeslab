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
$stmt = $pdo->prepare('SELECT * FROM pharmacies_on_duty WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$pharmacy = $stmt->fetch();
if (!$pharmacy) {
    json_error('NOT_FOUND', 'Farmacia no encontrada.', [], 404);
}

$fields = [];
$params = [':id' => (int)$id];

if (isset($data['city'])) {
    $city = trim((string)$data['city']);
    if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
        send_validation_error(['city' => 'Ciudad inválida.']);
    }
    $fields[] = 'city = :city';
    $params[':city'] = $city;
}

if (isset($data['date'])) {
    $fields[] = 'date = :date';
    $params[':date'] = trim((string)$data['date']);
}

if (isset($data['name'])) {
    $fields[] = 'name = :name';
    $params[':name'] = trim((string)$data['name']);
}

if (isset($data['neighborhood_id'])) {
    $neighborhoodId = $data['neighborhood_id'] ? (int)$data['neighborhood_id'] : null;
    
    // Validate neighborhood if provided
    if ($neighborhoodId !== null) {
        $checkCity = $params[':city'] ?? $pharmacy['city'];
        $stmt = $pdo->prepare('SELECT id FROM neighborhoods WHERE id = :id AND city = :city');
        $stmt->execute([':id' => $neighborhoodId, ':city' => $checkCity]);
        if (!$stmt->fetch()) {
            send_validation_error(['neighborhood_id' => 'Barrio no encontrado o no pertenece a la ciudad seleccionada.']);
        }
    }
    
    $fields[] = 'neighborhood_id = :neighborhood_id';
    $params[':neighborhood_id'] = $neighborhoodId;
}

if (isset($data['address'])) {
    $fields[] = 'address = :address';
    $params[':address'] = trim((string)$data['address']);
}

if (isset($data['schedule'])) {
    $fields[] = 'schedule = :schedule';
    $params[':schedule'] = trim((string)$data['schedule']);
}

if (isset($data['phone'])) {
    $fields[] = 'phone = :phone';
    $params[':phone'] = trim((string)$data['phone']) ?: null;
}

if (isset($data['latitude'])) {
    $fields[] = 'latitude = :latitude';
    $params[':latitude'] = $data['latitude'] ? (float)$data['latitude'] : null;
}

if (isset($data['longitude'])) {
    $fields[] = 'longitude = :longitude';
    $params[':longitude'] = $data['longitude'] ? (float)$data['longitude'] : null;
}

if (empty($fields)) {
    json_error('VALIDATION_ERROR', 'No hay campos válidos para actualizar.', [], 422);
}

// Check duplicates if city, date, or name changed
if (isset($params[':city']) || isset($params[':date']) || isset($params[':name'])) {
    $checkCity = $params[':city'] ?? $pharmacy['city'];
    $checkDate = $params[':date'] ?? $pharmacy['date'];
    $checkName = $params[':name'] ?? $pharmacy['name'];
    
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM pharmacies_on_duty WHERE city = :city AND date = :date AND name = :name AND id <> :id');
    $stmt->execute([':city' => $checkCity, ':date' => $checkDate, ':name' => $checkName, ':id' => (int)$id]);
    if ((int)$stmt->fetchColumn() > 0) {
        json_error('VALIDATION_ERROR', 'Esta farmacia ya está registrada para esta fecha y ciudad.', ['name' => 'Duplicado'], 422);
    }
}

$fields[] = 'updated_at = NOW()';
$sql = 'UPDATE pharmacies_on_duty SET ' . implode(', ', $fields) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$stmt = $pdo->prepare('SELECT * FROM pharmacies_on_duty WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$pharmacy = $stmt->fetch();

json_success(['pharmacy' => $pharmacy]);
