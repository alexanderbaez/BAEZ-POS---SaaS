package com.baez.baezpos.customer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CustomerRequestDTO(
        @NotBlank(message = "El nombre del cliente es obligatorio")
        @Size(max = 150, message = "El nombre no puede superar los 150 caracteres")
        String name,

        @Size(max = 30, message = "El tel\u00E9fono no puede superar los 30 caracteres")
        String phone,

        @Size(max = 20, message = "El DNI/CUIT no puede superar los 20 caracteres")
        String dniCuit,

        @PositiveOrZero(message = "El l\u00EDmite de cr\u00E9dito debe ser un monto v\u00E1lido")
        BigDecimal creditLimit
) {}