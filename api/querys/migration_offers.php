<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== Migración de Sistema de Ofertas (LLM) ===\n\n";

try {
    $pdo = get_pdo();
    
    // Step 1: Create offers table
    echo "Paso 1: Creando tabla 'offers'...\n";
    $sql = "CREATE TABLE IF NOT EXISTS offers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        supermarket_id INT UNSIGNED NOT NULL,
        image_path VARCHAR(255) NOT NULL,
        uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status ENUM('pending', 'processing', 'ready', 'error') NOT NULL DEFAULT 'pending',
        error_message TEXT NULL,
        
        KEY idx_offers_supermarket (supermarket_id),
        KEY idx_offers_status (status),
        
        CONSTRAINT fk_offers_supermarket FOREIGN KEY (supermarket_id) 
            REFERENCES supermarkets(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "  ✓ Tabla 'offers' creada.\n\n";
    
    // Step 2: Create parsed_offers table
    echo "Paso 2: Creando tabla 'parsed_offers'...\n";
    $sql = "CREATE TABLE IF NOT EXISTS parsed_offers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        offer_id INT UNSIGNED NOT NULL,
        product_name VARCHAR(191) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        currency CHAR(3) NOT NULL DEFAULT 'ARS',
        valid_from DATE NOT NULL,
        valid_to DATE NULL,
        promo_type_id INT UNSIGNED NULL,
        raw_text TEXT NULL,
        confidence_score DECIMAL(3,2) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        
        KEY idx_parsed_offers_offer (offer_id),
        KEY idx_parsed_offers_promo (promo_type_id),
        
        CONSTRAINT fk_parsed_offers_offer FOREIGN KEY (offer_id) 
            REFERENCES offers(id) ON DELETE CASCADE,
        CONSTRAINT fk_parsed_offers_promo FOREIGN KEY (promo_type_id) 
            REFERENCES promo_types(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "  ✓ Tabla 'parsed_offers' creada.\n\n";
    
    echo "=== Migración completada exitosamente ===\n\n";
    
    echo "Resumen:\n";
    echo "--------\n";
    echo "✓ Tabla 'offers' creada (almacenamiento de imágenes)\n";
    echo "✓ Tabla 'parsed_offers' creada (datos estructurados del LLM)\n";
    echo "✓ Relaciones y claves foráneas configuradas\n\n";
    
    echo "Próximos pasos:\n";
    echo "1. Crear endpoint de subida de imágenes (offers_upload.php)\n";
    echo "2. Implementar worker de procesamiento con LLM\n";

} catch (PDOException $e) {
    die("ERROR en la migración: " . $e->getMessage() . "\n");
}
