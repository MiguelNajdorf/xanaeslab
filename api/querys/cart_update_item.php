<?php

declare(strict_types=1);

require_once __DIR__ . '/cart_helpers.php';

require_http_method(['PATCH']);

$user = current_user();
$data = read_json_input();

$cartId = isset($data['cart_id']) && $data['cart_id'] !== null ? (int)$data['cart_id'] : null;
$sessionToken = isset($data['session_token']) ? trim((string)$data['session_token']) : null;
if ($cartId === null && $sessionToken === null && !$user) {
    json_error('VALIDATION_ERROR', 'Debe indicar cart_id o session_token.', [], 422);
}

if (!isset($data['product_id']) || !ctype_digit((string)$data['product_id'])) {
    json_error('VALIDATION_ERROR', 'product_id inválido.', ['product_id' => 'Debe ser entero.'], 422);
}
$productId = (int)$data['product_id'];

if (!array_key_exists('quantity', $data)) {
    json_error('VALIDATION_ERROR', 'quantity requerido.', ['quantity' => 'Requerido'], 422);
}

$quantityValue = $data['quantity'];
$pdo = get_pdo();

$pdo->beginTransaction();
try {
    if ($cartId !== null) {
        $cart = ensure_cart($pdo, $cartId, null);
        $session = $cart['session_token'];
    } elseif ($user) {
        $stmt = $pdo->prepare("SELECT id, session_token FROM carts WHERE user_id = :uid AND status = 'active' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([':uid' => (int)$user['id']]);
        $cart = $stmt->fetch();
        if (!$cart) {
            json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
        }
        $cartId = (int)$cart['id'];
        $session = $cart['session_token'];
    } else {
        if ($sessionToken === null || $sessionToken === '') {
            json_error('VALIDATION_ERROR', 'session_token requerido para usuarios anónimos.', [], 422);
        }
        $cart = find_cart($pdo, null, $sessionToken, true);
        if (!$cart) {
            json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
        }
        $cartId = (int)$cart['id'];
        $session = $sessionToken;
    }

    if ($quantityValue === 0 || $quantityValue === '0' || $quantityValue === 0.0) {
        $stmt = $pdo->prepare('DELETE FROM cart_items WHERE cart_id = :cart_id AND product_id = :product_id');
        $stmt->execute([':cart_id' => $cartId, ':product_id' => $productId]);
        $pdo->commit();
        json_success([
            'cart_id' => $cartId,
            'session_token' => $session,
            'removed' => true,
        ]);
    }

    $quantity = normalize_quantity($quantityValue);
    $stmt = $pdo->prepare('UPDATE cart_items SET quantity = :quantity WHERE cart_id = :cart_id AND product_id = :product_id');
    $stmt->execute([
        ':quantity' => $quantity,
        ':cart_id' => $cartId,
        ':product_id' => $productId,
    ]);
    if ($stmt->rowCount() === 0) {
        $pdo->rollBack();
        json_error('NOT_FOUND', 'El producto no está en el carrito.', [], 404);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

$stmt = $pdo->prepare('SELECT ci.id, ci.cart_id, ci.product_id, ci.quantity FROM cart_items ci WHERE ci.cart_id = :cart_id AND ci.product_id = :product_id');
$stmt->execute([':cart_id' => $cartId, ':product_id' => $productId]);
$item = $stmt->fetch();

json_success([
    'cart_id' => $cartId,
    'session_token' => $session ?? $sessionToken,
    'item' => $item,
]);

