<?php

declare(strict_types=1);

// Enable error reporting for debugging
ini_set('display_errors', '1');
ini_set('display_startup_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

try {


    // If HTTP, require admin
    if (php_sapi_name() !== 'cli') {
        require_once __DIR__ . '/../auth.php';
        // Allow GET for easy testing in browser, POST for button clicks
        require_http_method(['POST', 'GET']);
        require_admin();
    }

$pdo = get_pdo();

try {
    // 1. Fetch one pending offer
    $stmt = $pdo->query("SELECT * FROM offers WHERE status = 'pending' ORDER BY uploaded_at ASC LIMIT 1");
    $offer = $stmt->fetch();
} catch (PDOException $e) {
    if (php_sapi_name() !== 'cli') {
        // Check if it's a "table doesn't exist" error
        if (strpos($e->getMessage(), 'doesn\'t exist') !== false) {
            json_error('Error: La tabla "offers" no existe. Por favor ejecuta la migración: api/querys/migration_offers.php', 500);
        }
        json_error('Error de base de datos: ' . $e->getMessage(), 500);
    }
    exit('DB Error: ' . $e->getMessage());
}

if (!$offer) {
    if (php_sapi_name() !== 'cli') {
        json_success(['message' => 'No hay ofertas pendientes']);
    }
    exit;
}

$offerId = (int)$offer['id'];
$imagePath = __DIR__ . '/../../www/' . $offer['image_path'];

// 2. Mark as processing
    $pdo->prepare("UPDATE offers SET status = 'processing' WHERE id = ?")->execute([$offerId]);

try {
    if (!file_exists($imagePath)) {
        throw new Exception("Archivo de imagen no encontrado: $imagePath");
    }

    // 3. Call LLM (Mock implementation for now)
    // In a real implementation, this would call OpenAI/Gemini API
    $parsedData = call_llm_mock($imagePath);
    
    // 4. Insert parsed offers
    $stmt = $pdo->prepare("
        INSERT INTO parsed_offers 
        (offer_id, product_name, price, currency, valid_from, valid_to, promo_type_id, raw_text, confidence_score)
        VALUES (:offer_id, :product_name, :price, :currency, :valid_from, :valid_to, :promo_type_id, :raw_text, :confidence_score)
    ");

    foreach ($parsedData as $item) {
        // Try to match promo type
        $promoTypeId = null;
        if (!empty($item['promo_type_name'])) {
            $promoStmt = $pdo->prepare("SELECT id FROM promo_types WHERE name LIKE ? LIMIT 1");
            $promoStmt->execute(['%' . $item['promo_type_name'] . '%']);
            $promoTypeId = $promoStmt->fetchColumn() ?: null;
        }

        $stmt->execute([
            ':offer_id' => $offerId,
            ':product_name' => $item['product_name'],
            ':price' => $item['price'],
            ':currency' => $item['currency'] ?? 'ARS',
            ':valid_from' => $item['valid_from'] ?? date('Y-m-d'),
            ':valid_to' => $item['valid_to'] ?? null,
            ':promo_type_id' => $promoTypeId,
            ':raw_text' => json_encode($item),
            ':confidence_score' => 0.95 // Mock score
        ]);
    }

    // 5. Mark as ready
    $pdo->prepare("UPDATE offers SET status = 'ready' WHERE id = ?")->execute([$offerId]);

    if (php_sapi_name() !== 'cli') {
        json_success(['message' => 'Oferta procesada correctamente', 'count' => count($parsedData)]);
    }

} catch (Exception $e) {
    // Mark as error
    $stmt = $pdo->prepare("UPDATE offers SET status = 'error', error_message = ? WHERE id = ?");
    $stmt->execute([$e->getMessage(), $offerId]);
    
    if (php_sapi_name() !== 'cli') {
        json_error('Error al procesar oferta: ' . $e->getMessage(), 500);
    }
}

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Error fatal: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    exit;
}

/**
 * Mock function to simulate LLM response
 * Replace this with actual API call to OpenAI/Gemini
 */
function call_llm_mock(string $imagePath): array {
    // Simulate processing delay
    sleep(2);
    
    // Return dummy data
    return [
        [
            'product_name' => 'Coca Cola 2.25L',
            'price' => 1200.00,
            'currency' => 'ARS',
            'valid_from' => date('Y-m-d'),
            'valid_to' => date('Y-m-d', strtotime('+7 days')),
            'promo_type_name' => '2x1'
        ],
        [
            'product_name' => 'Galletitas Oreo 117g',
            'price' => 850.50,
            'currency' => 'ARS',
            'valid_from' => date('Y-m-d'),
            'valid_to' => date('Y-m-d', strtotime('+7 days')),
            'promo_type_name' => '50%'
        ],
        [
            'product_name' => 'Leche La Serenísima 1L',
            'price' => 950.00,
            'currency' => 'ARS',
            'valid_from' => date('Y-m-d'),
            'valid_to' => null,
            'promo_type_name' => null
        ]
    ];
}
