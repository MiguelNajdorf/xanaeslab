<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['POST']);
require_admin();

$data = read_json_input();

// Validate required fields
if (empty($data['name'])) {
    json_error('VALIDATION_ERROR', 'El nombre del producto es obligatorio', [], 400);
}

$name = trim($data['name']);
$brand = trim($data['brand'] ?? '');
$unit = trim($data['unit'] ?? 'u');
$size = trim($data['size'] ?? '1');
$categoryId = (int)($data['category_id'] ?? 0);
$categoryName = trim($data['category_name'] ?? '');

$pdo = get_pdo();

try {
    $pdo->beginTransaction();

    // 1. Handle Category
    if ($categoryId <= 0 && !empty($categoryName)) {
        // Check if category exists by name
        $stmt = $pdo->prepare('SELECT id FROM categories WHERE name = :name LIMIT 1');
        $stmt->execute([':name' => $categoryName]);
        $existingCat = $stmt->fetch();

        if ($existingCat) {
            $categoryId = (int)$existingCat['id'];
        } else {
            // Create new category
            $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $categoryName)));
            $stmt = $pdo->prepare('INSERT INTO categories (name, slug) VALUES (:name, :slug)');
            $stmt->execute([':name' => $categoryName, ':slug' => $slug]);
            $categoryId = (int)$pdo->lastInsertId();
        }
    }

    if ($categoryId <= 0) {
        throw new Exception('Debe seleccionar una categoría existente o ingresar una nueva.');
    }

    // 2. Handle Brand (if provided)
    $brandId = null;
    if (!empty($brand)) {
        // Check if brand exists
        $stmt = $pdo->prepare('SELECT id FROM brands WHERE name = :name LIMIT 1');
        $stmt->execute([':name' => $brand]);
        $existingBrand = $stmt->fetch();

        if ($existingBrand) {
            $brandId = (int)$existingBrand['id'];
        } else {
            // Create new brand
            $brandSlug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $brand)));
            $stmt = $pdo->prepare('INSERT INTO brands (name, slug) VALUES (:name, :slug)');
            $stmt->execute([':name' => $brand, ':slug' => $brandSlug]);
            $brandId = (int)$pdo->lastInsertId();
        }
    }

    // 3. Create Product
    // Check for duplicate product name to avoid error
    $stmt = $pdo->prepare('SELECT id FROM products WHERE name = :name LIMIT 1');
    $stmt->execute([':name' => $name]);
    if ($stmt->fetch()) {
        throw new Exception('Ya existe un producto con este nombre.');
    }

    $stmt = $pdo->prepare('
        INSERT INTO products (name, brand, brand_id, unit, size, category_id) 
        VALUES (:name, :brand, :brand_id, :unit, :size, :category_id)
    ');
    
    $stmt->execute([
        ':name' => $name,
        ':brand' => $brand ?: null,
        ':brand_id' => $brandId,
        ':unit' => $unit,
        ':size' => $size,
        ':category_id' => $categoryId
    ]);

    $newProductId = (int)$pdo->lastInsertId();

    $pdo->commit();

    json_success([
        'id' => $newProductId,
        'name' => $name,
        'category_id' => $categoryId,
        'message' => 'Producto creado exitosamente'
    ]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('PROCESSING_ERROR', $e->getMessage(), [], 400);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_error('INTERNAL_ERROR', 'Error del servidor: ' . $e->getMessage(), [], 500);
}
