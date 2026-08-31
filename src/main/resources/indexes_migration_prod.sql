-- ==============================================================================
-- MIGRACIÓN DE ÍNDICES DE RENDIMIENTO (BAEZ POS SaaS)
-- Ejecutar este script en Aiven (MySQL) antes o después de desplegar a Render.
-- ==============================================================================

-- 1. Tabla users: Evita Full Table Scans en login y filtrado por tenant
CREATE INDEX idx_users_company_active ON users (company_id, active);
CREATE INDEX idx_users_company_email ON users (company_id, email);

-- 2. Tabla companies: Acelera búsquedas de validación de inquilino y tax_id
CREATE INDEX idx_companies_active ON companies (active);
CREATE INDEX idx_companies_tax_id ON companies (tax_id);

-- 3. Tabla sales: Aisla la búsqueda de Nro. de Comprobante por tenant
-- Nota: Si idx_sales_nro_comprobante ya existía, considerar hacer DROP INDEX idx_sales_nro_comprobante ON sales;
CREATE INDEX idx_sales_company_nro_comprobante ON sales (company_id, nro_comprobante);

-- 4. Tabla expenses: Acelera los reportes de flujo de caja y filtrado por método de pago
CREATE INDEX idx_expenses_company_payment ON expenses (company_id, payment_method);

-- 5. Tabla providers: Optimiza la carga del listado de proveedores activos por tenant
CREATE INDEX idx_providers_company_active ON providers (company_id, active);

-- ==============================================================================
-- FIN DEL SCRIPT
-- ==============================================================================
