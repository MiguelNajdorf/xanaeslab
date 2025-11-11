DROP DATABASE IF EXISTS xanaeslab;
CREATE DATABASE xanaeslab CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE xanaeslab;

-- Tabla de usuarios
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(191) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin') NOT NULL DEFAULT 'admin',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at DATETIME NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- Supermercados
CREATE TABLE supermarkets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    slug VARCHAR(191) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(120) NOT NULL,
    state VARCHAR(120) NOT NULL,
    zip VARCHAR(20) NOT NULL,
    phone VARCHAR(40) NULL,
    website VARCHAR(191) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_supermarkets_name (name),
    UNIQUE KEY uq_supermarkets_slug (slug)
) ENGINE=InnoDB;

-- Horarios de atención
CREATE TABLE store_hours (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supermarket_id INT UNSIGNED NOT NULL,
    weekday TINYINT UNSIGNED NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_hours_supermarket_weekday (supermarket_id, weekday),
    CONSTRAINT fk_store_hours_supermarket FOREIGN KEY (supermarket_id) REFERENCES supermarkets(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Categorías
CREATE TABLE categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    slug VARCHAR(191) NOT NULL,
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_categories_name (name),
    UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB;

-- Productos
CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(191) NOT NULL,
    brand VARCHAR(120) NULL,
    barcode VARCHAR(64) NULL,
    unit VARCHAR(20) NOT NULL,
    size VARCHAR(50) NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_products_barcode (barcode),
    KEY idx_products_name (name),
    KEY idx_products_category (category_id),
    KEY idx_products_barcode (barcode),
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Precios por supermercado
CREATE TABLE store_products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    supermarket_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'ARS',
    promo_label VARCHAR(191) NULL,
    stock_status ENUM('in_stock', 'out_of_stock', 'unknown') NOT NULL DEFAULT 'unknown',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_product (supermarket_id, product_id),
    KEY idx_store_products_price (price),
    KEY idx_store_products_updated_at (updated_at),
    CONSTRAINT fk_store_products_supermarket FOREIGN KEY (supermarket_id) REFERENCES supermarkets(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_store_products_product FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT chk_store_products_price CHECK (price >= 0)
) ENGINE=InnoDB;

-- Carritos
CREATE TABLE carts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NULL,
    session_token CHAR(32) NULL,
    status ENUM('active', 'finalized', 'abandoned') NOT NULL DEFAULT 'active',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_carts_session_token (session_token),
    KEY idx_carts_user (user_id),
    CONSTRAINT fk_carts_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Items del carrito
CREATE TABLE cart_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity DECIMAL(10,3) NOT NULL,
    UNIQUE KEY uq_cart_item (cart_id, product_id),
    CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT chk_cart_items_quantity CHECK (quantity > 0)
) ENGINE=InnoDB;

-- Logs administrativos (opcional)
CREATE TABLE admin_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id INT UNSIGNED NOT NULL,
    action VARCHAR(120) NOT NULL,
    entity VARCHAR(120) NOT NULL,
    entity_id INT UNSIGNED NULL,
    payload_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_logs_user FOREIGN KEY (admin_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Datos iniciales
INSERT INTO users (email, password_hash, role, created_at, updated_at, is_active)
VALUES ('admin@xanaeslab.com', '$2y$12$vcsnQnu7pGiPvCGuIAvv9es.0vRj2PbCLjseUCIzIj/s28cFJqwJa', 'admin', NOW(), NOW(), 1);

INSERT INTO categories (name, slug, description) VALUES
('Lácteos', 'lacteos', 'Productos lácteos y derivados'),
('Bebidas', 'bebidas', 'Bebidas sin alcohol'),
('Limpieza', 'limpieza', 'Artículos de limpieza hogar'),
('Almacén', 'almacen', 'Productos de almacén'),
('Frutas y Verduras', 'frutas-verduras', 'Productos frescos');

INSERT INTO supermarkets (name, slug, address, city, state, zip, phone, website, is_active)
VALUES
('Mercado Centro', 'mercado-centro', 'Av. Siempre Viva 742', 'Córdoba', 'Córdoba', '5000', '+54 351 1234567', 'https://mercadocentro.example', 1),
('Super Ahorro', 'super-ahorro', 'Calle Principal 123', 'Córdoba', 'Córdoba', '5000', '+54 351 7654321', 'https://superahorro.example', 1),
('Eco Market', 'eco-market', 'Boulevard Verde 456', 'Villa Carlos Paz', 'Córdoba', '5152', '+54 3541 112233', 'https://ecomarket.example', 1);

INSERT INTO store_hours (supermarket_id, weekday, open_time, close_time)
VALUES
(1, 0, '09:00', '18:00'),
(1, 1, '08:00', '21:00'),
(1, 2, '08:00', '21:00'),
(1, 3, '08:00', '21:00'),
(1, 4, '08:00', '21:00'),
(1, 5, '08:00', '22:00'),
(1, 6, '09:00', '18:00'),
(2, 0, '09:00', '17:00'),
(2, 1, '08:30', '21:00'),
(2, 2, '08:30', '21:00'),
(2, 3, '08:30', '21:00'),
(2, 4, '08:30', '21:00'),
(2, 5, '09:00', '20:00'),
(2, 6, '09:00', '17:00'),
(3, 0, '10:00', '16:00'),
(3, 1, '09:00', '20:00'),
(3, 2, '09:00', '20:00'),
(3, 3, '09:00', '20:00'),
(3, 4, '09:00', '21:00'),
(3, 5, '09:00', '21:00'),
(3, 6, '10:00', '18:00');

INSERT INTO products (name, brand, barcode, unit, size, category_id) VALUES
('Leche Entera 1L', 'La Serenísima', '7791234000012', 'lt', '1', 1),
('Yogur Natural', 'Sancor', '7798765001119', 'g', '190', 1),
('Jugo de Naranja', 'Cepita', '7790070415001', 'lt', '1', 2),
('Detergente Líquido', 'Ala', '7791293000456', 'ml', '750', 3),
('Arroz Largo Fino', 'Gallo', '7790070412345', 'kg', '1', 4),
('Manzana Roja', NULL, NULL, 'kg', '1', 5),
('Banana Ecuador', NULL, NULL, 'kg', '1', 5),
('Aceite de Girasol', 'Cocinero', '7790070416789', 'lt', '1.5', 4),
('Gaseosa Cola', 'Coca-Cola', '7790895001056', 'lt', '1.5', 2),
('Lavandina', 'Ayudín', '7790070412222', 'lt', '1', 3);

INSERT INTO store_products (supermarket_id, product_id, price, currency, promo_label, stock_status)
VALUES
(1, 1, 320.00, 'ARS', NULL, 'in_stock'),
(1, 2, 210.00, 'ARS', '2x1 Lunes', 'in_stock'),
(1, 3, 450.00, 'ARS', NULL, 'in_stock'),
(1, 4, 380.00, 'ARS', NULL, 'in_stock'),
(1, 5, 290.00, 'ARS', NULL, 'in_stock'),
(1, 6, 550.00, 'ARS', NULL, 'in_stock'),
(2, 1, 310.00, 'ARS', 'Precio especial socios', 'in_stock'),
(2, 3, 470.00, 'ARS', NULL, 'in_stock'),
(2, 4, 360.00, 'ARS', NULL, 'in_stock'),
(2, 5, 295.00, 'ARS', NULL, 'in_stock'),
(2, 8, 780.00, 'ARS', NULL, 'in_stock'),
(3, 1, 340.00, 'ARS', NULL, 'in_stock'),
(3, 2, 215.00, 'ARS', NULL, 'in_stock'),
(3, 6, 540.00, 'ARS', NULL, 'in_stock'),
(3, 7, 430.00, 'ARS', NULL, 'in_stock'),
(3, 9, 420.00, 'ARS', NULL, 'in_stock'),
(3, 10, 310.00, 'ARS', NULL, 'in_stock');

INSERT INTO admin_logs (admin_id, action, entity, entity_id, payload_json)
VALUES
(1, 'seed', 'system', NULL, JSON_OBJECT('message', 'Datos iniciales cargados'));

