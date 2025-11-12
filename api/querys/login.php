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
    'SELECT id, email, password_hash, role, is_active, token_version
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

// ---------- Update last login ----------
$pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id')
    ->execute([':id' => $user['id']]);

// ---------- JWT & Refresh Token ----------
global $TOKEN_ISS, $TOKEN_AUD, $ACCESS_TTL, $REFRESH_TTL;

$now = time();
$tokenVersion = (int)($user['token_version'] ?? 0);

$accessPayload = [
    'iss'  => $TOKEN_ISS,
    'aud'  => $TOKEN_AUD,
    'iat'  => $now,
    'nbf'  => $now,
    'exp'  => $now + $ACCESS_TTL,
    'sub'  => (int)$user['id'],
    'role' => (string)$user['role'],
    'token_version' => $tokenVersion,
    'tv'   => $tokenVersion,
];

$accessToken = token_sign($accessPayload, $ACCESS_TTL);

$refreshToken = bin2hex(random_bytes(32));
$refreshHash = password_hash($refreshToken, PASSWORD_DEFAULT);
$expiresAt = date('Y-m-d H:i:s', $now + $REFRESH_TTL);

$userAgent = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
$ipAddress = (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '');
if (strpos($ipAddress, ',') !== false) {
    $parts = array_map('trim', explode(',', $ipAddress));
    $ipAddress = $parts[0] ?? '';
}

$insertRefresh = $pdo->prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (:user_id, :token_hash, :user_agent, :ip_address, :expires_at)'
);
$insertRefresh->execute([
    ':user_id'    => $user['id'],
    ':token_hash' => $refreshHash,
    ':user_agent' => substr($userAgent, 0, 255),
    ':ip_address' => substr($ipAddress, 0, 45),
    ':expires_at' => $expiresAt,
]);

// ---------- Response ----------
json_success([
    'accessToken'  => $accessToken,
    'refreshToken' => $refreshToken,
    'user' => [
        'id'    => (int)$user['id'],
        'email' => (string)$user['email'],
        'role'  => (string)$user['role'],
    ],
]);
