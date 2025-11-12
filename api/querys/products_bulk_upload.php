<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
$user = require_user_auth();
if (($user['role'] ?? null) !== 'admin') {
    json_error('UNAUTHORIZED', 'Acceso no autorizado.', [], 403);
}

if (empty($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    json_error('VALIDATION_ERROR', 'Archivo CSV requerido (campo file).', [], 422);
}

$file = $_FILES['file'];
if ($file['size'] > 2 * 1024 * 1024) {
    json_error('VALIDATION_ERROR', 'El archivo supera el límite de 2MB.', [], 422);
}

$handle = fopen($file['tmp_name'], 'rb');
if ($handle === false) {
    json_error('INTERNAL_ERROR', 'No se pudo leer el archivo.', [], 500);
}

$header = fgetcsv($handle, 0, ',');
if ($header === false) {
    fclose($handle);
    json_error('VALIDATION_ERROR', 'Archivo CSV vacío.', [], 422);
}

$expected = ['name', 'brand', 'barcode', 'unit', 'size', 'category_slug'];
$header = array_map('trim', $header);
if ($header !== $expected) {
    fclose($handle);
    json_error('VALIDATION_ERROR', 'Encabezados inválidos. Se espera: ' . implode(',', $expected) . '.', [], 422);
}

$pdo = get_pdo();
$inserted = 0;
$updated = 0;
$lineNumber = 1;

$pdo->beginTransaction();
try {
    while (($row = fgetcsv($handle, 0, ',')) !== false) {
        $lineNumber++;
        if (count($row) !== count($expected)) {
            throw new InvalidArgumentException('Cantidad de columnas inválida en línea ' . $lineNumber);
        }
        [$name, $brand, $barcode, $unit, $size, $categorySlug] = array_map('trim', $row);
        if ($name === '' || $unit === '' || $size === '' || $categorySlug === '') {
            throw new InvalidArgumentException('Campos obligatorios faltantes en línea ' . $lineNumber);
        }

        $stmt = $pdo->prepare('SELECT id FROM categories WHERE slug = :slug');
        $stmt->execute([':slug' => slugify($categorySlug)]);
        $category = $stmt->fetch();
        if (!$category) {
            throw new InvalidArgumentException('Categoría no encontrada para slug ' . $categorySlug . ' en línea ' . $lineNumber);
        }
        $categoryId = (int)$category['id'];

        $barcodeValue = $barcode !== '' ? $barcode : null;
        if ($barcodeValue !== null) {
            $stmt = $pdo->prepare('SELECT id FROM products WHERE barcode = :barcode');
            $stmt->execute([':barcode' => $barcodeValue]);
            $existing = $stmt->fetch();
        } else {
            $existing = false;
        }

        if ($existing) {
            $sql = 'UPDATE products SET name = :name, brand = :brand, unit = :unit, size = :size, category_id = :category_id, updated_at = NOW() WHERE id = :id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':name' => $name,
                ':brand' => $brand !== '' ? $brand : null,
                ':unit' => $unit,
                ':size' => $size,
                ':category_id' => $categoryId,
                ':id' => (int)$existing['id'],
            ]);
            $updated++;
        } else {
            $stmt = $pdo->prepare('INSERT INTO products (name, brand, barcode, unit, size, category_id, created_at, updated_at) VALUES (:name, :brand, :barcode, :unit, :size, :category_id, NOW(), NOW())');
            $stmt->execute([
                ':name' => $name,
                ':brand' => $brand !== '' ? $brand : null,
                ':barcode' => $barcodeValue,
                ':unit' => $unit,
                ':size' => $size,
                ':category_id' => $categoryId,
            ]);
            $inserted++;
        }
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fclose($handle);
    if ($e instanceof InvalidArgumentException) {
        json_error('VALIDATION_ERROR', $e->getMessage(), [], 422);
    }
    throw $e;
}

fclose($handle);

json_success([
    'inserted' => $inserted,
    'updated' => $updated,
]);

