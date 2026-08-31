package com.baez.baezpos.provider.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record PurchaseOrderRequestDTO(
        @NotNull(message = "El proveedor es obligatorio") Long providerId,
        @NotEmpty(message = "Debe haber al menos un Ã­tem en la orden") @Valid List<PurchaseOrderItemRequestDTO> items
) {}
