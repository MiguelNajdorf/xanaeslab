<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$neighborhoodId = get_query_param('neighborhood_id');
if ($neighborhoodId === null || !ctype_digit((string)$neighborhoodId)) {
    json_error('VALIDATION_ERROR', 'ID de barrio inválido.', [], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT * FROM trash_schedules WHERE neighborhood_id = :neighborhood_id ORDER BY FIELD(day_of_week, "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")');
$stmt->execute([':neighborhood_id' => (int)$neighborhoodId]);
$schedules = $stmt->fetchAll();

json_success(['schedules' => $schedules]);
