<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['PUT', 'PATCH']);
$user = require_user_auth();
if (($user['role'] ?? null) !== 'admin') {
    json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
}

$data = read_json_input();
validate_required($data, ['id' => 'integer']);

$id = (int)$data['id'];

$pdo = get_pdo();

// Check if pharmacy exists
$stmt = $pdo->prepare('SELECT * FROM pharmacies WHERE id = :id');
$stmt->execute([':id' => $id]);
$existing = $stmt->fetch();
if (!$existing) {
    json_error('NOT_FOUND', 'Farmacia no encontrada.', [], 404);
}

// Build update query dynamically
$updates = [];
$params = [':id' => $id];

if (isset($data['city'])) {
    $city = trim((string)$data['city']);
    if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
        send_validation_error(['city' => 'Ciudad inválida.']);
    }
    $updates[] = 'city = :city';
    $params[':city'] = $city;
}

if (isset($data['name'])) {
    $name = trim((string)$data['name']);
    $updates[] = 'name = :name';
    $params[':name'] = $name;
    
    // Check for duplicate name in same city
    $checkCity = $params[':city'] ?? $existing['city'];
    $stmt = $pdo->prepare('SELECT id FROM pharmacies WHERE city = :city AND name = :name AND id != :id');
    $stmt->execute([':city' => $checkCity, ':name' => $name, ':id' => $id]);
    if ($stmt->fetch()) {
        json_error('VALIDATION_ERROR', "Ya existe otra farmacia con el nombre '$name' en $checkCity.", ['name' => 'Duplicado'], 422);
    }
}

if (isset($data['neighborhood_id'])) {
    $neighborhoodId = $data['neighborhood_id'] ? (int)$data['neighborhood_id'] : null;
    if ($neighborhoodId !== null) {
        $checkCity = $params[':city'] ?? $existing['city'];
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM neighborhoods WHERE id = :id AND city = :city');
        $stmt->execute([':id' => $neighborhoodId, ':city' => $checkCity]);
        if ((int)$stmt->fetchColumn() === 0) {
            send_validation_error(['neighborhood_id' => 'El barrio no existe o no pertenece a esta ciudad.']);
        }
    }
    $updates[] = 'neighborhood_id = :neighborhood_id';
    $params[':neighborhood_id'] = $neighborhoodId;
}

if (isset($data['address'])) {
    $updates[] = 'address = :address';
    $params[':address'] = trim((string)$data['address']);
}

if (isset($data['phone'])) {
    $updates[] = 'phone = :phone';
    $params[':phone'] = $data['phone'] ? trim((string)$data['phone']) : null;
}

if (isset($data['latitude'])) {
    $updates[] = 'latitude = :latitude';
    $params[':latitude'] = $data['latitude'] ? (float)$data['latitude'] : null;
}

if (isset($data['longitude'])) {
    $updates[] = 'longitude = :longitude';
    $params[':longitude'] = $data['longitude'] ? (float)$data['longitude'] : null;
}

if (empty($updates)) {
    json_error('VALIDATION_ERROR', 'No hay campos para actualizar.', [], 422);
}

$updates[] = 'updated_at = NOW()';
$sql = 'UPDATE pharmacies SET ' . implode(', ', $updates) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

json_success(['message' => 'Farmacia actualizada exitosamente.']);
