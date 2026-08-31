package com.baez.baezpos.provider.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ProviderRequestDTO(
        @NotBlank(message = "La raz\u00F3n social o nombre del proveedor es obligatorio.")
        @Size(max = 150, message = "El nombre no puede superar los 150 caracteres.")
        String businessName,

        @Size(max = 30, message = "El CUIT/RUT/DNI no puede superar los 30 caracteres.")
        String taxId,

        @Size(max = 50, message = "El tel\u00E9fono no puede superar los 50 caracteres.")
        String phone,

        @Size(max = 120, message = "El correo electr\u00F3nico no puede superar los 120 caracteres.")
        String email,

        BigDecimal currentBalance
) {}
