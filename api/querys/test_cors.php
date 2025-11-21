<?php
ini_set('display_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/config.php';

echo json_encode(['status' => 'ok', 'message' => 'CORS works']);
