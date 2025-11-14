<?php
// Database configuration and common helpers

declare(strict_types=1);

// --------------------------------------------------
// CORS headers (replicates login.php behaviour)
// --------------------------------------------------
if (!defined('XANAESLAB_CORS_APPLIED')) {
    $allowedOrigin = 'http://xanaeslab.local';

    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Authorization');    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    define('XANAESLAB_CORS_APPLIED', true);
}

const DB_HOST = 'localhost';
const DB_NAME = 'adev_xanaeslab';
const DB_USER = 'adev_xanaeslab';
const DB_PASS = 'YermanFerozo768';
const DB_CHARSET = 'utf8mb4';

/**
 * Token configuration (shared helpers expect these globals).
 */
$TOKEN_SECRET = (string)($_ENV['TOKEN_SECRET'] ?? getenv('TOKEN_SECRET') ?? 'cambia-esto-por-una-clave-larga-aleatoria-32bytes-min');
if ($TOKEN_SECRET === '') {
    $TOKEN_SECRET = 'cambia-esto-por-una-clave-larga-aleatoria-32bytes-min';
}
$TOKEN_ISS = 'xanaeslab-api';
$TOKEN_AUD = 'xanaeslab-client';
$ACCESS_TTL = 900; // 15 minutes
$REFRESH_TTL = 1209600; // 14 days

function get_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function b64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder > 0) {
        $data .= str_repeat('=', 4 - $remainder);
    }

    $decoded = base64_decode(strtr($data, '-_', '+/'), true);
    if ($decoded === false) {
        throw new RuntimeException('Base64URL inválido.');
    }

    return $decoded;
}

function token_sign(array $claims, ?int $ttl = null): string
{
    global $TOKEN_SECRET, $TOKEN_ISS, $TOKEN_AUD, $ACCESS_TTL;

    if ($TOKEN_SECRET === '') {
        throw new RuntimeException('TOKEN_SECRET no configurado.');
    }

    $header = ['alg' => 'HS256', 'typ' => 'JWT'];

    $now = time();
    $ttl = $ttl ?? $ACCESS_TTL;
    $payload = $claims + [
        'iss' => $claims['iss'] ?? $TOKEN_ISS,
        'aud' => $claims['aud'] ?? $TOKEN_AUD,
        'iat' => $claims['iat'] ?? $now,
        'nbf' => $claims['nbf'] ?? $now,
        'exp' => $claims['exp'] ?? ($ttl > 0 ? $now + $ttl : $now),
    ];

    $segments = [];
    foreach ([$header, $payload] as $segment) {
        $json = json_encode($segment, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new RuntimeException('No se pudo codificar el token.');
        }
        $segments[] = b64url_encode($json);
    }

    $signature = hash_hmac('sha256', implode('.', $segments), $TOKEN_SECRET, true);
    $segments[] = b64url_encode($signature);

    return implode('.', $segments);
}

function token_verify(string $token): array
{
    global $TOKEN_SECRET, $TOKEN_ISS, $TOKEN_AUD;

    if ($TOKEN_SECRET === '') {
        throw new RuntimeException('TOKEN_SECRET no configurado.');
    }

    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new RuntimeException('Token con formato inválido.');
    }

    [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

    $headerJson = b64url_decode($encodedHeader);
    $payloadJson = b64url_decode($encodedPayload);
    $signature = b64url_decode($encodedSignature);

    $header = json_decode($headerJson, true);
    $payload = json_decode($payloadJson, true);

    if (!is_array($header) || !is_array($payload)) {
        throw new RuntimeException('Token inválido.');
    }

    if (($header['alg'] ?? '') !== 'HS256') {
        throw new RuntimeException('Algoritmo no soportado.');
    }

    $expectedSignature = hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, $TOKEN_SECRET, true);
    if (!hash_equals($expectedSignature, $signature)) {
        throw new RuntimeException('Firma inválida.');
    }

    $now = time();

    if (($payload['iss'] ?? null) !== $TOKEN_ISS) {
        throw new RuntimeException('Emisor inválido.');
    }

    if (($payload['aud'] ?? null) !== $TOKEN_AUD) {
        throw new RuntimeException('Audiencia inválida.');
    }

    if (isset($payload['nbf']) && $now < (int)$payload['nbf']) {
        throw new RuntimeException('Token no vigente.');
    }

    if (isset($payload['exp']) && $now >= (int)$payload['exp']) {
        throw new RuntimeException('Token expirado.');
    }

    return $payload;
}

