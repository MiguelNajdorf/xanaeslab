<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/../auth.php';

require_http_method(['GET']);

$user = require_authenticated();

json_success(['user' => $user]);

