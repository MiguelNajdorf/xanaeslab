<?php

declare(strict_types=1);

if (!function_exists('is_https')) {
    function is_https(): bool
    {
        if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            return true;
        }
        $xfp = strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '');
        if ($xfp === 'https') {
            return true;
        }
        $xfs = strtolower($_SERVER['HTTP_X_FORWARDED_SSL'] ?? '');
        return $xfs === 'on';
    }
}

if (!defined('API_BOOTSTRAPPED')) {
    define('API_BOOTSTRAPPED', true);

    header('Access-Control-Allow-Origin: http://xanaeslab.local');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    header('Content-Type: application/json; charset=utf-8');

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => is_https(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}
