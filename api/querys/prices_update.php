<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

require_http_method(['PUT', 'PATCH']);
require_admin();

$data = read_json_input();
$id = (int)get_query_param('id', '0');

if ($id <= 0) {
    json_error('ID inválido', 400);
}

// Check if price exists
$stmt = $pdo->prepare('SELECT * FROM prices WHERE id = :id');
$stmt->execute([':id' => $id]);
$existing = $stmt->fetch();

if (!$existing) {
    json_error('Precio no encontrado', 404);
}

// Fields that can be updated
$updates = [];
$params = [':id' => $id];

if (isset($data['price'])) {
    $price = (float)$data['price'];
    if ($price < 0) {
        send_validation_error('El precio debe ser mayor o igual a 0');
    }
    $updates[] = 'price = :price';
    $params[':price'] = $price;
}

if (isset($data['currency'])) {
    $updates[] = 'currency = :currency';
    $params[':currency'] = trim((string)$data['currency']);
}

if (isset($data['valid_to'])) {
    $validTo = $data['valid_to'] !== '' ? trim((string)$data['valid_to']) : null;
    
    if ($validTo !== null) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $validTo)) {
            send_validation_error('Formato de fecha inválido para valid_to (usar YYYY-MM-DD)');
        }
        if ($validTo < $existing['valid_from']) {
            send_validation_error('La fecha valid_to debe ser mayor o igual a valid_from');
        }
    }
    
    $updates[] = 'valid_to = :valid_to';
    $params[':valid_to'] = $validTo;
}

if (isset($data['promo_type_id'])) {
    $promoTypeId = $data['promo_type_id'] !== '' ? (int)$data['promo_type_id'] : null;
    
    if ($promoTypeId !== null) {
        $stmt = $pdo->prepare('SELECT id FROM promo_types WHERE id = :id AND is_active = 1');
        $stmt->execute([':id' => $promoTypeId]);
        if (!$stmt->fetch()) {
            send_validation_error('El tipo de promoción especificado no existe o no está activo');
        }
    }
    
    $updates[] = 'promo_type_id = :promo_type_id';
    $params[':promo_type_id'] = $promoTypeId;
}

if (isset($data['restrictions'])) {
    $restrictions = trim($data['restrictions']) !== '' ? trim($data['restrictions']) : null;
    $updates[] = 'restrictions = :restrictions';
    $params[':restrictions'] = $restrictions;
}

if (empty($updates)) {
    json_error('No se especificaron campos para actualizar', 400);
}

// Update
$sql = 'UPDATE prices SET ' . implode(', ', $updates) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

json_success(['message' => 'Precio actualizado correctamente']);
