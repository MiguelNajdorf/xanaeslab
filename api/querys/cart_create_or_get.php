<?php

declare(strict_types=1);

require_once __DIR__ . '/cart_helpers.php';

require_http_method(['POST']);

$user = current_user();
$data = read_json_input();
$sessionTokenInput = isset($data['session_token']) ? trim((string)$data['session_token']) : null;

$pdo = get_pdo();
$pdo->beginTransaction();
try {
    if ($user) {
        $stmt = $pdo->prepare("SELECT id, user_id, session_token, status FROM carts WHERE user_id = :uid AND status = 'active' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([':uid' => (int)$user['id']]);
        $cart = $stmt->fetch();
        if (!$cart) {
            $stmt = $pdo->prepare('INSERT INTO carts (user_id, session_token, status, created_at, updated_at) VALUES (:user_id, NULL, "active", NOW(), NOW())');
            $stmt->execute([':user_id' => (int)$user['id']]);
            $cartId = (int)$pdo->lastInsertId();
            $sessionToken = null;
        } else {
            $cartId = (int)$cart['id'];
            $sessionToken = $cart['session_token'];
        }
    } else {
        $sessionToken = resolve_session_token($sessionTokenInput);
        $stmt = $pdo->prepare("SELECT id, user_id, session_token, status FROM carts WHERE session_token = :token AND status = 'active' LIMIT 1");
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
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}

json_success([
    'cart_id' => $cartId,
    'session_token' => $sessionToken,
    'user_id' => $user ? (int)$user['id'] : null,
]);

