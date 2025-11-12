<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);

$data = read_json_input();
validate_required($data, [
    'refreshToken' => 'string',
]);

$refreshToken = trim((string)$data['refreshToken']);
if ($refreshToken === '') {
    json_error('VALIDATION_ERROR', 'Datos inválidos.', [
        'refreshToken' => 'Debe ser un texto no vacío.',
    ], 422);
}

$pdo = get_pdo();

$stmt = $pdo->prepare(
    'SELECT id, user_id, token_hash, expires_at
     FROM refresh_tokens
     WHERE revoked_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC'
);
$stmt->execute();

$matchedToken = null;
while ($row = $stmt->fetch()) {
    if (password_verify($refreshToken, (string)$row['token_hash'])) {
        $matchedToken = $row;
        break;
    }
}

if (!$matchedToken) {
    json_error('INVALID_REFRESH_TOKEN', 'Refresh token inválido.', [], 401);
}

try {
    $pdo->beginTransaction();

    $tokenStmt = $pdo->prepare(
        'SELECT rt.id, rt.user_id, rt.token_hash, rt.expires_at, rt.revoked_at,
                u.email, u.role, u.is_active, u.token_version
         FROM refresh_tokens rt
         INNER JOIN users u ON u.id = rt.user_id
         WHERE rt.id = :id
         FOR UPDATE'
    );
    $tokenStmt->execute([':id' => $matchedToken['id']]);
    $currentToken = $tokenStmt->fetch();

    if (!$currentToken || $currentToken['revoked_at'] !== null) {
        $pdo->rollBack();
        json_error('INVALID_REFRESH_TOKEN', 'Refresh token inválido.', [], 401);
    }

    if (!password_verify($refreshToken, (string)$currentToken['token_hash'])) {
        $pdo->rollBack();
        json_error('INVALID_REFRESH_TOKEN', 'Refresh token inválido.', [], 401);
    }

    $expiresAt = strtotime((string)$currentToken['expires_at']);
    if ($expiresAt === false || $expiresAt <= time()) {
        $pdo->rollBack();
        json_error('EXPIRED_REFRESH_TOKEN', 'Refresh token expirado.', [], 401);
    }

    if (!(bool)$currentToken['is_active']) {
        $pdo->rollBack();
        json_error('USER_NOT_FOUND', 'Usuario no disponible.', [], 404);
    }

    $revokeStmt = $pdo->prepare(
        'UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE id = :id AND revoked_at IS NULL'
    );
    $revokeStmt->execute([':id' => $currentToken['id']]);

    if ($revokeStmt->rowCount() === 0) {
        $pdo->rollBack();
        json_error('INVALID_REFRESH_TOKEN', 'Refresh token inválido.', [], 401);
    }

    global $TOKEN_ISS, $TOKEN_AUD, $ACCESS_TTL, $REFRESH_TTL;

    $now = time();
    $tokenVersion = (int)($currentToken['token_version'] ?? 0);

    $accessPayload = [
        'iss'            => $TOKEN_ISS,
        'aud'            => $TOKEN_AUD,
        'iat'            => $now,
        'nbf'            => $now,
        'exp'            => $now + $ACCESS_TTL,
        'sub'            => (int)$currentToken['user_id'],
        'role'           => (string)$currentToken['role'],
        'token_version'  => $tokenVersion,
        'tv'             => $tokenVersion,
    ];

    $accessToken = token_sign($accessPayload, $ACCESS_TTL);

    $newRefreshToken = bin2hex(random_bytes(32));
    $newRefreshHash = password_hash($newRefreshToken, PASSWORD_DEFAULT);
    $newExpiresAt = date('Y-m-d H:i:s', $now + $REFRESH_TTL);

    $userAgent = (string)($_SERVER['HTTP_USER_AGENT'] ?? '');
    $ipAddress = (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '');
    if (strpos($ipAddress, ',') !== false) {
        $parts = array_map('trim', explode(',', $ipAddress));
        $ipAddress = $parts[0] ?? '';
    }

    $insertStmt = $pdo->prepare(
        'INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip_address, expires_at)
         VALUES (:user_id, :token_hash, :user_agent, :ip_address, :expires_at)'
    );
    $insertStmt->execute([
        ':user_id'    => $currentToken['user_id'],
        ':token_hash' => $newRefreshHash,
        ':user_agent' => substr($userAgent, 0, 255),
        ':ip_address' => substr($ipAddress, 0, 45),
        ':expires_at' => $newExpiresAt,
    ]);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

json_success([
    'accessToken'  => $accessToken,
    'refreshToken' => $newRefreshToken,
    'user' => [
        'id'    => (int)$currentToken['user_id'],
        'email' => (string)$currentToken['email'],
        'role'  => (string)$currentToken['role'],
    ],
]);
