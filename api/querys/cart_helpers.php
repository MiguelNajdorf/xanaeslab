<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

function normalize_quantity($quantity): string
{
    if (!is_numeric($quantity)) {
        json_error('VALIDATION_ERROR', 'Cantidad inválida.', ['quantity' => 'Debe ser numérica.'], 422);
    }
    $value = number_format((float)$quantity, 3, '.', '');
    if ((float)$value <= 0) {
        json_error('VALIDATION_ERROR', 'Cantidad debe ser mayor a cero.', ['quantity' => 'Debe ser > 0'], 422);
    }
    return $value;
}

function find_cart(PDO $pdo, ?int $cartId, ?string $sessionToken, bool $requireActive = true): ?array
{
    $conditions = [];
    $params = [];
    if ($cartId !== null) {
        $conditions[] = 'c.id = :id';
        $params[':id'] = $cartId;
    }
    if ($sessionToken !== null) {
        $conditions[] = 'c.session_token = :session_token';
        $params[':session_token'] = $sessionToken;
    }
    if (empty($conditions)) {
        return null;
    }

    $sql = 'SELECT c.id, c.user_id, c.session_token, c.status, c.created_at, c.updated_at FROM carts c WHERE ' . implode(' OR ', $conditions);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $cart = $stmt->fetch();
    if (!$cart) {
        return null;
    }
    if ($requireActive && $cart['status'] !== 'active') {
        json_error('VALIDATION_ERROR', 'El carrito no está activo.', ['cart' => 'Estado inválido'], 422);
    }
    return $cart;
}

function ensure_cart(PDO $pdo, ?int $cartId, ?string $sessionToken): array
{
    $cart = find_cart($pdo, $cartId, $sessionToken, false);
    if (!$cart) {
        json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
    }
    return $cart;
}

function resolve_session_token(?string $token): string
{
    if ($token !== null && $token !== '') {
        return $token;
    }
    return bin2hex(random_bytes(16));
}

