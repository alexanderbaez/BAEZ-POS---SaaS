package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

/**
 * Proyeccion Spring Data para la query agregada de ventas por sesion y metodo de pago.
 * Elimina el N+1 en getBoxReport() cargando todos los totales en un solo viaje a la BD.
 */
public interface SessionSalesProjection {
    Long getSessionId();
    String getPaymentMethod();
    BigDecimal getTotal();
}