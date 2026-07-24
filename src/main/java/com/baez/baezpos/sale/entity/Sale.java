package com.baez.baezpos.sale.entity;

import com.baez.baezpos.shared.entity.TenantEntity;
import com.baez.baezpos.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "sales")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
public class Sale extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "sale_date", nullable = false)
    private LocalDateTime saleDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discount = BigDecimal.ZERO;

    @OneToMany(mappedBy = "sale", fetch = FetchType.EAGER, cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SaleItem> items;

    @Column(name = "payment_method")
    private String paymentMethod;

    @Column(nullable = false)
    @Builder.Default
    private Boolean canceled = false;

    // ==========================================
    // CAMPOS PARA ARCA / AFIP
    // ==========================================
    @Column(name = "cae", length = 14)
    @Builder.Default
    private String cae = null;

    @Column(name = "cae_vto")
    @Builder.Default
    private String caeVto = null;

    @Column(name = "tipo_comprobante")
    @Builder.Default
    private String tipoComprobante = "TICKET INTERNO";

    @Column(name = "nro_comprobante")
    @Builder.Default
    private String nroComprobante = null;

    @Column(precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal surcharge = BigDecimal.ZERO;

    @Column(name = "surcharge_rate", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal surchargeRate = BigDecimal.ZERO;
}