package com.baez.baezpos.inventory.entity;

public enum MovementType {
    IN,             // Entrada genÃ©rica (+)
    OUT,            // Salida genÃ©rica (-)
    PURCHASE,       // Entrada por Compra (+)
    SALE,           // Salida por Venta (-)
    ADJUSTMENT_IN,  // Entrada por Ajuste (+)
    ADJUSTMENT_OUT, // Salida por Ajuste (-)
    DAMAGE,         // Rotura/Merma (-)
    RETURN          // DevoluciÃ³n (+)
}