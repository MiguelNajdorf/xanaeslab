<?php
/**
 * Migration: Add 'restrictions' column to 'prices' table
 * 
 * This migration adds a TEXT column to store restrictions/exceptions
 * for price offers (e.g., "No incluye moñitos ni coditos")
 */

require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = get_pdo();
    
    echo "=== Migración: Agregar columna 'restrictions' a tabla 'prices' ===\n\n";
    
    // Check if column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM prices LIKE 'restrictions'");
    if ($stmt->rowCount() > 0) {
        echo "⚠️  La columna 'restrictions' ya existe en la tabla 'prices'.\n";
        echo "✓ Migración completada (sin cambios necesarios).\n";
        exit(0);
    }
    
    // Add restrictions column
    echo "Agregando columna 'restrictions' a tabla 'prices'...\n";
    $pdo->exec("
        ALTER TABLE prices 
        ADD COLUMN restrictions TEXT NULL 
        COMMENT 'Restricciones o excepciones de la oferta'
        AFTER promo_type_id
    ");
    
    echo "✓ Columna 'restrictions' agregada exitosamente.\n\n";
    
    // Verify the change
    $stmt = $pdo->query("SHOW COLUMNS FROM prices LIKE 'restrictions'");
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
