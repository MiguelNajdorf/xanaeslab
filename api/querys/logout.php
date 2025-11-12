<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);

$data = read_json_input();

$refreshToken = null;
if (array_key_exists('refreshToken', $data)) {
    $tokenValue = $data['refreshToken'];
    if (is_string($tokenValue)) {
        $tokenValue = trim($tokenValue);
    }

    if (is_string($tokenValue) && $tokenValue !== '') {
        $refreshToken = $tokenValue;
    }
}

if ($refreshToken !== null) {
    $pdo = get_pdo();

    $stmt = $pdo->prepare(
        'SELECT id, token_hash
         FROM refresh_tokens
         WHERE revoked_at IS NULL'
    );
    $stmt->execute();

    $matchedId = null;
    while ($row = $stmt->fetch()) {
        if (password_verify($refreshToken, (string)$row['token_hash'])) {
            $matchedId = (int)$row['id'];
            break;
        }
    }

    if ($matchedId !== null) {
        $update = $pdo->prepare(
            'UPDATE refresh_tokens
             SET revoked_at = NOW()
             WHERE id = :id AND revoked_at IS NULL'
        );
        $update->execute([':id' => $matchedId]);
    }
}

json_success(['message' => 'ok']);

