package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;

public record ChartDataDTO(
        String label,
        BigDecimal total
) {}