/* function get_bearer_token(): ?string
{
    // --- INICIO DE DEBUG ---
    error_log('--- DEPURACIÓN get_bearer_token() ---');
    error_log('Contenido de $_SERVER[\'HTTP_AUTHORIZATION\']: ' . ($_SERVER['HTTP_AUTHORIZATION'] ?? 'NULL'));
    error_log('Contenido de $_SERVER[\'HTTP_X_AUTHORIZATION\']: ' . ($_SERVER['HTTP_X_AUTHORIZATION'] ?? 'NULL'));
    // --- FIN DE DEBUG ---

    // 1. Intenta con la cabecera estándar primero
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? '';
    if (is_string($header) && $header !== '') {
        if (preg_match('/^Bearer\s+(\S+)$/i', trim($header), $matches)) {
            error_log('Token encontrado en cabecera estándar.');
            return $matches[1];
        }
    }

    // 2. Si no funciona, intenta con nuestra cabecera personalizada
    $customHeader = $_SERVER['HTTP_X_AUTHORIZATION'] ?? '';
    if (is_string($customHeader) && $customHeader !== '') {
        if (preg_match('/^Bearer\s+(\S+)$/i', trim($customHeader), $matches)) {
            error_log('Token encontrado en cabecera personalizada X-Authorization.');
            return $matches[1];
        }
    }

    error_log('--- get_bearer_token() DEVOLVIÓ NULL ---');
    // 3. Si no se encuentra en ninguna parte, devuelve null
    return null;
} */
function get_bearer_token(): ?string
{
    // 1. Intenta con la cabecera estándar primero
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? '';
    if (is_string($header) && $header !== '') {
        if (preg_match('/^Bearer\s+(\S+)$/i', trim($header), $matches)) {
            return $matches[1];
        }
    }

    // 2. Si no funciona, intenta con nuestra cabecera personalizada
    $customHeader = $_SERVER['HTTP_X_AUTHORIZATION'] ?? '';
    if (is_string($customHeader) && $customHeader !== '') {
        if (preg_match('/^Bearer\s+(\S+)$/i', trim($customHeader), $matches)) {
            return $matches[1];
        }
    }

    // 3. Si no se encuentra en ninguna parte, devuelve null
    return null;
}
function json_response(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_success($data = null, int $status = 200): void
{
    $payload = ['ok' => true];
    if ($data !== null) {
        $payload['data'] = $data;
    }
    json_response($status, $payload);
}

function json_error(string $code, string $message, array $details = [], int $status = 400): void
{
    json_response($status, [
        'ok' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
            'details' => $details,
        ],
    ]);
}

function read_json_input(): array
{
    $input = file_get_contents('php://input');
    if ($input === false || $input === '') {
        return [];
    }

    $data = json_decode($input, true);
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($data)) {
        json_error('INVALID_JSON', 'El cuerpo de la solicitud debe ser JSON válido.', [], 400);
    }

    return $data;
}

function require_http_method(array $allowed): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        json_error('METHOD_NOT_ALLOWED', 'Método HTTP no permitido.', [], 405);
    }
}

function get_query_param(string $key, $default = null)
{
    return $_GET[$key] ?? $default;
}

function slugify(string $value): string
{
    $value = strtolower(trim($value));
    $transliterated = iconv('UTF-8', 'ASCII//TRANSLIT', $value);
    if ($transliterated !== false) {
        $value = $transliterated;
    }
    $value = preg_replace('/[^a-z0-9]+/i', '-', $value);
    $value = trim($value ?? '', '-');
    return $value === '' ? '' : $value;
}

function validate_required(array $data, array $required): array
{
    $errors = [];
    foreach ($required as $field => $rule) {
        $value = $data[$field] ?? null;
        if ($rule === 'string') {
            if (!is_string($value) || trim($value) === '') {
                $errors[$field] = 'Debe ser un texto no vacío.';
            }
        } elseif ($rule === 'int') {
            if (!is_int($value) && !(is_string($value) && ctype_digit($value))) {
                $errors[$field] = 'Debe ser un número entero.';
            }
        } elseif ($rule === 'float') {
            if (!is_numeric($value)) {
                $errors[$field] = 'Debe ser un número.';
            }
        } elseif ($rule === 'array') {
            if (!is_array($value)) {
                $errors[$field] = 'Debe ser un arreglo.';
            }
        } elseif ($rule === 'bool') {
            if (!is_bool($value)) {
                $errors[$field] = 'Debe ser booleano.';
            }
        }
    }

    if (!empty($errors)) {
        json_error('VALIDATION_ERROR', 'Datos inválidos.', $errors, 422);
    }

    return $data;
}

function decimal_value($value, int $decimals = 2): string
{
    if (!is_numeric($value)) {
        json_error('VALIDATION_ERROR', 'Valor numérico inválido.', [], 422);
    }
    $number = number_format((float)$value, $decimals, '.', '');
    if ((float)$number < 0) {
        json_error('VALIDATION_ERROR', 'El valor no puede ser negativo.', [], 422);
    }
    return $number;
}

function parse_pagination(): array
{
    $page = (int)max(1, (int)get_query_param('page', 1));
    $limit = (int)get_query_param('limit', 20);
    if ($limit < 1) {
        $limit = 20;
    }
    if ($limit > 100) {
        $limit = 100;
    }
    $offset = ($page - 1) * $limit;
    return [$limit, $offset, $page];
}

function boolval_from_param($value): ?bool
{
    if ($value === null) {
        return null;
    }
    if (is_bool($value)) {
        return $value;
    }
    $value = strtolower((string)$value);
    if (in_array($value, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }
    if (in_array($value, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }
    return null;
}

function send_validation_error(array $errors): void
{
    json_error('VALIDATION_ERROR', 'Datos inválidos.', $errors, 422);
}

set_exception_handler(function (Throwable $e): void {
    error_log(sprintf('API error: %s in %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));

    $details = [
        'exception' => [
            'type' => get_class($e),
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ],
    ];

    $trace = $e->getTraceAsString();
    if ($trace !== '') {
        $details['exception']['trace'] = explode("\n", $trace);
    }

    json_error(
        'INTERNAL_ERROR',
        'Ha ocurrido un error inesperado: ' . $e->getMessage(),
        $details,
        500
    );
});

