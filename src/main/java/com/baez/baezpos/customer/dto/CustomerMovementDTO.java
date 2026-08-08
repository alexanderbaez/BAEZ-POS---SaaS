package com.baez.baezpos.customer.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CustomerMovementDTO {
    private Long id;
    private BigDecimal amount;       // Monto del movimiento en libreta
    private String type;             // "DEBITO" / "CREDITO"
    private String description;
    private LocalDateTime createdAt;

    // DESGLOSE FINANCIERO DE LA VENTA
    private BigDecimal subtotal;            // Suma de los ítems sin recargo
    private BigDecimal surchargeAmount;     // sale.surcharge
    private BigDecimal surchargePercentage; // sale.surchargeRate
    private BigDecimal totalAmount;         // sale.total

    private List<ItemDetailDTO> itemsDetail;

    @Data
    public static class ItemDetailDTO {
        private String productName;
        private BigDecimal quantity;
        private Boolean isFractional;       // Requerido para discriminar GR de KG o UNIDADES
        private BigDecimal price;
        private BigDecimal subtotal;
    }
}