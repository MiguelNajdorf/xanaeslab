<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

require_http_method(['GET']);

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', [], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT * FROM brands WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$brand = $stmt->fetch();

if (!$brand) {
    json_error('NOT_FOUND', 'Marca no encontrada.', [], 404);
}

json_success(['brand' => $brand]);
