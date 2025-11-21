<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

require_http_method(['POST']);
require_admin();

$data = read_json_input();

// Validate required fields
validate_required($data, ['supermarket_id', 'product_id', 'price', 'valid_from']);

$supermarketId = (int)$data['supermarket_id'];
$productId = (int)$data['product_id'];
$price = (float)$data['price'];
$currency = trim((string)($data['currency'] ?? 'ARS'));
$validFrom = trim((string)$data['valid_from']);
$validTo = isset($data['valid_to']) && $data['valid_to'] !== '' ? trim((string)$data['valid_to']) : null;
$promoTypeId = isset($data['promo_type_id']) && $data['promo_type_id'] !== '' ? (int)$data['promo_type_id'] : null;
$restrictions = isset($data['restrictions']) && trim($data['restrictions']) !== '' ? trim($data['restrictions']) : null;

// Validate price
if ($price < 0) {
    send_validation_error('El precio debe ser mayor o igual a 0');
}

// Validate dates
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $validFrom)) {
    send_validation_error('Formato de fecha inválido para valid_from (usar YYYY-MM-DD)');
}

if ($validTo !== null) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $validTo)) {
        send_validation_error('Formato de fecha inválido para valid_to (usar YYYY-MM-DD)');
    }
    if ($validTo < $validFrom) {
        send_validation_error('La fecha valid_to debe ser mayor o igual a valid_from');
    }
}

// Validate supermarket exists
$stmt = $pdo->prepare('SELECT id FROM supermarkets WHERE id = :id');
$stmt->execute([':id' => $supermarketId]);
if (!$stmt->fetch()) {
    send_validation_error('El supermercado especificado no existe');
}

// Validate product exists
$stmt = $pdo->prepare('SELECT id FROM products WHERE id = :id');
$stmt->execute([':id' => $productId]);
if (!$stmt->fetch()) {
    send_validation_error('El producto especificado no existe');
}

// Validate promo_type exists (if provided)
if ($promoTypeId !== null) {
    $stmt = $pdo->prepare('SELECT id FROM promo_types WHERE id = :id AND is_active = 1');
    $stmt->execute([':id' => $promoTypeId]);
    if (!$stmt->fetch()) {
        send_validation_error('El tipo de promoción especificado no existe o no está activo');
    }
}

// Check for duplicate (same supermarket, product, valid_from)
$stmt = $pdo->prepare('
    SELECT id FROM prices 
    WHERE supermarket_id = :supermarket_id 
    AND product_id = :product_id 
    AND valid_from = :valid_from
');
$stmt->execute([
    ':supermarket_id' => $supermarketId,
    ':product_id' => $productId,
    ':valid_from' => $validFrom,
]);
if ($stmt->fetch()) {
    send_validation_error('Ya existe un precio para este producto/supermercado con la misma fecha de inicio');
}

// Insert price
$sql = 'INSERT INTO prices 
        (supermarket_id, product_id, price, currency, valid_from, valid_to, promo_type_id, restrictions)
        VALUES (:supermarket_id, :product_id, :price, :currency, :valid_from, :valid_to, :promo_type_id, :restrictions)';

$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':supermarket_id' => $supermarketId,
    ':product_id' => $productId,
    ':price' => $price,
    ':currency' => $currency,
    ':valid_from' => $validFrom,
    ':valid_to' => $validTo,
    ':promo_type_id' => $promoTypeId,
    ':restrictions' => $restrictions,
]);

$id = (int)$pdo->lastInsertId();

json_success([
    'id' => $id,
    'message' => 'Precio creado correctamente',
]);
