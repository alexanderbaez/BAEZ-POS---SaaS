package com.baez.baezpos.product.dto;

import java.math.BigDecimal;

/**
 * DTO para enviar datos al Frontend (Listar/Cargar Formulario)
 */
public record ProductResponseDTO(
        Long id,
        String name,
        String categoryName,    // Para la tabla
        Long categoryId,        // PARA EL SELECT EN EDICIÓN
        BigDecimal price,
        BigDecimal cost,        // PARA EL CAMPO COSTO EN EDICIÓN
        BigDecimal stock,       // BigDecimal para soportar fraccionables
        BigDecimal minStock,    // BigDecimal para soportar fraccionables
        String barcode,
        Boolean isFractional    // El POS usa este campo para mostrar el modal de fracción
) {}