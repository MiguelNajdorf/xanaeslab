<?php

declare(strict_types=1);

require_once __DIR__ . '/cart_helpers.php';

require_http_method(['GET', 'POST']);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$user = current_user();

if ($method === 'GET') {
    $cartId = get_query_param('cart_id');
    $sessionToken = get_query_param('session_token');
    $payloadItems = null;
} else {
    $body = read_json_input();
    $cartId = $body['cart_id'] ?? null;
    $sessionToken = $body['session_token'] ?? null;
    $payloadItems = $body['items'] ?? null;
}

$pdo = get_pdo();
$items = [];

if ($payloadItems && is_array($payloadItems)) {
    foreach ($payloadItems as $entry) {
        if (!is_array($entry) || !isset($entry['product_id'], $entry['quantity'])) {
            json_error('VALIDATION_ERROR', 'Formato de items inválido.', [], 422);
        }
        if (!ctype_digit((string)$entry['product_id'])) {
            json_error('VALIDATION_ERROR', 'product_id inválido en items.', [], 422);
        }
        $items[] = [
            'product_id' => (int)$entry['product_id'],
            'quantity' => (float)normalize_quantity($entry['quantity']),
        ];
    }
}

if (empty($items)) {
    if ($cartId !== null) {
        if (!ctype_digit((string)$cartId)) {
            json_error('VALIDATION_ERROR', 'cart_id inválido.', [], 422);
        }
        $cart = ensure_cart($pdo, (int)$cartId, null);
        $cartId = (int)$cart['id'];
    } elseif ($sessionToken !== null) {
        $cart = find_cart($pdo, null, trim((string)$sessionToken), false);
        if (!$cart) {
            json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
        }
        $cartId = (int)$cart['id'];
    } elseif ($user) {
        $stmt = $pdo->prepare("SELECT id FROM carts WHERE user_id = :uid AND status = 'active' ORDER BY created_at DESC LIMIT 1");
        $stmt->execute([':uid' => (int)$user['id']]);
        $cart = $stmt->fetch();
        if (!$cart) {
            json_error('NOT_FOUND', 'Carrito no encontrado.', [], 404);
        }
        $cartId = (int)$cart['id'];
    } else {
        json_error('VALIDATION_ERROR', 'Debe indicar cart_id, session_token o items.', [], 422);
    }

    $stmt = $pdo->prepare('SELECT product_id, quantity FROM cart_items WHERE cart_id = :cart_id');
    $stmt->execute([':cart_id' => $cartId]);
    $itemsRaw = $stmt->fetchAll();
    if (!$itemsRaw) {
        json_error('VALIDATION_ERROR', 'El carrito está vacío.', [], 422);
    }
    foreach ($itemsRaw as $row) {
        $items[] = [
            'product_id' => (int)$row['product_id'],
            'quantity' => (float)$row['quantity'],
        ];
    }
}

$productIds = array_unique(array_column($items, 'product_id'));

if (empty($productIds)) {
    json_error('VALIDATION_ERROR', 'No hay productos para comparar.', [], 422);
}

$placeholders = implode(',', array_fill(0, count($productIds), '?'));

$stmt = $pdo->prepare('SELECT id, name, brand, unit, size FROM products WHERE id IN (' . $placeholders . ')');
$stmt->execute($productIds);
$productInfo = [];
foreach ($stmt->fetchAll() as $row) {
    $productInfo[(int)$row['id']] = $row;
}

$missingProducts = [];
foreach ($productIds as $pid) {
    if (!isset($productInfo[$pid])) {
        $missingProducts[] = $pid;
    }
}
if (!empty($missingProducts)) {
    json_error('VALIDATION_ERROR', 'Algunos productos no existen.', ['product_ids' => $missingProducts], 422);
}

$stmt = $pdo->prepare('SELECT sp.product_id, sp.supermarket_id, sp.price, sp.currency, sp.promo_label, sp.stock_status, sp.updated_at, '
    . 's.name AS supermarket_name FROM prices sp '
    . 'JOIN supermarkets s ON s.id = sp.supermarket_id '
    . 'WHERE sp.product_id IN (' . $placeholders . ')');
$stmt->execute($productIds);
$rows = $stmt->fetchAll();

$storePrices = [];
$supermarkets = [];
foreach ($rows as $row) {
    $pid = (int)$row['product_id'];
    $sid = (int)$row['supermarket_id'];
    $storePrices[$pid][$sid] = [
        'price' => (float)$row['price'],
        'currency' => $row['currency'],
        'stock_status' => $row['stock_status'],
        'promo_label' => $row['promo_label'],
        'updated_at' => $row['updated_at'],
    ];
    $supermarkets[$sid] = [
        'id' => $sid,
        'name' => $row['supermarket_name'],
    ];
}

