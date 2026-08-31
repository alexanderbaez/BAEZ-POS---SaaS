package com.baez.baezpos.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProductRequestDTO(
        @NotBlank(message = "El nombre del producto es obligatorio")
        @Size(max = 150, message = "El nombre no puede superar los 150 caracteres")
        String name,

        String description,

        @Size(max = 100, message = "El c\u00F3digo de barras no puede superar los 100 caracteres")
        String barcode,

        @NotNull(message = "El costo es obligatorio")
        @PositiveOrZero(message = "El costo no puede ser negativo")
        BigDecimal cost,

        @NotNull(message = "El precio es obligatorio")
        @PositiveOrZero(message = "El precio no puede ser negativo")
        BigDecimal price,

        @PositiveOrZero(message = "El stock no puede ser negativo")
        BigDecimal stock,

        @PositiveOrZero(message = "El stock m\u00EDnimo no puede ser negativo")
        BigDecimal minStock,

        @NotNull(message = "Debe seleccionar una categor\u00EDa")
        Long categoryId,

        Boolean isFractional
) {}