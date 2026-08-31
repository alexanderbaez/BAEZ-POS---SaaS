package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

/**
 * ProyecciÃ³n Spring Data para agregaciÃ³n de ventas por mÃ©todo de pago en rangos de fechas.
 * Elimina la carga de entidades en memoria y el procesamiento en bucle en el servidor.
 */
public interface PaymentMethodSummaryProjection {
    String getPaymentMethod();
    Long getCount();
    BigDecimal getTotal();
}
