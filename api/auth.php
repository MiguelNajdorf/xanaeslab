<?php

declare(strict_types=1);

require_once __DIR__ . '/querys/config.php';

function fetch_user_from_claims(array $claims): ?array
{
    if (!isset($claims['sub'])) {
        return null;
    }

    $userId = (int)$claims['sub'];
    if ($userId <= 0) {
        return null;
    }

    $pdo = get_pdo();
    $stmt = $pdo->prepare('SELECT id, email, role, is_active, token_version, created_at, updated_at, last_login_at FROM users WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $userId]);
    $user = $stmt->fetch();

    if (!$user || !(bool)$user['is_active']) {
        return null;
    }

    if (!isset($claims['token_version']) || (int)$user['token_version'] !== (int)$claims['token_version']) {
        return null;
    }

    unset($user['token_version']);

    return $user;
}

function current_user(): ?array
{
    $token = get_bearer_token();
    if ($token === null) {
        return null;
    }

    try {
        $claims = token_verify($token);
    } catch (Throwable $e) {
        return null;
    }

    return fetch_user_from_claims($claims);
}

function require_user_auth(): array
{
    $token = get_bearer_token();
    if ($token === null) {
        json_error('UNAUTHENTICATED', 'Debe iniciar sesión.', [], 401);
    }

    try {
        $claims = token_verify($token);
    } catch (Throwable $e) {
        json_error('UNAUTHENTICATED', 'Debe iniciar sesión.', ['reason' => $e->getMessage()], 401);
        return [];
    }

    $user = fetch_user_from_claims($claims);
    if (!$user) {
        json_error('UNAUTHENTICATED', 'Debe iniciar sesión.', [], 401);
    }

    return $user;
}

function require_admin(): array
{
    $user = require_user_auth();
    if (($user['role'] ?? null) !== 'admin') {
        json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
    }

    return $user;
}

function require_authenticated(): array
{
    return require_user_auth();
}
