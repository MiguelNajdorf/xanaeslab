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

// Check if duty exists
$stmt = $pdo->prepare('SELECT * FROM pharmacies_on_duty WHERE id = :id');
$stmt->execute([':id' => $id]);
$existing = $stmt->fetch();
if (!$existing) {
    json_error('NOT_FOUND', 'Turno no encontrado.', [], 404);
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

if (isset($data['date'])) {
    $date = trim((string)$data['date']);
    $dateObj = DateTime::createFromFormat('Y-m-d', $date);
    if (!$dateObj || $dateObj->format('Y-m-d') !== $date) {
        send_validation_error(['date' => 'Formato de fecha inválido.']);
    }
    $updates[] = 'date = :date';
    $params[':date'] = $date;
}

if (isset($data['pharmacy_id'])) {
    $pharmacyId = (int)$data['pharmacy_id'];
    $checkCity = $params[':city'] ?? $existing['city'];
    
    // Verify pharmacy exists and belongs to this city
    $stmt = $pdo->prepare('SELECT name FROM pharmacies WHERE id = :id AND city = :city');
    $stmt->execute([':id' => $pharmacyId, ':city' => $checkCity]);
    if (!$stmt->fetch()) {
        json_error('VALIDATION_ERROR', 'La farmacia seleccionada no existe o no pertenece a esta ciudad.', ['pharmacy_id' => 'Inválida'], 422);
    }
    
    $updates[] = 'pharmacy_id = :pharmacy_id';
    $params[':pharmacy_id'] = $pharmacyId;
}

if (isset($data['schedule'])) {
    $updates[] = 'schedule = :schedule';
    $params[':schedule'] = trim((string)$data['schedule']);
}

// Check for duplicate if city or date changed
if (isset($params[':city']) || isset($params[':date'])) {
    $checkCity = $params[':city'] ?? $existing['city'];
    $checkDate = $params[':date'] ?? $existing['date'];
    
    $stmt = $pdo->prepare('SELECT id FROM pharmacies_on_duty WHERE city = :city AND date = :date AND id != :id');
    $stmt->execute([':city' => $checkCity, ':date' => $checkDate, ':id' => $id]);
    if ($stmt->fetch()) {
        json_error('VALIDATION_ERROR', "Ya existe un turno para $checkCity el día $checkDate.", ['date' => 'Duplicado'], 422);
    }
}

if (empty($updates)) {
    json_error('VALIDATION_ERROR', 'No hay campos para actualizar.', [], 422);
}

$updates[] = 'updated_at = NOW()';
$sql = 'UPDATE pharmacies_on_duty SET ' . implode(', ', $updates) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

json_success(['message' => 'Turno actualizado exitosamente.']);
