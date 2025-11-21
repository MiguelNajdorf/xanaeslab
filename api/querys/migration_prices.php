<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== Migración de Precios (Nuevo Sistema con Vigencias) ===\n\n";

try {
    $pdo = get_pdo();
    
    // Step 1: Create promo_types table
    echo "Paso 1: Creando tabla 'promo_types'...\n";
    $sql = "CREATE TABLE IF NOT EXISTS promo_types (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_promo_types_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "  ✓ Tabla 'promo_types' creada.\n\n";
    
    // Insert initial promo types
    echo "Paso 2: Insertando tipos de promoción iniciales...\n";
    $stmt = $pdo->prepare("INSERT IGNORE INTO promo_types (name, description) VALUES (?, ?)");
    $promoTypes = [
        ['2x1', 'Llevando 2 unidades, pagas 1'],
        ['3x2', 'Llevando 3 unidades, pagas 2'],
        ['50% en la 2da unidad', '50% de descuento en la segunda unidad'],
    ];
    
    foreach ($promoTypes as $promo) {
        $stmt->execute($promo);
    }
    echo "  ✓ Tipos de promoción insertados.\n\n";
    
    // Step 3: Create prices table
    echo "Paso 3: Creando tabla 'prices'...\n";
    $sql = "CREATE TABLE IF NOT EXISTS prices (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        supermarket_id INT UNSIGNED NOT NULL,
        product_id INT UNSIGNED NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'ARS',
        valid_from DATE NOT NULL,
        valid_to DATE NULL,
        promo_type_id INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY uq_price_entry (supermarket_id, product_id, valid_from),
        KEY idx_prices_valid_range (valid_from, valid_to),
        KEY idx_prices_supermarket (supermarket_id),
        KEY idx_prices_product (product_id),
        KEY idx_prices_promo_type (promo_type_id),
        
        CONSTRAINT fk_prices_supermarket FOREIGN KEY (supermarket_id) 
            REFERENCES supermarkets(id) ON DELETE CASCADE,
        CONSTRAINT fk_prices_product FOREIGN KEY (product_id) 
            REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_prices_promo_type FOREIGN KEY (promo_type_id) 
            REFERENCES promo_types(id) ON DELETE SET NULL,
        CONSTRAINT chk_prices_amount CHECK (price >= 0),
        CONSTRAINT chk_prices_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "  ✓ Tabla 'prices' creada.\n\n";
    
    // Step 4: Migrate data from store_products to prices
    echo "Paso 4: Migrando datos desde 'store_products' a 'prices'...\n";
    
    // Check if store_products exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'store_products'");
    if ($stmt->rowCount() > 0) {
        // Get promo_types for mapping
        $stmt = $pdo->query("SELECT id, name FROM promo_types");
        $promoTypesMap = [];
        while ($row = $stmt->fetch()) {
            $promoTypesMap[strtolower($row['name'])] = $row['id'];
        }
        
        // Migrate data
        $stmt = $pdo->query("SELECT * FROM store_products");
        $migrated = 0;
        
        while ($row = $stmt->fetch()) {
            // Try to map promo_label to promo_type_id
            $promoTypeId = null;
            if ($row['promo_label']) {
                $labelLower = strtolower(trim($row['promo_label']));
                foreach ($promoTypesMap as $name => $id) {
                    if (strpos($labelLower, $name) !== false) {
                        $promoTypeId = $id;
                        break;
                    }
                }
            }
            
            // Insert into prices
            $insertStmt = $pdo->prepare("
                INSERT IGNORE INTO prices 
                (supermarket_id, product_id, price, currency, valid_from, valid_to, promo_type_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
            ");
            
            $validFrom = $row['updated_at'] ? date('Y-m-d', strtotime($row['updated_at'])) : date('Y-m-d');
            
            $insertStmt->execute([
                $row['supermarket_id'],
                $row['product_id'],
                $row['price'],
                $row['currency'],
                $validFrom,
                $promoTypeId,
                $row['updated_at'] ?? date('Y-m-d H:i:s'),
                $row['updated_at'] ?? date('Y-m-d H:i:s'),
            ]);
            
            $migrated++;
        }
        
        echo "  ✓ Migrados $migrated registros de precios.\n\n";
        
        // Step 5: Drop store_products table
        echo "Paso 5: Eliminando tabla 'store_products'...\n";
        $pdo->exec("DROP TABLE store_products");
        echo "  ✓ Tabla 'store_products' eliminada.\n\n";
    } else {
        echo "  ⚠ Tabla 'store_products' no existe. Saltando migración de datos.\n\n";
    }
    
    echo "=== Migración completada exitosamente ===\n\n";
    
    echo "Resumen:\n";
    echo "--------\n";
    echo "✓ Tabla 'promo_types' creada con tipos de promoción predefinidos\n";
    echo "✓ Tabla 'prices' creada con soporte para vigencias\n";
    echo "✓ Datos migrados desde 'store_products' (si existía)\n";
    echo "✓ Tabla 'store_products' eliminada\n\n";
    
    echo "Próximos pasos:\n";
    echo "1. Actualizar endpoints de API para usar 'prices'\n";
    echo "2. Actualizar frontend (precios.html y pricesPage.js)\n";
    echo "3. Probar creación, edición y eliminación de precios\n";

} catch (PDOException $e) {
    die("ERROR en la migración: " . $e->getMessage() . "\n");
}
