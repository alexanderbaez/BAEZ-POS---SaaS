package com.baez.baezpos.product.entity;

import com.baez.baezpos.shared.entity.TenantEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLDelete;

import java.math.BigDecimal;

@Entity
@Table(name = "products", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"company_id", "barcode"}) // Unicidad POR EMPRESA
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
@SQLDelete(sql = "UPDATE products SET active = false WHERE id = ?")
public class Product extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    private String description;

    @Column(length = 100)
    private String barcode;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal cost;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    /**
     * Stock en unidades decimales (BigDecimal) para soportar productos pesables/granel.
     * Para productos enteros: 5.000 = 5 unidades.
     * Para productos fraccionables: 2.500 = 2.5 kg.
     */
    @Builder.Default
    @Column(nullable = false, precision = 12, scale = 3)
    private BigDecimal stock = BigDecimal.ZERO;

    @Builder.Default
    @Column(name = "min_stock", precision = 12, scale = 3)
    private BigDecimal minStock = BigDecimal.ZERO;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    /**
     * Indica si el producto se vende por peso/fracción (granel).
     * true  → El POS mostrará las opciones "Por Peso/Cantidad" y "Por Importe $".
     * false → Venta entera tradicional (quantity siempre será entero).
     */
    @Builder.Default
    @Column(name = "is_fractional", nullable = false)
    private Boolean isFractional = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;
}