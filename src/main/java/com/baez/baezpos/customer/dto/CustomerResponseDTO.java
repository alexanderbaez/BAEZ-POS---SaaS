package com.baez.baezpos.customer.dto;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;

@Data
@Builder
public class CustomerResponseDTO {
    private Long id;
    private String name;
    private String phone;
    private String dniCuit;
    private BigDecimal currentBalance;
    private BigDecimal creditLimit;
    private Boolean active;
}