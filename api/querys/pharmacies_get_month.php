<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$pdo = get_pdo();

$city = get_query_param('city');
$year = get_query_param('year');
$month = get_query_param('month');

// Validate city
if ($city === null || !in_array(trim($city), ['Rio Segundo', 'Pilar'], true)) {
    json_error('VALIDATION_ERROR', 'Ciudad inválida. Debe ser Rio Segundo o Pilar.', ['city' => 'Requerido'], 422);
}

$city = trim($city);

// Validate year and month
if ($year === null || !ctype_digit((string)$year)) {
    json_error('VALIDATION_ERROR', 'Año inválido.', ['year' => 'Requerido'], 422);
}
if ($month === null || !ctype_digit((string)$month)) {
    json_error('VALIDATION_ERROR', 'Mes inválido.', ['month' => 'Requerido'], 422);
}

$year = (int)$year;
$month = (int)$month;

if ($year < 2020 || $year > 2100) {
    json_error('VALIDATION_ERROR', 'Año fuera de rango.', ['year' => 'Debe estar entre 2020 y 2100'], 422);
}
if ($month < 1 || $month > 12) {
    json_error('VALIDATION_ERROR', 'Mes fuera de rango.', ['month' => 'Debe estar entre 1 y 12'], 422);
}

// Calculate days in month
$daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
$firstDay = sprintf('%04d-%02d-01', $year, $month);
$lastDay = sprintf('%04d-%02d-%02d', $year, $month, $daysInMonth);

// Get all duties for this month with full pharmacy details
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
        WHERE pd.city = :city AND pd.date BETWEEN :first AND :last
        ORDER BY pd.date ASC";
$stmt = $pdo->prepare($sql);
$stmt->execute([':city' => $city, ':first' => $firstDay, ':last' => $lastDay]);
$duties = $stmt->fetchAll();

$count = count($duties);
$isComplete = ($count === $daysInMonth);

json_success([
    'duties' => $duties,
    'city' => $city,
    'year' => $year,
    'month' => $month,
    'days_in_month' => $daysInMonth,
    'loaded_days' => $count,
    'is_complete' => $isComplete,
    'status' => $isComplete ? 'complete' : 'incomplete',
]);
