package com.baez.baezpos.product.dto;

import java.math.BigDecimal;

/**
 * DTO para enviar datos al Frontend (Listar/Cargar Formulario)
 */
public record ProductResponseDTO(
        Long id,
        String name,
        String description,
        String categoryName,    // Para la tabla
        Long categoryId,        // PARA EL SELECT EN EDICIÃ“N
        BigDecimal price,
        BigDecimal cost,        // PARA EL CAMPO COSTO EN EDICIÃ“N
        BigDecimal stock,       // BigDecimal para soportar fraccionables
        BigDecimal minStock,    // BigDecimal para soportar fraccionables
        String barcode,
        Boolean isFractional    // El POS usa este campo para mostrar el modal de fracciÃ³n
) {}