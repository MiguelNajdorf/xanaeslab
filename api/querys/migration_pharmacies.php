<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== Migración de Farmacias (Esquema Normalizado) ===\n\n";

try {
    $pdo = get_pdo();
    
    // Step 1: Drop existing tables if they exist
    echo "Paso 1: Eliminando tablas existentes...\n";
    $pdo->exec("DROP TABLE IF EXISTS pharmacies_on_duty");
    echo "  - Tabla 'pharmacies_on_duty' eliminada.\n";
    $pdo->exec("DROP TABLE IF EXISTS pharmacies");
    echo "  - Tabla 'pharmacies' eliminada.\n\n";

    // Step 2: Create pharmacies catalog table
    echo "Paso 2: Creando tabla 'pharmacies' (catálogo)...\n";
    $sql = "CREATE TABLE pharmacies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        city ENUM('Rio Segundo', 'Pilar') NOT NULL,
        name VARCHAR(191) NOT NULL,
        neighborhood_id INT,
        address VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE SET NULL,
        UNIQUE KEY unique_pharmacy (city, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "  ✓ Tabla 'pharmacies' creada.\n\n";

    // Step 3: Create pharmacies_on_duty schedule table
    echo "Paso 3: Creando tabla 'pharmacies_on_duty' (turnos)...\n";
    $sql = "CREATE TABLE pharmacies_on_duty (
        id INT AUTO_INCREMENT PRIMARY KEY,
        city ENUM('Rio Segundo', 'Pilar') NOT NULL,
        date DATE NOT NULL,
        pharmacy_id INT NOT NULL,
        schedule VARCHAR(100) NOT NULL DEFAULT '08:00 - 08:00',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE RESTRICT,
        UNIQUE KEY unique_duty (city, date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "  ✓ Tabla 'pharmacies_on_duty' creada.\n\n";

    echo "=== Migración completada exitosamente ===\n\n";
    
    echo "Estructura de las tablas:\n";
    echo "------------------------\n";
    echo "1. 'pharmacies': Catálogo de farmacias (datos permanentes)\n";
    echo "   - Campos: id, city, name, neighborhood_id, address, phone, latitude, longitude\n";
    echo "   - Restricción: Una farmacia por ciudad+nombre (UNIQUE)\n\n";
    echo "2. 'pharmacies_on_duty': Turnos de farmacias (referencias)\n";
    echo "   - Campos: id, city, date, pharmacy_id, schedule\n";
    echo "   - Restricción: Una farmacia por ciudad+fecha (UNIQUE)\n";
    echo "   - FK: pharmacy_id -> pharmacies(id) ON DELETE RESTRICT\n\n";

} catch (PDOException $e) {
    die("ERROR en la migración: " . $e->getMessage() . "\n");
}