$mixItems = [];
$mixTotals = [];
$mixTotal = 0.0;
$unavailableProducts = [];

foreach ($items as $entry) {
    $pid = $entry['product_id'];
    $quantity = (float)$entry['quantity'];
    $best = null;
    if (isset($storePrices[$pid])) {
        foreach ($storePrices[$pid] as $sid => $data) {
            if ($data['stock_status'] === 'out_of_stock') {
                continue;
            }
            if ($best === null || $data['price'] < $best['price']) {
                $best = $data + ['supermarket_id' => $sid];
            }
        }
    }

    if ($best === null) {
        $unavailableProducts[] = $pid;
        $mixItems[] = [
            'product_id' => $pid,
            'product' => $productInfo[$pid],
            'quantity' => $quantity,
            'best_option' => null,
        ];
        continue;
    }

    $subtotal = round($best['price'] * $quantity, 2);
    $mixTotal += $subtotal;

    if (!isset($mixTotals[$best['supermarket_id']])) {
        $mixTotals[$best['supermarket_id']] = [
            'supermarket_id' => $best['supermarket_id'],
            'supermarket_name' => $supermarkets[$best['supermarket_id']]['name'] ?? 'N/D',
            'subtotal' => 0.0,
        ];
    }
    $mixTotals[$best['supermarket_id']]['subtotal'] += $subtotal;

    $mixItems[] = [
        'product_id' => $pid,
        'product' => $productInfo[$pid],
        'quantity' => $quantity,
        'best_option' => [
            'supermarket_id' => $best['supermarket_id'],
            'supermarket_name' => $supermarkets[$best['supermarket_id']]['name'] ?? 'N/D',
            'price' => (float)$best['price'],
            'currency' => $best['currency'],
            'promo_label' => $best['promo_label'],
            'updated_at' => $best['updated_at'],
            'subtotal' => $subtotal,
        ],
    ];
}

$mixTotalsList = array_values(array_map(function ($item) {
    $item['subtotal'] = round($item['subtotal'], 2);
    return $item;
}, $mixTotals));

usort($mixTotalsList, fn($a, $b) => $a['subtotal'] <=> $b['subtotal']);

$mixTotal = round($mixTotal, 2);

$storeTotals = [];
foreach ($storePrices as $pid => $stores) {
    $quantity = 0.0;
    foreach ($items as $entry) {
        if ($entry['product_id'] === $pid) {
            $quantity = (float)$entry['quantity'];
            break;
        }
    }
    foreach ($stores as $sid => $data) {
        if ($data['stock_status'] === 'out_of_stock') {
            continue;
        }
        if (!isset($storeTotals[$sid])) {
            $storeTotals[$sid] = [
                'supermarket_id' => $sid,
                'supermarket_name' => $supermarkets[$sid]['name'] ?? 'N/D',
                'total' => 0.0,
                'products' => [],
                'currency' => $data['currency'],
            ];
        }
        $storeTotals[$sid]['total'] += $data['price'] * $quantity;
        $storeTotals[$sid]['products'][$pid] = true;
    }
}

$totalProducts = count($items);
$storeTotals = array_filter($storeTotals, function ($entry) use ($totalProducts) {
    return count($entry['products']) === $totalProducts;
});

$storeTotals = array_map(function ($entry) {
    $entry['total'] = round($entry['total'], 2);
    unset($entry['products']);
    return $entry;
}, $storeTotals);

usort($storeTotals, fn($a, $b) => $a['total'] <=> $b['total']);

$bestSingle = $storeTotals[0] ?? null;
$alternatives = array_slice($storeTotals, 0, 5);

$savingsAbsolute = null;
$savingsPercent = null;
if ($bestSingle && $mixTotal !== null) {
    $savingsAbsolute = round($bestSingle['total'] - $mixTotal, 2);
    if ($bestSingle['total'] > 0) {
        $savingsPercent = round(($savingsAbsolute / $bestSingle['total']) * 100, 2);
    }
}

json_success([
    'mix_and_match' => [
        'items' => $mixItems,
        'totals_by_supermarket' => $mixTotalsList,
        'total' => $mixTotal,
        'unavailable_products' => $unavailableProducts,
    ],
    'single_store' => [
        'best' => $bestSingle,
        'alternatives' => $alternatives,
    ],
    'comparison' => [
        'savings_absolute' => $savingsAbsolute,
        'savings_percent' => $savingsPercent,
    ],
]);

