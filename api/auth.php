<?php

declare(strict_types=1);

require_once __DIR__ . '/querys/config.php';

function start_session_if_needed(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => false,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function current_user(): ?array
{
    start_session_if_needed();
    if (empty($_SESSION['uid'])) {
        return null;
    }

    $pdo = get_pdo();
    $stmt = $pdo->prepare('SELECT id, email, role, is_active, created_at, updated_at, last_login_at FROM users WHERE id = :id');
    $stmt->execute([':id' => $_SESSION['uid']]);
    $user = $stmt->fetch();
    if (!$user || !(bool)$user['is_active']) {
        return null;
    }

    return $user;
}

function require_admin(): array
{
    start_session_if_needed();
    if (empty($_SESSION['uid']) || ($_SESSION['role'] ?? null) !== 'admin') {
        json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
    }

    $user = current_user();
    if (!$user || $user['role'] !== 'admin') {
        json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
    }

    return $user;
}

function require_authenticated(): array
{
    $user = current_user();
    if (!$user) {
        json_error('UNAUTHENTICATED', 'Debe iniciar sesión.', [], 401);
    }
    return $user;
}

