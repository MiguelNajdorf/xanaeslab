<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['PUT', 'PATCH']);
require_admin();

$id = get_query_param('id');
if ($id === null || !ctype_digit((string)$id)) {
    json_error('VALIDATION_ERROR', 'ID inválido.', ['id' => 'Debe ser entero.'], 422);
}

$data = read_json_input();
if (empty($data)) {
    json_error('VALIDATION_ERROR', 'No hay datos para actualizar.', [], 422);
}

$pdo = get_pdo();
$stmt = $pdo->prepare('SELECT * FROM products WHERE id = :id');
$stmt->execute([':id' => (int)$id]);
$product = $stmt->fetch();
if (!$product) {
    json_error('NOT_FOUND', 'Producto no encontrado.', [], 404);
}

$fields = [];
$params = [':id' => (int)$id];

if (isset($data['name'])) {
    if (!is_string($data['name']) || trim($data['name']) === '') {
        send_validation_error(['name' => 'Debe ser texto no vacío.']);
    }
    $fields[] = 'name = :name';
    $params[':name'] = trim((string)$data['name']);
}

foreach (['brand', 'unit', 'size'] as $field) {
    if (array_key_exists($field, $data)) {
        if ($data[$field] !== null && !is_string($data[$field])) {
            send_validation_error([$field => 'Debe ser texto o null.']);
        }
        $fields[] = "$field = :$field";
        $params[":" . $field] = $data[$field] === null ? null : trim((string)$data[$field]);
    }
}

if (array_key_exists('barcode', $data)) {
    if ($data['barcode'] !== null && !is_string($data['barcode'])) {
        send_validation_error(['barcode' => 'Debe ser texto o null.']);
    }
    $barcode = $data['barcode'] === null || $data['barcode'] === '' ? null : trim((string)$data['barcode']);
    if ($barcode !== null) {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM products WHERE barcode = :barcode AND id <> :id');
        $stmt->execute([':barcode' => $barcode, ':id' => (int)$id]);
        if ((int)$stmt->fetchColumn() > 0) {
            json_error('VALIDATION_ERROR', 'El código de barras ya existe.', ['barcode' => 'Duplicado'], 422);
        }
    }
    $fields[] = 'barcode = :barcode';
    $params[':barcode'] = $barcode;
}

if (array_key_exists('category_id', $data)) {
    if ($data['category_id'] === null || !ctype_digit((string)$data['category_id'])) {
        send_validation_error(['category_id' => 'Debe ser entero.']);
    }
    $stmt = $pdo->prepare('SELECT id FROM categories WHERE id = :id');
    $stmt->execute([':id' => (int)$data['category_id']]);
    if (!$stmt->fetch()) {
        json_error('VALIDATION_ERROR', 'Categoría inválida.', ['category_id' => 'No existe.'], 422);
    }
    $fields[] = 'category_id = :category_id';
    $params[':category_id'] = (int)$data['category_id'];
}

if (empty($fields)) {
    json_error('VALIDATION_ERROR', 'No hay campos válidos para actualizar.', [], 422);
}

$fields[] = 'updated_at = NOW()';
$sql = 'UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = :id';
$stmt = $pdo->prepare($sql);
$stmt->execute($params);

$stmt = $pdo->prepare('SELECT p.id, p.name, p.brand, p.barcode, p.unit, p.size, p.category_id, p.created_at, p.updated_at, '
    . 'c.name AS category_name, c.slug AS category_slug FROM products p '
    . 'LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = :id');
$stmt->execute([':id' => (int)$id]);
$product = $stmt->fetch();

json_success(['product' => $product]);

