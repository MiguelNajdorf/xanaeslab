<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

// Script para migrar la base de datos: Crear tabla pharmacies_on_duty

header('Content-Type: text/plain');

try {
    $pdo = get_pdo();
    echo "Iniciando migración de farmacias de turno...\n";

    // Drop existing table if it exists
    echo "Eliminando tabla existente (si existe)...\n";
    $pdo->exec("DROP TABLE IF EXISTS pharmacies_on_duty");
    echo "Tabla eliminada.\n";

    // Crear tabla pharmacies_on_duty
    $sql = "CREATE TABLE pharmacies_on_duty (
        id INT AUTO_INCREMENT PRIMARY KEY,
        city ENUM('Rio Segundo', 'Pilar') NOT NULL,
        date DATE NOT NULL,
        name VARCHAR(191) NOT NULL,
        neighborhood_id INT,
        address VARCHAR(255) NOT NULL,
        schedule VARCHAR(100) NOT NULL,
        phone VARCHAR(50),
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE SET NULL,
        UNIQUE KEY unique_pharmacy_duty (city, date, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "Tabla 'pharmacies_on_duty' creada.\n";

    echo "Migración completada.\n";

} catch (PDOException $e) {
    die("Error en la migración: " . $e->getMessage());
}
