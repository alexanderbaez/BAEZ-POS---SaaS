-- ==============================================================================
-- SCRIPT DE MIGRACIÓN DE ESQUEMA: MÓDULO DE COMPRAS (ÓRDENES DE COMPRA)
-- Base de Datos: MySQL (Aiven)
-- Entorno: Producción (Render)
-- ==============================================================================

-- 1. Crear tabla 'purchase_orders'
CREATE TABLE purchase_orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL,
    order_date DATETIME(6) NOT NULL,
    reception_date DATETIME(6),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_purchase_order_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_purchase_order_provider FOREIGN KEY (provider_id) REFERENCES providers(id)
);
CREATE INDEX idx_purchase_orders_company ON purchase_orders (company_id);

-- 2. Crear tabla 'purchase_order_items'
CREATE TABLE purchase_order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    purchase_order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_po_item_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_po_item_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
    CONSTRAINT fk_po_item_product FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX idx_purchase_order_items_company ON purchase_order_items (company_id);

-- 3. Crear tabla 'provider_products'
CREATE TABLE provider_products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    company_id BIGINT NOT NULL,
    provider_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    provider_sku VARCHAR(100),
    last_cost DECIMAL(12,2) DEFAULT 0.00,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_pp_company FOREIGN KEY (company_id) REFERENCES companies(id),
    CONSTRAINT fk_pp_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
    CONSTRAINT fk_pp_product FOREIGN KEY (product_id) REFERENCES products(id)
);
CREATE INDEX idx_provider_products_company ON provider_products (company_id);

-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
