<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
require_admin();

$data = read_json_input();
validate_required($data, [
    'supermarket_id' => 'int',
    'hours' => 'array',
]);

$supermarketId = (int)$data['supermarket_id'];
$hours = $data['hours'];
if (!is_array($hours)) {
    send_validation_error(['hours' => 'Debe ser un arreglo.']);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id FROM supermarkets WHERE id = :id');
$stmt->execute([':id' => $supermarketId]);
if (!$stmt->fetch()) {
    json_error('NOT_FOUND', 'Supermercado no encontrado.', [], 404);
}

$pdo->beginTransaction();
try {
    $sql = 'INSERT INTO store_hours (supermarket_id, weekday, open_time, close_time, created_at, updated_at) '
        . 'VALUES (:supermarket_id, :weekday, :open_time, :close_time, NOW(), NOW()) '
        . 'ON DUPLICATE KEY UPDATE open_time = VALUES(open_time), close_time = VALUES(close_time), updated_at = NOW()';
    $stmt = $pdo->prepare($sql);

    foreach ($hours as $entry) {
        if (!is_array($entry)) {
            throw new InvalidArgumentException('Formato de horario inválido.');
        }
        if (!isset($entry['weekday']) || !is_int($entry['weekday']) || $entry['weekday'] < 0 || $entry['weekday'] > 6) {
            throw new InvalidArgumentException('weekday debe estar entre 0 y 6.');
        }
        foreach (['open_time', 'close_time'] as $timeField) {
            if (!isset($entry[$timeField]) || !preg_match('/^\d{2}:\d{2}$/', (string)$entry[$timeField])) {
                throw new InvalidArgumentException('Hora inválida para ' . $timeField);
            }
        }
        $stmt->execute([
            ':supermarket_id' => $supermarketId,
            ':weekday' => $entry['weekday'],
            ':open_time' => $entry['open_time'],
            ':close_time' => $entry['close_time'],
        ]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    if ($e instanceof InvalidArgumentException) {
        json_error('VALIDATION_ERROR', $e->getMessage(), [], 422);
    }
    throw $e;
}

$stmt = $pdo->prepare('SELECT id, weekday, open_time, close_time FROM store_hours WHERE supermarket_id = :id ORDER BY weekday');
$stmt->execute([':id' => $supermarketId]);
$hours = $stmt->fetchAll();

json_success(['supermarket_id' => $supermarketId, 'hours' => $hours]);

