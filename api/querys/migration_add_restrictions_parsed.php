<?php
/**
 * Migration: Add 'restrictions' column to 'parsed_offers' table
 * 
 * This migration adds a TEXT column to store restrictions/exceptions
 * extracted by the LLM from offer images
 */

require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = get_pdo();
    
    echo "=== Migración: Agregar columna 'restrictions' a tabla 'parsed_offers' ===\n\n";
    
    // Check if column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM parsed_offers LIKE 'restrictions'");
    if ($stmt->rowCount() > 0) {
        echo "⚠️  La columna 'restrictions' ya existe en la tabla 'parsed_offers'.\n";
        echo "✓ Migración completada (sin cambios necesarios).\n";
        exit(0);
    }
    
    // Add restrictions column
    echo "Agregando columna 'restrictions' a tabla 'parsed_offers'...\n";
    $pdo->exec("
        ALTER TABLE parsed_offers 
        ADD COLUMN restrictions TEXT NULL 
        COMMENT 'Restricciones o excepciones extraídas por el LLM'
        AFTER promo_type_id
    ");
    
    echo "✓ Columna 'restrictions' agregada exitosamente.\n\n";
    
    // Verify the change
    $stmt = $pdo->query("SHOW COLUMNS FROM parsed_offers LIKE 'restrictions'");
    $column = $stmt->fetch(PDO::FETCH_ASSOC);
    
    echo "Verificación:\n";
    echo "  - Nombre: {$column['Field']}\n";
    echo "  - Tipo: {$column['Type']}\n";
    echo "  - Nulo: {$column['Null']}\n";
    echo "  - Default: " . ($column['Default'] ?? 'NULL') . "\n\n";
    
    echo "✅ Migración completada exitosamente.\n";
    
} catch (PDOException $e) {
    echo "❌ Error en la migración: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
