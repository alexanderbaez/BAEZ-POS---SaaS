package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

/**
 * Proyecci\u00F3n Spring Data para agregaci\u00F3n de ventas por m\u00E9todo de pago en rangos de fechas.
 * Elimina la carga de entidades en memoria y el procesamiento en bucle en el servidor.
 */
public interface PaymentMethodSummaryProjection {
    String getPaymentMethod();
    Long getCount();
    BigDecimal getTotal();
}
