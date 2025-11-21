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
    'date' => 'string',
    'name' => 'string',
    'address' => 'string',
    'schedule' => 'string',
]);

$city = trim((string)$data['city']);
$date = trim((string)$data['date']);
$name = trim((string)$data['name']);
$address = trim((string)$data['address']);
$schedule = trim((string)$data['schedule']);
$neighborhoodId = isset($data['neighborhood_id']) ? (int)$data['neighborhood_id'] : null;
$phone = isset($data['phone']) ? trim((string)$data['phone']) : null;
$latitude = isset($data['latitude']) ? (float)$data['latitude'] : null;
$longitude = isset($data['longitude']) ? (float)$data['longitude'] : null;

if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
    send_validation_error(['city' => 'Ciudad inválida. Debe ser Rio Segundo o Pilar.']);
}

$pdo = get_pdo();

// Validate neighborhood if provided
if ($neighborhoodId !== null) {
    $stmt = $pdo->prepare('SELECT id FROM neighborhoods WHERE id = :id AND city = :city');
    $stmt->execute([':id' => $neighborhoodId, ':city' => $city]);
    if (!$stmt->fetch()) {
        send_validation_error(['neighborhood_id' => 'Barrio no encontrado o no pertenece a la ciudad seleccionada.']);
    }
}

// Check for duplicate
$stmt = $pdo->prepare('SELECT COUNT(*) FROM pharmacies_on_duty WHERE city = :city AND date = :date AND name = :name');
$stmt->execute([':city' => $city, ':date' => $date, ':name' => $name]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'Esta farmacia ya está registrada para esta fecha y ciudad.', ['name' => 'Duplicado'], 422);
}

$stmt = $pdo->prepare('INSERT INTO pharmacies_on_duty (city, date, name, neighborhood_id, address, schedule, phone, latitude, longitude, created_at, updated_at) VALUES (:city, :date, :name, :neighborhood_id, :address, :schedule, :phone, :latitude, :longitude, NOW(), NOW())');
$stmt->execute([
    ':city' => $city,
    ':date' => $date,
    ':name' => $name,
    ':neighborhood_id' => $neighborhoodId,
    ':address' => $address,
    ':schedule' => $schedule,
    ':phone' => $phone,
    ':latitude' => $latitude,
    ':longitude' => $longitude,
]);

$id = (int)$pdo->lastInsertId();
$stmt = $pdo->prepare('SELECT * FROM pharmacies_on_duty WHERE id = :id');
$stmt->execute([':id' => $id]);
$pharmacy = $stmt->fetch();

json_success(['pharmacy' => $pharmacy], 201);
