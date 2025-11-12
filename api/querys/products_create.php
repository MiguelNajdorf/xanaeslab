<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
require_admin();

$data = read_json_input();
validate_required($data, [
    'name' => 'string',
    'unit' => 'string',
    'size' => 'string',
    'category_id' => 'int',
]);

$pdo = get_pdo();

$stmt = $pdo->prepare('SELECT id FROM categories WHERE id = :id');
$stmt->execute([':id' => (int)$data['category_id']]);
if (!$stmt->fetch()) {
    json_error('VALIDATION_ERROR', 'Categoría inválida.', ['category_id' => 'No existe.'], 422);
}

if (!empty($data['barcode'])) {
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM products WHERE barcode = :barcode');
    $stmt->execute([':barcode' => $data['barcode']]);
    if ((int)$stmt->fetchColumn() > 0) {
        json_error('VALIDATION_ERROR', 'El código de barras ya existe.', ['barcode' => 'Duplicado'], 422);
    }
}

$sql = 'INSERT INTO products (name, brand, barcode, unit, size, category_id, created_at, updated_at) '
    . 'VALUES (:name, :brand, :barcode, :unit, :size, :category_id, NOW(), NOW())';
$stmt = $pdo->prepare($sql);
$stmt->execute([
    ':name' => trim((string)$data['name']),
    ':brand' => isset($data['brand']) && $data['brand'] !== null ? trim((string)$data['brand']) : null,
    ':barcode' => isset($data['barcode']) && $data['barcode'] !== '' ? trim((string)$data['barcode']) : null,
    ':unit' => trim((string)$data['unit']),
    ':size' => trim((string)$data['size']),
    ':category_id' => (int)$data['category_id'],
]);

$id = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare('SELECT p.id, p.name, p.brand, p.barcode, p.unit, p.size, p.category_id, p.created_at, p.updated_at, '
    . 'c.name AS category_name, c.slug AS category_slug FROM products p '
    . 'LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = :id');
$stmt->execute([':id' => $id]);
$product = $stmt->fetch();

json_success(['product' => $product], 201);

