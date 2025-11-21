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
    'pharmacy_id' => 'integer',
]);

$city = trim((string)$data['city']);
$date = trim((string)$data['date']);
$pharmacyId = (int)$data['pharmacy_id'];
$schedule = isset($data['schedule']) && trim($data['schedule']) ? trim((string)$data['schedule']) : '08:00 - 08:00';

// Validate city
if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
    send_validation_error(['city' => 'Ciudad inválida. Debe ser Rio Segundo o Pilar.']);
}

// Validate date format
$dateObj = DateTime::createFromFormat('Y-m-d', $date);
if (!$dateObj || $dateObj->format('Y-m-d') !== $date) {
    send_validation_error(['date' => 'Formato de fecha inválido. Use YYYY-MM-DD.']);
}

$pdo = get_pdo();

// Verify pharmacy exists and belongs to this city
$stmt = $pdo->prepare('SELECT name FROM pharmacies WHERE id = :id AND city = :city');
$stmt->execute([':id' => $pharmacyId, ':city' => $city]);
$pharmacy = $stmt->fetch();
if (!$pharmacy) {
    json_error('VALIDATION_ERROR', 'La farmacia seleccionada no existe o no pertenece a esta ciudad.', ['pharmacy_id' => 'Inválida'], 422);
}

// Check for duplicate (only one pharmacy per city per day)
$stmt = $pdo->prepare('SELECT p.name FROM pharmacies_on_duty pd JOIN pharmacies p ON pd.pharmacy_id = p.id WHERE pd.city = :city AND pd.date = :date');
$stmt->execute([':city' => $city, ':date' => $date]);
$existing = $stmt->fetch();
if ($existing) {
    json_error('VALIDATION_ERROR', "Ya existe una farmacia de turno para $city el día $date: {$existing['name']}. Solo puede haber una farmacia por día y ciudad.", ['date' => 'Duplicado'], 422);
}

$stmt = $pdo->prepare('INSERT INTO pharmacies_on_duty (city, date, pharmacy_id, schedule, created_at, updated_at) VALUES (:city, :date, :pharmacy_id, :schedule, NOW(), NOW())');
$stmt->execute([
    ':city' => $city,
    ':date' => $date,
    ':pharmacy_id' => $pharmacyId,
    ':schedule' => $schedule,
]);

$id = (int)$pdo->lastInsertId();

json_success(['id' => $id, 'message' => 'Turno creado exitosamente.'], 201);
