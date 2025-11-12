<?php

declare(strict_types=1);

require_once __DIR__ . '/querys/config.php';

function start_session_if_needed(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        $sessionId = extract_request_session_id();
        if ($sessionId !== null) {
            session_id($sessionId);
        }
        session_start();
    }
}

function extract_request_session_id(): ?string
{
    $candidates = [];

    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($authHeader, 'Bearer ') === 0) {
        $candidates[] = trim(substr($authHeader, 7));
    }

    if (!empty($_SERVER['HTTP_X_SESSION_ID'])) {
        $candidates[] = (string)$_SERVER['HTTP_X_SESSION_ID'];
    }

    if (!empty($_GET['session_id'])) {
        $candidates[] = (string)$_GET['session_id'];
    }

    if (!empty($_POST['session_id'])) {
        $candidates[] = (string)$_POST['session_id'];
    }

    foreach ($candidates as $candidate) {
        $candidate = trim($candidate);
        if ($candidate === '') {
            continue;
        }

        if (preg_match('/^[a-zA-Z0-9,-]{16,}$/', $candidate) === 1) {
            return $candidate;
        }
    }

    return null;
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

