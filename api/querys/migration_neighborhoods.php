<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';

// Script para migrar la base de datos: Crear tablas neighborhoods y trash_schedules

header('Content-Type: text/plain');

try {
    $pdo = get_pdo();
    echo "Iniciando migración de barrios y recolección...\n";

    // 1. Crear tabla neighborhoods
    $sql = "CREATE TABLE IF NOT EXISTS neighborhoods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        city ENUM('Rio Segundo', 'Pilar') NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_city_neighborhood (city, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
    
    $pdo->exec($sql);
    echo "Tabla 'neighborhoods' creada o ya existente.\n";

    // 2. Crear tabla trash_schedules
    $sql = "CREATE TABLE IF NOT EXISTS trash_schedules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        neighborhood_id INT NOT NULL,
        day_of_week VARCHAR(20) NOT NULL,
        type VARCHAR(50) DEFAULT 'Residuos',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id) ON DELETE CASCADE,
        UNIQUE KEY unique_schedule (neighborhood_id, day_of_week, type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

    $pdo->exec($sql);
    echo "Tabla 'trash_schedules' creada o ya existente.\n";

    echo "Migración completada.\n";

} catch (PDOException $e) {
    die("Error en la migración: " . $e->getMessage());
}
