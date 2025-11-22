<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

// Increase time limit for large files
set_time_limit(300); 
ini_set('memory_limit', '256M');

require_http_method(['POST']);
// require_admin(); // Uncomment if admin auth is required

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    json_error('UPLOAD_ERROR', 'Error al subir el archivo', [], 400);
}

$file = $_FILES['file']['tmp_name'];
$handle = fopen($file, 'r');

if (!$handle) {
    json_error('FILE_ERROR', 'No se pudo abrir el archivo', [], 500);
}

$pdo = get_pdo();
$stats = [
    'total_processed' => 0,
    'inserted' => 0,
    'skipped' => 0, // Duplicates
    'errors' => 0,
    'new_brands' => 0
];

// Cache for brands to avoid repeated DB queries
$brandsCache = [];

// Load existing brands into cache
$stmt = $pdo->query("SELECT id, name FROM brands");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $brandsCache[strtoupper($row['name'])] = $row['id'];
}

// Prepare statements
$stmtCheckProduct = $pdo->prepare('SELECT id FROM products WHERE barcode = :barcode LIMIT 1');
$stmtInsertBrand = $pdo->prepare('INSERT INTO brands (name, slug) VALUES (:name, :slug)');
$stmtInsertProduct = $pdo->prepare('
    INSERT INTO products (name, brand, brand_id, unit, size, barcode, category_id, created_at, updated_at) 
    VALUES (:name, :brand, :brand_id, :unit, :size, :barcode, :category_id, NOW(), NOW())
');

// Default Category (create if not exists, or use ID 1)
// For now, we'll assume category_id = 1 is "General" or "Sin Categoría"
$defaultCategoryId = 1; 

try {
    $pdo->beginTransaction();

    // Skip header if present (heuristic: check if first col is 'id_comercio')
    $firstLine = fgets($handle);
    if (strpos($firstLine, 'id_comercio') === false) {
        rewind($handle); // Not a header, reset pointer
    }

    while (($line = fgets($handle)) !== false) {
        $stats['total_processed']++;
        $data = explode('|', trim($line));

        // Expected format:
        // 0: id_comercio
        // 1: id_bandera
        // 2: id_sucursal
        // 3: id_producto (BARCODE)
        // 4: productos_ean
        // 5: productos_descripcion (NAME)
        // 6: productos_cantidad_presentacion
        // 7: productos_unidad_medida_presentacion
        // 8: productos_marca (BRAND)
        // 9: productos_precio_lista
        // 10: productos_precio_referencia
        // 11: productos_cantidad_referencia (SIZE)
        // 12: productos_unidad_medida_referencia (UNIT)

        if (count($data) < 13) {
            $stats['errors']++;
            continue;
        }

        $barcode = trim($data[3]);
        $rawName = trim($data[5]);
        $rawBrand = trim($data[8]);
        $rawSize = trim($data[11]);
        $rawUnit = trim($data[12]);

        if (empty($barcode) || empty($rawName)) {
            $stats['errors']++;
            continue;
        }

        // 1. Check if product exists by barcode
        $stmtCheckProduct->execute([':barcode' => $barcode]);
        if ($stmtCheckProduct->fetch()) {
            $stats['skipped']++;
            continue;
        }

        // 2. Normalize Unit
        $unit = strtolower($rawUnit);
        switch ($unit) {
            case 'uni': $unit = 'u'; break;
            case 'grm': $unit = 'g'; break;
            case 'cm3': 
            case 'cc':  $unit = 'ml'; break;
            case 'lt':  $unit = 'lt'; break;
            case 'kg':  $unit = 'kg'; break;
            default:    $unit = 'u'; break; // Default to unit if unknown
        }

        // 3. Handle Brand
        $brandName = strtoupper($rawBrand);
        if ($brandName === 'S/D' || empty($brandName)) {
            $brandName = 'GENERICO';
        }

        if (isset($brandsCache[$brandName])) {
            $brandId = $brandsCache[$brandName];
        } else {
            // Create new brand
            $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $brandName)));
            $stmtInsertBrand->execute([':name' => $brandName, ':slug' => $slug]);
            $brandId = $pdo->lastInsertId();
            $brandsCache[$brandName] = $brandId;
            $stats['new_brands']++;
        }

        // 4. Clean Name
        // Remove " X 500 GRS", " X 1 LT", etc. from the end of the name
        // Regex looks for " X " followed by digits and then anything to the end
        $cleanName = preg_replace('/\s+X\s+\d+.*$/i', '', $rawName);
        $cleanName = trim($cleanName);

        // 5. Insert Product
        $stmtInsertProduct->execute([
            ':name' => $cleanName,
            ':brand' => $brandName, // Store brand name as text too for redundancy/display
            ':brand_id' => $brandId,
            ':unit' => $unit,
            ':size' => $rawSize, // Keep original number
            ':barcode' => $barcode,
            ':category_id' => $defaultCategoryId
        ]);

        $stats['inserted']++;
    }

    $pdo->commit();
    fclose($handle);

    json_success($stats);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fclose($handle);
    json_error('IMPORT_ERROR', $e->getMessage(), ['stats' => $stats], 500);
}
