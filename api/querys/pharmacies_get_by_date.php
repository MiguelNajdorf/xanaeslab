<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();

$city = get_query_param('city');
$date = get_query_param('date');

// Validate city
if ($city === null || !in_array(trim($city), ['Rio Segundo', 'Pilar'], true)) {
    json_error('VALIDATION_ERROR', 'Ciudad inválida. Debe ser Rio Segundo o Pilar.', ['city' => 'Requerido'], 422);
}

$city = trim($city);

// If no date provided, use today
if ($date === null || trim($date) === '') {
    $date = date('Y-m-d');
} else {
    $date = trim($date);
    // Validate date format
    $dateObj = DateTime::createFromFormat('Y-m-d', $date);
    if (!$dateObj || $dateObj->format('Y-m-d') !== $date) {
        json_error('VALIDATION_ERROR', 'Formato de fecha inválido. Use YYYY-MM-DD.', ['date' => 'Formato inválido'], 422);
    }
}

// Get pharmacy duty for this city and date with full pharmacy details
$sql = "SELECT pd.*, 
               p.name as pharmacy_name,
               p.address,
               p.phone,
               p.latitude,
               p.longitude,
               p.neighborhood_id,
               n.name as neighborhood_name
        FROM pharmacies_on_duty pd
        JOIN pharmacies p ON pd.pharmacy_id = p.id
        LEFT JOIN neighborhoods n ON p.neighborhood_id = n.id
        WHERE pd.city = :city AND pd.date = :date";
$stmt = $pdo->prepare($sql);
$stmt->execute([':city' => $city, ':date' => $date]);
$duty = $stmt->fetch();

if (!$duty) {
    json_error('NOT_FOUND', "No hay información de farmacia de turno cargada para $city el día $date.", [], 404);
}

json_success(['pharmacy' => $duty]);
