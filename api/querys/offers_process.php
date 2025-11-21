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
            if (strpos($e->getMessage(), 'doesn\'t exist') !== false) {
                json_error('Error: La tabla "offers" no existe. Por favor ejecuta la migración.', 500);
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
    $imagePath = __DIR__ . '/../' . $offer['image_path'];

    // 2. Mark as processing
    $pdo->prepare("UPDATE offers SET status = 'processing' WHERE id = ?")->execute([$offerId]);

    try {
        if (!file_exists($imagePath)) {
            throw new Exception("Archivo de imagen no encontrado: $imagePath");
        }

        // 3. Call Gemini API
        if (!defined('GEMINI_API_KEY') || empty(GEMINI_API_KEY)) {
            throw new Exception("GEMINI_API_KEY no está configurada en config.php");
        }

        $parsedData = call_gemini_api($imagePath, GEMINI_API_KEY);
        
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
                ':product_name' => $item['product_name'] ?? 'Producto Desconocido',
                ':price' => $item['price'] ?? 0.0,
                ':currency' => $item['currency'] ?? 'ARS',
                ':valid_from' => $item['valid_from'] ?? date('Y-m-d'),
                ':valid_to' => $item['valid_to'] ?? null,
                ':promo_type_id' => $promoTypeId,
                ':raw_text' => json_encode($item),
                ':confidence_score' => 0.90 // Placeholder score from Gemini
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
 * Call Gemini API to analyze the image
 */
function call_gemini_api(string $imagePath, string $apiKey): array {
    $mimeType = mime_content_type($imagePath);
    $base64Image = base64_encode(file_get_contents($imagePath));

    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" . $apiKey;

    $prompt = "Analyze this image of a supermarket offer flyer. Extract all products, their prices, currency, valid dates (from/to), and any promotion details (e.g., '2x1', '50% off'). 
    Return ONLY a valid JSON array of objects. Do not include markdown formatting (```json). 
    Each object must have these keys: 
    - 'product_name' (string)
    - 'price' (number)
    - 'currency' (ISO code, e.g., ARS)
    - 'valid_from' (YYYY-MM-DD, use today if missing)
    - 'valid_to' (YYYY-MM-DD or null)
    - 'promo_type_name' (string or null).
    
    If the image contains no offers, return an empty array [].";

    $data = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $prompt],
                    [
                        "inline_data" => [
                            "mime_type" => $mimeType,
                            "data" => $base64Image
                        ]
                    ]
                ]
            ]
        ],
        "generationConfig" => [
            "temperature" => 0.1,
            "response_mime_type" => "application/json"
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);

    $response = curl_exec($ch);
    
    if (curl_errno($ch)) {
        throw new Exception('Curl error: ' . curl_error($ch));
    }
    
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception("Gemini API Error ($httpCode): " . $response);
    }

    $jsonResponse = json_decode($response, true);
    
    if (!isset($jsonResponse['candidates'][0]['content']['parts'][0]['text'])) {
        throw new Exception("Invalid response structure from Gemini: " . $response);
    }

    $rawText = $jsonResponse['candidates'][0]['content']['parts'][0]['text'];
    
    // Clean up markdown if present (just in case)
    $rawText = str_replace(['```json', '```'], '', $rawText);
    
    $parsed = json_decode($rawText, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Failed to parse JSON from Gemini: " . json_last_error_msg() . " | Raw: " . $rawText);
    }

    return $parsed;
}
