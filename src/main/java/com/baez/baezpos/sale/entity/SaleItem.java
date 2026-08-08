package com.baez.baezpos.sale.entity;

import com.baez.baezpos.product.entity.Product;
import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "sale_items")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SaleItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_id", nullable = false)
    @JsonBackReference
    private Sale sale;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /**
     * Cantidad en unidades decimales para soportar venta fraccionada por peso.
     * Ejemplos: 1.000 = 1 unidad, 0.250 = 250 gramos / 0.25 kg.
     * precision=12, scale=3 soporta hasta 999,999,999.999 unidades.
     */
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal quantity;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal price;    // Precio histórico de venta por unidad/kg

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cost;     // Costo histórico por unidad/kg para calcular rentabilidad

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal; // = quantity * price
}