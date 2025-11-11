<?php
// Database configuration and common helpers

declare(strict_types=1);

const DB_HOST = 'localhost';
const DB_NAME = 'adev_xanaeslab';
const DB_USER = 'adev_xanaeslab';
const DB_PASS = 'YermanFerozo768';
const DB_CHARSET = 'utf8mb4';

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
    error_log('API error: ' . $e->getMessage());
    json_error('INTERNAL_ERROR', 'Ha ocurrido un error inesperado.', [], 500);
});

