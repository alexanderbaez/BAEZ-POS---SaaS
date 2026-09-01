package com.baez.baezpos.sale.entity;

import com.baez.baezpos.shared.entity.TenantEntity;
import com.baez.baezpos.user.entity.User;
import jakarta.persistence.*;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sales", indexes = {
        @Index(name = "idx_sales_company_date", columnList = "company_id, sale_date"),
        @Index(name = "idx_sales_company_nro_comprobante", columnList = "company_id, nro_comprobante"),
        @Index(name = "idx_sale_company_created", columnList = "company_id, created_at DESC")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
public class Sale extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "sale_date", nullable = false)
    private LocalDateTime saleDate;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal total;

    @Column(nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal discount = BigDecimal.ZERO;

    @Builder.Default
    @OneToMany(mappedBy = "sale", fetch = FetchType.LAZY, cascade = CascadeType.ALL, orphanRemoval = true)
    @Fetch(FetchMode.SUBSELECT)
    private List<SaleItem> items = new ArrayList<>();

    @Column(name = "payment_method", nullable = false, length = 30)
    private String paymentMethod;

    @Column(nullable = false)
    @Builder.Default
    private Boolean canceled = false;

    // ==========================================
    // CAMPOS PARA ARCA / AFIP (WSFEv1)
    // ==========================================
    @Column(name = "cae", length = 14)
    private String cae;

    @Column(name = "cae_expiration")
    private LocalDate caeExpiration;

    @Column(name = "cae_vto", length = 20)
    private String caeVto;

    @Column(name = "invoice_type", length = 50)
    private String invoiceType;

    @Column(name = "tipo_comprobante", length = 50)
    @Builder.Default
    private String tipoComprobante = "TICKET INTERNO";

    @Column(name = "invoice_number", length = 30)
    private String invoiceNumber;

    @Column(name = "nro_comprobante", length = 30)
    private String nroComprobante;

    @Column(precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal surcharge = BigDecimal.ZERO;

    @Column(name = "surcharge_rate", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal surchargeRate = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cash_register_session_id")
    private CashRegisterSession cashRegisterSession;

    public void addItem(SaleItem item) {
        items.add(item);
        item.setSale(this);
    }

    public String getInvoiceType() {
        return this.invoiceType != null ? this.invoiceType : this.tipoComprobante;
    }

    public void setInvoiceType(String invoiceType) {
        this.invoiceType = invoiceType;
        this.tipoComprobante = invoiceType;
    }

    public String getInvoiceNumber() {
        return this.invoiceNumber != null ? this.invoiceNumber : this.nroComprobante;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
        this.nroComprobante = invoiceNumber;
    }

    public LocalDate getCaeExpiration() {
        if (this.caeExpiration != null) return this.caeExpiration;
        if (this.caeVto != null && !this.caeVto.isBlank()) {
            try { return LocalDate.parse(this.caeVto); } catch (Exception e) {}
        }
        return null;
    }

    public void setCaeExpiration(LocalDate caeExpiration) {
        this.caeExpiration = caeExpiration;
        if (caeExpiration != null) {
            this.caeVto = caeExpiration.toString();
        }
    }
}