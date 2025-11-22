<?php
/**
 * Migration: Add 'description' column to 'products' table
 * 
 * This migration adds a TEXT column to store product descriptions/variants
 * (e.g., "Para pelo graso", "Sabor chocolate")
 */

require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = get_pdo();
    
    echo "=== Migración: Agregar columna 'description' a tabla 'products' ===\n\n";
    
    // Check if column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM products LIKE 'description'");
    if ($stmt->rowCount() > 0) {
        echo "⚠️  La columna 'description' ya existe en la tabla 'products'.\n";
        echo "✓ Migración completada (sin cambios necesarios).\n";
        exit(0);
    }
    
    // Add description column
    echo "Agregando columna 'description' a tabla 'products'...\n";
    $pdo->exec("
        ALTER TABLE products 
        ADD COLUMN description TEXT NULL 
        COMMENT 'Descripción o variante del producto (ej: para pelo graso)'
        AFTER name
    ");
    
    echo "✓ Columna 'description' agregada exitosamente.\n\n";
    
    // Verify the change
    $stmt = $pdo->query("SHOW COLUMNS FROM products LIKE 'description'");
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
