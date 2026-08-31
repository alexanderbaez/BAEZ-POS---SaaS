package com.baez.baezpos.provider.entity;

import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.shared.entity.TenantEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

@Entity
@Table(name = "provider_products", indexes = {
        @Index(name = "idx_provider_products_company", columnList = "company_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class ProviderProduct extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private Provider provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "provider_sku", length = 100)
    private String providerSku;

    @Builder.Default
    @Column(name = "last_cost", precision = 12, scale = 2)
    private BigDecimal lastCost = BigDecimal.ZERO;
}
