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
    'city' => 'string',
    'name' => 'string',
    'address' => 'string',
]);

$city = trim((string)$data['city']);
$name = trim((string)$data['name']);
$address = trim((string)$data['address']);
$neighborhoodId = isset($data['neighborhood_id']) && $data['neighborhood_id'] ? (int)$data['neighborhood_id'] : null;
$phone = isset($data['phone']) ? trim((string)$data['phone']) : null;
$latitude = isset($data['latitude']) && $data['latitude'] ? (float)$data['latitude'] : null;
$longitude = isset($data['longitude']) && $data['longitude'] ? (float)$data['longitude'] : null;

// Validate city
if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
    send_validation_error(['city' => 'Ciudad inválida. Debe ser Rio Segundo o Pilar.']);
}

$pdo = get_pdo();

// Validate neighborhood_id if provided
if ($neighborhoodId !== null) {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM neighborhoods WHERE id = :id AND city = :city');
    $stmt->execute([':id' => $neighborhoodId, ':city' => $city]);
    if ((int)$stmt->fetchColumn() === 0) {
        send_validation_error(['neighborhood_id' => 'El barrio no existe o no pertenece a esta ciudad.']);
    }
}

// Check for duplicate pharmacy name in same city
$stmt = $pdo->prepare('SELECT id FROM pharmacies WHERE city = :city AND name = :name');
$stmt->execute([':city' => $city, ':name' => $name]);
if ($stmt->fetch()) {
    json_error('VALIDATION_ERROR', "Ya existe una farmacia con el nombre '$name' en $city.", ['name' => 'Duplicado'], 422);
}

$stmt = $pdo->prepare('INSERT INTO pharmacies (city, name, neighborhood_id, address, phone, latitude, longitude, created_at, updated_at) VALUES (:city, :name, :neighborhood_id, :address, :phone, :latitude, :longitude, NOW(), NOW())');
$stmt->execute([
    ':city' => $city,
    ':name' => $name,
    ':neighborhood_id' => $neighborhoodId,
    ':address' => $address,
    ':phone' => $phone,
    ':latitude' => $latitude,
    ':longitude' => $longitude,
]);

$id = (int)$pdo->lastInsertId();

json_success(['id' => $id, 'message' => 'Farmacia creada exitosamente.'], 201);
