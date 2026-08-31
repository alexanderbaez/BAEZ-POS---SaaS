package com.baez.baezpos.product.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoryRequestDTO(
        @NotBlank(message = "El nombre de la categor\u00EDa es obligatorio")
        @Size(max = 120, message = "El nombre no puede superar los 120 caracteres")
        String name,

        @Size(max = 255, message = "La descripci\u00F3n no puede superar los 255 caracteres")
        String description
) {}