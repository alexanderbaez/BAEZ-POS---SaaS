package com.baez.baezpos.product.dto;

import java.math.BigDecimal;

/**
 * DTO para recibir datos desde el Frontend (Crear/Actualizar)
 */
public record ProductRequestDTO(
        String name,
        String description,
        String barcode,
        BigDecimal cost,
        BigDecimal price,
        BigDecimal stock,       // BigDecimal para soportar productos fraccionables
        BigDecimal minStock,    // BigDecimal para soportar productos fraccionables
        Long categoryId,
        Boolean isFractional    // true = producto pesable/granel (venta por kg/fracción)
) {}