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
    'neighborhood_id' => 'int',
    'day_of_week' => 'string',
]);

$neighborhoodId = (int)$data['neighborhood_id'];
$dayOfWeek = trim((string)$data['day_of_week']);
$type = isset($data['type']) ? trim((string)$data['type']) : 'Residuos';

$pdo = get_pdo();

// Verificar barrio
$stmt = $pdo->prepare('SELECT id FROM neighborhoods WHERE id = :id');
$stmt->execute([':id' => $neighborhoodId]);
if (!$stmt->fetch()) {
    json_error('VALIDATION_ERROR', 'Barrio no encontrado.', [], 422);
}

// Verificar duplicado
$stmt = $pdo->prepare('SELECT COUNT(*) FROM trash_schedules WHERE neighborhood_id = :nid AND day_of_week = :day AND type = :type');
$stmt->execute([':nid' => $neighborhoodId, ':day' => $dayOfWeek, ':type' => $type]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'Este horario ya existe.', [], 422);
}

$stmt = $pdo->prepare('INSERT INTO trash_schedules (neighborhood_id, day_of_week, type, created_at, updated_at) VALUES (:nid, :day, :type, NOW(), NOW())');
$stmt->execute([
    ':nid' => $neighborhoodId,
    ':day' => $dayOfWeek,
    ':type' => $type,
]);

$id = (int)$pdo->lastInsertId();
$stmt = $pdo->prepare('SELECT * FROM trash_schedules WHERE id = :id');
$stmt->execute([':id' => $id]);
$schedule = $stmt->fetch();

json_success(['schedule' => $schedule], 201);
