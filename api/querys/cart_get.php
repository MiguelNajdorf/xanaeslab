<?php

declare(strict_types=1);

require_once __DIR__ . '/cart_helpers.php';

require_http_method(['GET']);

$user = current_user();

$cartIdParam = get_query_param('cart_id');
$sessionTokenParam = get_query_param('session_token');

$pdo = get_pdo();

$cartId = null;
$sessionToken = null;

if ($cartIdParam !== null) {
    if (!ctype_digit((string)$cartIdParam)) {
        json_error('VALIDATION_ERROR', 'cart_id inválido.', [], 422);
    }
    $cartId = (int)$cartIdParam;
    $cart = ensure_cart($pdo, $cartId, null);
    $sessionToken = $cart['session_token'];
} elseif ($sessionTokenParam !== null) {
    $sessionToken = trim((string)$sessionTokenParam);
    $cart = find_cart($pdo, null, $sessionToken, false);
    if (!$cart) {
        json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
    }
    $cartId = (int)$cart['id'];
} elseif ($user) {
    $stmt = $pdo->prepare("SELECT id, user_id, session_token, status, created_at, updated_at FROM carts WHERE user_id = :uid AND status = 'active' ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([':uid' => (int)$user['id']]);
    $cart = $stmt->fetch();
    if (!$cart) {
        json_success(['cart' => null, 'items' => []]);
    }
    $cartId = (int)$cart['id'];
    $sessionToken = $cart['session_token'];
} else {
    json_error('VALIDATION_ERROR', 'Debe indicar cart_id o session_token.', [], 422);
}

$stmt = $pdo->prepare('SELECT c.id, c.user_id, c.session_token, c.status, c.created_at, c.updated_at FROM carts c WHERE c.id = :id');
$stmt->execute([':id' => $cartId]);
$cart = $stmt->fetch();
if (!$cart) {
    json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
}

$stmt = $pdo->prepare('SELECT ci.id, ci.product_id, ci.quantity, p.name, p.brand, p.unit, p.size, p.barcode, p.category_id '
    . 'FROM cart_items ci JOIN products p ON p.id = ci.product_id WHERE ci.cart_id = :cart_id');
$stmt->execute([':cart_id' => $cartId]);
$items = $stmt->fetchAll();

json_success([
    'cart' => $cart,
    'items' => $items,
]);

