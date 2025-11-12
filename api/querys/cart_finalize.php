<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/cart_helpers.php';

require_http_method(['POST']);

start_session_if_needed();
$user = current_user();
$data = read_json_input();

$cartId = isset($data['cart_id']) ? (int)$data['cart_id'] : null;
$sessionToken = isset($data['session_token']) ? trim((string)$data['session_token']) : null;

$pdo = get_pdo();

if ($cartId) {
    $cart = ensure_cart($pdo, $cartId, null);
} elseif ($sessionToken) {
    $cart = find_cart($pdo, null, $sessionToken, true);
    if (!$cart) {
        json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
    }
    $cartId = (int)$cart['id'];
} elseif ($user) {
    $stmt = $pdo->prepare("SELECT id, status FROM carts WHERE user_id = :uid AND status = 'active' ORDER BY created_at DESC LIMIT 1");
    $stmt->execute([':uid' => (int)$user['id']]);
    $cart = $stmt->fetch();
    if (!$cart) {
        json_error('NOT_FOUND', 'No hay carrito activo.', [], 404);
    }
    $cartId = (int)$cart['id'];
} else {
    json_error('VALIDATION_ERROR', 'Debe indicar cart_id o session_token.', [], 422);
}

if ($cart['status'] !== 'active') {
    json_error('VALIDATION_ERROR', 'El carrito no está activo.', [], 422);
}

$stmt = $pdo->prepare('UPDATE carts SET status = :status, updated_at = NOW() WHERE id = :id');
$stmt->execute([':status' => 'finalized', ':id' => $cartId]);

json_success(['cart_id' => $cartId, 'status' => 'finalized']);

