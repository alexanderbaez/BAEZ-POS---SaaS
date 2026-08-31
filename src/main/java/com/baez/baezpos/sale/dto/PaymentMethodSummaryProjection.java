package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

/**
 * Proyección Spring Data para agregación de ventas por método de pago en rangos de fechas.
 * Elimina la carga de entidades en memoria y el procesamiento en bucle en el servidor.
 */
public interface PaymentMethodSummaryProjection {
    String getPaymentMethod();
    Long getCount();
    BigDecimal getTotal();
}
