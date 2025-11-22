<?php

declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

// Allow POST requests
require_http_method(['POST']);

// Optional: Require auth if needed, or leave open if used by public client (usually protected)
require_user_auth();

$pdo = get_pdo();
$data = read_json_input();

$productName = $data['product_name'] ?? '';
$description = $data['description'] ?? '';
$brand = $data['brand'] ?? '';

if (empty($productName)) {
    json_error('El nombre del producto es requerido', 400);
}

// 1. Fetch existing categories
try {
    $stmt = $pdo->query("SELECT name FROM categories ORDER BY name ASC");
    $categories = $stmt->fetchAll(PDO::FETCH_COLUMN);
} catch (PDOException $e) {
    json_error('Error al obtener categorías: ' . $e->getMessage(), 500);
}

// 2. Prepare Gemini Prompt
if (!defined('GEMINI_API_KEY') || empty(GEMINI_API_KEY)) {
    json_error('GEMINI_API_KEY no configurada', 500);
}

$categoriesList = implode(', ', $categories);
$prompt = "You are a categorization assistant for a supermarket.
I have a product with the following details:
- Name: \"$productName\"
- Description: \"$description\"
- Brand: \"$brand\"

Here is the list of EXISTING categories in the database:
[$categoriesList]

Your task:
1. Select the BEST matching category from the existing list.
2. If NONE of the existing categories fit well, suggest a NEW, concise category name (in Spanish, capitalized).

Return ONLY a JSON object with a single key \"category\". Do not include markdown.
Example: {\"category\": \"Gaseosas\"}";

// 3. Call Gemini API
try {
    $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" . GEMINI_API_KEY;
    
    $requestData = [
        "contents" => [
            [
                "parts" => [
                    ["text" => $prompt]
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
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));
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
        throw new Exception("Invalid response structure from Gemini");
    }

    $rawText = $jsonResponse['candidates'][0]['content']['parts'][0]['text'];
    $rawText = str_replace(['```json', '```'], '', $rawText); // Cleanup
    $parsed = json_decode($rawText, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new Exception("Failed to parse JSON from Gemini");
    }

    $suggestedCategory = $parsed['category'] ?? null;

    if (!$suggestedCategory) {
        throw new Exception("AI did not return a category");
    }

    json_success(['category' => $suggestedCategory]);

} catch (Exception $e) {
    json_error('Error al sugerir categoría: ' . $e->getMessage(), 500);
}
