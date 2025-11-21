<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

// Script para migrar la base de datos: Crear tabla brands y vincular productos
// Se puede ejecutar visitando este archivo en el navegador o por CLI.

header('Content-Type: text/plain');

try {
    $pdo = get_pdo();
    echo "Iniciando migración de marcas...\n";

    // 1. Crear tabla brands
    $sql = "CREATE TABLE IF NOT EXISTS brands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        slug VARCHAR(191) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_name (name),
        UNIQUE KEY unique_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "Tabla 'brands' creada o ya existente.\n";

    // 2. Agregar columna brand_id a products si no existe
    // Verificamos si existe primero
    $stmt = $pdo->query("SHOW COLUMNS FROM products LIKE 'brand_id'");
    if (!$stmt->fetch()) {
        $pdo->exec("ALTER TABLE products ADD COLUMN brand_id INT DEFAULT NULL AFTER brand");
        $pdo->exec("ALTER TABLE products ADD CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL");
        echo "Columna 'brand_id' agregada a 'products'.\n";
    } else {
        echo "Columna 'brand_id' ya existe en 'products'.\n";
    }

    // 3. Migrar datos: Extraer marcas únicas de products e insertar en brands
    $stmt = $pdo->query("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != ''");
    $brands = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $migrated = 0;
    foreach ($brands as $brandName) {
        $brandName = trim($brandName);
        if ($brandName === '') continue;

        $slug = slugify($brandName);
        
        // Insertar marca si no existe (ignorando duplicados por si se corre varias veces)
        $stmtInsert = $pdo->prepare("INSERT IGNORE INTO brands (name, slug, created_at, updated_at) VALUES (:name, :slug, NOW(), NOW())");
        $stmtInsert->execute([':name' => $brandName, ':slug' => $slug]);
        
        // Obtener ID de la marca (ya sea insertada o existente)
        $stmtGet = $pdo->prepare("SELECT id FROM brands WHERE name = :name");
        $stmtGet->execute([':name' => $brandName]);
        $brandId = $stmtGet->fetchColumn();

        if ($brandId) {
            // Actualizar productos
            $stmtUpdate = $pdo->prepare("UPDATE products SET brand_id = :brand_id WHERE brand = :brand AND (brand_id IS NULL OR brand_id = 0)");
            $stmtUpdate->execute([':brand_id' => $brandId, ':brand' => $brandName]);
            $migrated++;
        }
    }

    echo "Migración de datos completada. Marcas procesadas: $migrated\n";
    echo "NOTA: La columna 'brand' original en 'products' NO ha sido eliminada por seguridad. Verificar datos antes de borrarla manualmente.\n";

} catch (PDOException $e) {
    die("Error en la migración: " . $e->getMessage());
}
