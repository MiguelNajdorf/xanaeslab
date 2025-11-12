<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/cart_helpers.php';

require_http_method(['POST']);

start_session_if_needed();
$user = current_user();
$data = read_json_input();

$cartId = isset($data['cart_id']) && $data['cart_id'] !== null ? (int)$data['cart_id'] : null;
$sessionTokenInput = isset($data['session_token']) ? trim((string)$data['session_token']) : null;
if ($cartId === null && $sessionTokenInput === null && !$user) {
    json_error('VALIDATION_ERROR', 'Debe indicar cart_id o session_token.', [], 422);
}

if (!isset($data['product_id']) || !ctype_digit((string)$data['product_id'])) {
    json_error('VALIDATION_ERROR', 'product_id inválido.', ['product_id' => 'Debe ser entero.'], 422);
}
$productId = (int)$data['product_id'];
$quantity = normalize_quantity($data['quantity'] ?? null);

$pdo = get_pdo();

$stmt = $pdo->prepare('SELECT id FROM products WHERE id = :id');
$stmt->execute([':id' => $productId]);
if (!$stmt->fetch()) {
    json_error('VALIDATION_ERROR', 'Producto no encontrado.', ['product_id' => 'No existe.'], 422);
}

$pdo->beginTransaction();
try {
    if ($cartId !== null) {
        $cart = ensure_cart($pdo, $cartId, null);
        $sessionToken = $cart['session_token'];
    } elseif ($user) {
        $stmt = $pdo->prepare("SELECT id, session_token, status FROM carts WHERE user_id = :uid AND status = 'active' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([':uid' => (int)$user['id']]);
        $cart = $stmt->fetch();
        if ($cart) {
            $cartId = (int)$cart['id'];
            $sessionToken = $cart['session_token'];
        } else {
            $stmt = $pdo->prepare('INSERT INTO carts (user_id, session_token, status, created_at, updated_at) VALUES (:uid, NULL, "active", NOW(), NOW())');
            $stmt->execute([':uid' => (int)$user['id']]);
            $cartId = (int)$pdo->lastInsertId();
            $sessionToken = null;
        }
    } else {
        $sessionToken = resolve_session_token($sessionTokenInput);
        $stmt = $pdo->prepare("SELECT id FROM carts WHERE session_token = :token AND status = 'active' LIMIT 1");
        $stmt->execute([':token' => $sessionToken]);
        $cart = $stmt->fetch();
        if ($cart) {
            $cartId = (int)$cart['id'];
        } else {
            $stmt = $pdo->prepare('INSERT INTO carts (user_id, session_token, status, created_at, updated_at) VALUES (NULL, :token, "active", NOW(), NOW())');
            $stmt->execute([':token' => $sessionToken]);
            $cartId = (int)$pdo->lastInsertId();
        }
    }

    $stmt = $pdo->prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (:cart_id, :product_id, :quantity) '
        . 'ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)');
    $stmt->execute([
        ':cart_id' => $cartId,
        ':product_id' => $productId,
        ':quantity' => $quantity,
    ]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

$stmt = $pdo->prepare('SELECT ci.id, ci.cart_id, ci.product_id, ci.quantity, p.name, p.brand, p.unit, p.size '
    . 'FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = :cart_id AND ci.product_id = :product_id');
$stmt->execute([':cart_id' => $cartId, ':product_id' => $productId]);
$item = $stmt->fetch();

json_success([
    'cart_id' => $cartId,
    'session_token' => $sessionToken,
    'item' => $item,
]);

