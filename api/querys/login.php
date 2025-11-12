<?php
declare(strict_types=1);

/**
 * login.php — Admin login with JSON body, CORS abierto temporalmente (modo debug)
 * No usa cookies cross-site. Ideal para probar desde cualquier dominio.
 */

// ---------- CORS (modo debug, sin credenciales) ----------
// Asegúrate de que el protocolo (http/https) y el puerto (si lo usas) sean correctos.
header("Access-Control-Allow-Origin: http://xanaeslab.local"); 
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true"); // ¡Esta línea sigue siendo CLAVE!
header("Vary: Origin");

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
header('Content-Type: application/json; charset=utf-8');

// ---------- Includes ----------
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

// ---------- Helpers ----------
/** Detect HTTPS even behind proxies */
function is_https(): bool {
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
    $xfp = strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '');
    if ($xfp === 'https') return true;
    $xfs = strtolower($_SERVER['HTTP_X_FORWARDED_SSL'] ?? '');
    return $xfs === 'on';
}

// ---------- Enforce method ----------
require_http_method(['POST']);

// ---------- Read JSON body ----------
$data = read_json_input();
validate_required($data, [
    'email'    => 'string',
    'password' => 'string',
]);

$email = strtolower(trim((string)$data['email']));
$password = (string)$data['password'];

// ---------- DB lookup ----------
$pdo = get_pdo();
$stmt = $pdo->prepare(
    'SELECT id, email, password_hash, role, is_active
     FROM users
     WHERE email = :email
     LIMIT 1'
);
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

// ---------- Validate credentials ----------
$invalid = (
    !$user ||
    $user['role'] !== 'admin' ||
    !(bool)$user['is_active'] ||
    !password_verify($password, $user['password_hash'])
);

if ($invalid) {
    json_error('INVALID_CREDENTIALS', 'Credenciales inválidas.', [], 401);
}

// ---------- Session (solo local, sin cookies cross-site) ----------
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
session_regenerate_id(true);

$_SESSION['uid']  = (int)$user['id'];
$_SESSION['role'] = (string)$user['role'];

// ---------- Update last login ----------
$pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id')
    ->execute([':id' => $user['id']]);

// ---------- Response ----------
json_success([
    'id'    => (int)$user['id'],
    'email' => (string)$user['email'],
    'role'  => (string)$user['role'],
]);
