package com.baez.baezpos.inventory.entity;

public enum MovementType {
    IN,             // Entrada gen\u00E9rica (+)
    OUT,            // Salida gen\u00E9rica (-)
    PURCHASE,       // Entrada por Compra (+)
    SALE,           // Salida por Venta (-)
    ADJUSTMENT_IN,  // Entrada por Ajuste (+)
    ADJUSTMENT_OUT, // Salida por Ajuste (-)
    DAMAGE,         // Rotura/Merma (-)
    RETURN          // Devoluci\u00F3n (+)
}