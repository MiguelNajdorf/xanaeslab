<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['DELETE']);
$user = require_user_auth();
if (($user['role'] ?? null) !== 'admin') {
    json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
}

$data = read_json_input();
validate_required($data, ['id' => 'integer']);

$id = (int)$data['id'];

$pdo = get_pdo();

// Check if pharmacy exists
$stmt = $pdo->prepare('SELECT name FROM pharmacies WHERE id = :id');
$stmt->execute([':id' => $id]);
$pharmacy = $stmt->fetch();
if (!$pharmacy) {
    json_error('NOT_FOUND', 'Farmacia no encontrada.', [], 404);
}

// Check if pharmacy is referenced in pharmacies_on_duty
$stmt = $pdo->prepare('SELECT COUNT(*) FROM pharmacies_on_duty WHERE pharmacy_id = :id');
$stmt->execute([':id' => $id]);
$dutyCount = (int)$stmt->fetchColumn();

if ($dutyCount > 0) {
    json_error('VALIDATION_ERROR', "No se puede eliminar la farmacia '{$pharmacy['name']}' porque tiene $dutyCount turnos asignados. Elimine primero los turnos.", ['id' => 'Referenciada'], 422);
}

$stmt = $pdo->prepare('DELETE FROM pharmacies WHERE id = :id');
$stmt->execute([':id' => $id]);

json_success(['message' => 'Farmacia eliminada exitosamente.']);
