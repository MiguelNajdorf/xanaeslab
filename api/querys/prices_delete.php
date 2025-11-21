<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

require_http_method(['DELETE']);
require_admin();

$data = read_json_input();
$id = (int)($data['id'] ?? 0);

if ($id <= 0) {
    json_error('ID inválido', 400);
}

// Check if price exists
$stmt = $pdo->prepare('SELECT id FROM prices WHERE id = :id');
$stmt->execute([':id' => $id]);
if (!$stmt->fetch()) {
    json_error('Precio no encontrado', 404);
}

// Delete
$stmt = $pdo->prepare('DELETE FROM prices WHERE id = :id');
$stmt->execute([':id' => $id]);

json_success(['message' => 'Precio eliminado correctamente']);
