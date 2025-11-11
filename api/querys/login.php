<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);

$data = read_json_input();
validate_required($data, [
    'email' => 'string',
    'password' => 'string',
]);

$email = strtolower(trim($data['email']));
$password = (string)$data['password'];

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT id, email, password_hash, role, is_active FROM users WHERE email = :email LIMIT 1');
$stmt->execute([':email' => $email]);
$user = $stmt->fetch();

if (!$user || $user['role'] !== 'admin' || !(bool)$user['is_active'] || !password_verify($password, $user['password_hash'])) {
    json_error('INVALID_CREDENTIALS', 'Credenciales inválidas.', [], 401);
}

start_session_if_needed();
session_regenerate_id(true);
$_SESSION['uid'] = (int)$user['id'];
$_SESSION['role'] = $user['role'];

$pdo->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id')->execute([':id' => $user['id']]);

json_success([
    'id' => (int)$user['id'],
    'email' => $user['email'],
    'role' => $user['role'],
]);

