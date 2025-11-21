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
    'name' => 'string',
    'city' => 'string',
]);

$name = trim((string)$data['name']);
$city = trim((string)$data['city']);

if (!in_array($city, ['Rio Segundo', 'Pilar'], true)) {
    send_validation_error(['city' => 'Ciudad inválida. Debe ser Rio Segundo o Pilar.']);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT COUNT(*) FROM neighborhoods WHERE name = :name AND city = :city');
$stmt->execute([':name' => $name, ':city' => $city]);
if ((int)$stmt->fetchColumn() > 0) {
    json_error('VALIDATION_ERROR', 'El barrio ya existe en esta ciudad.', ['name' => 'Duplicado'], 422);
}

$stmt = $pdo->prepare('INSERT INTO neighborhoods (name, city, created_at, updated_at) VALUES (:name, :city, NOW(), NOW())');
$stmt->execute([
    ':name' => $name,
    ':city' => $city,
]);

$id = (int)$pdo->lastInsertId();
$stmt = $pdo->prepare('SELECT * FROM neighborhoods WHERE id = :id');
$stmt->execute([':id' => $id]);
$neighborhood = $stmt->fetch();

json_success(['neighborhood' => $neighborhood], 201);
