<?php
require_once __DIR__ . '/config.php';

echo "Checking environment...\n";

if (!function_exists('curl_init')) {
    die("ERROR: cURL extension is not enabled.\n");
}
echo "cURL is enabled.\n";

if (!function_exists('mime_content_type')) {
    die("ERROR: fileinfo extension is not enabled (mime_content_type missing).\n");
}
echo "fileinfo is enabled.\n";

if (!defined('GEMINI_API_KEY')) {
    die("ERROR: GEMINI_API_KEY is not defined.\n");
}
echo "API Key is defined: " . substr(GEMINI_API_KEY, 0, 5) . "...\n";

echo "Testing Gemini API connectivity...\n";

// 1. List Models to see what's available
echo "Listing available models...\n";
$url = "https://generativelanguage.googleapis.com/v1beta/models?key=" . GEMINI_API_KEY;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
$data = json_decode($response, true);

if (isset($data['models'])) {
    echo "Available Models:\n";
    foreach ($data['models'] as $model) {
        if (strpos($model['supportedGenerationMethods'][0] ?? '', 'generateContent') !== false) {
            echo "- " . $model['name'] . " (" . implode(', ', $model['supportedGenerationMethods']) . ")\n";
        }
    }
} else {
    echo "Response: $response\n";
}

// 2. Try a fallback model if the previous one failed
$modelToTest = 'gemini-1.5-flash-001'; // Try specific version
echo "\nTesting specific model: $modelToTest...\n";

$url = "https://generativelanguage.googleapis.com/v1beta/models/$modelToTest:generateContent?key=" . GEMINI_API_KEY;

$data = [
    "contents" => [
        [
            "parts" => [
                ["text" => "Hello, reply with 'YES'."]
            ]
        ]
    ]
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";
