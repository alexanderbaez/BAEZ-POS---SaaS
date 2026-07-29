package com.baez.baezpos.customer.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class CustomerRequestDTO {
    @NotBlank(message = "El nombre del cliente es obligatorio")
    private String name;
    private String phone;
    private String dniCuit;
    private BigDecimal creditLimit;
}