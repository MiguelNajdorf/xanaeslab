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
    'year' => 'integer',
    'month' => 'integer',
    'duties' => 'array',
]);

$city = trim((string)$data['city']);
$year = (int)$data['year'];
$month = (int)$data['month'];
$duties = $data['duties'];

// Validate city
if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
    send_validation_error(['city' => 'Ciudad inválida. Debe ser Rio Segundo o Pilar.']);
}

// Validate year and month
if ($year < 2020 || $year > 2100) {
    send_validation_error(['year' => 'Año inválido.']);
}
if ($month < 1 || $month > 12) {
    send_validation_error(['month' => 'Mes inválido. Debe estar entre 1 y 12.']);
}

// Calculate days in month
$daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);

// Validate array length
if (count($duties) !== $daysInMonth) {
    json_error('VALIDATION_ERROR', "Debe proporcionar exactamente $daysInMonth turnos para este mes.", [
        'duties' => "Se esperaban $daysInMonth registros, se recibieron " . count($duties)
    ], 422);
}

$pdo = get_pdo();

// Check if month already has data
$firstDay = sprintf('%04d-%02d-01', $year, $month);
$lastDay = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);
$stmt = $pdo->prepare('SELECT COUNT(*) FROM pharmacies_on_duty WHERE city = :city AND date BETWEEN :first AND :last');
$stmt->execute([':city' => $city, ':first' => $firstDay, ':last' => $lastDay]);
$existingCount = (int)$stmt->fetchColumn();

$overwrite = isset($data['overwrite']) && $data['overwrite'] === true;

if ($existingCount > 0 && !$overwrite) {
    json_error('VALIDATION_ERROR', "Ya existen $existingCount registros para $city en $month/$year. Use 'overwrite: true' para reemplazarlos.", ['overwrite' => 'Requerido'], 422);
}

// Validate each duty entry
$errors = [];
foreach ($duties as $index => $duty) {
    $day = $index + 1;
    
    if (!isset($duty['pharmacy_id']) || !$duty['pharmacy_id']) {
        $errors["duties[$index].pharmacy_id"] = "Día $day: Debe seleccionar una farmacia.";
        continue;
    }
    
    $pharmacyId = (int)$duty['pharmacy_id'];
    
    // Verify pharmacy exists and belongs to this city
    $stmt = $pdo->prepare('SELECT name FROM pharmacies WHERE id = :id AND city = :city');
    $stmt->execute([':id' => $pharmacyId, ':city' => $city]);
    if (!$stmt->fetch()) {
        $errors["duties[$index].pharmacy_id"] = "Día $day: La farmacia seleccionada no existe o no pertenece a $city.";
    }
}

if (!empty($errors)) {
    json_error('VALIDATION_ERROR', 'Errores de validación en los turnos.', $errors, 422);
}

// Begin transaction
try {
    $pdo->beginTransaction();
    
    // Delete existing records if overwrite is enabled
    if ($overwrite && $existingCount > 0) {
        $deleteStmt = $pdo->prepare('DELETE FROM pharmacies_on_duty WHERE city = :city AND date BETWEEN :first AND :last');
        $deleteStmt->execute([':city' => $city, ':first' => $firstDay, ':last' => $lastDay]);
    }
    
    $stmt = $pdo->prepare('INSERT INTO pharmacies_on_duty (city, date, pharmacy_id, schedule, created_at, updated_at) VALUES (:city, :date, :pharmacy_id, :schedule, NOW(), NOW())');
    
    $inserted = 0;
    foreach ($duties as $index => $duty) {
        $day = $index + 1;
        $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
        
        $pharmacyId = (int)$duty['pharmacy_id'];
        $schedule = isset($duty['schedule']) && trim($duty['schedule']) ? trim((string)$duty['schedule']) : '08:00 - 08:00';
        
        $stmt->execute([
            ':city' => $city,
            ':date' => $date,
            ':pharmacy_id' => $pharmacyId,
            ':schedule' => $schedule,
        ]);
        
        $inserted++;
    }
    
    $pdo->commit();
    
    json_success([
        'message' => "Se cargaron exitosamente $inserted turnos para $city en $month/$year.",
        'inserted' => $inserted,
        'city' => $city,
        'year' => $year,
        'month' => $month,
    ], 201);
    
} catch (Exception $e) {
    $pdo->rollBack();
    json_error('DATABASE_ERROR', 'Error al insertar los turnos: ' . $e->getMessage(), [], 500);
}
