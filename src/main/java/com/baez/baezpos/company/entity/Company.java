package com.baez.baezpos.company.entity;

import com.baez.baezpos.shared.entity.BaseEntity;
import jakarta.persistence.*;
        import lombok.*;
        import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "companies")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
@SQLDelete(sql = "UPDATE companies SET active = false WHERE id = ?")
public class Company extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "tax_id", length = 20, unique = true, nullable = false)
    private String taxId;

    @Column(length = 255)
    private String address;

    @Column(length = 20)
    private String phone;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    @Builder.Default
    @Column(name = "max_employees", nullable = false)
    private Integer maxEmployees = 1;

    @Column(name = "monthly_fee", precision = 12, scale = 2)
    private BigDecimal monthlyFee; // <--- CAMPO CLAVE PARA EL CALCULO DE MRR EN EL FRONTEND

    @Column(name = "ticket_message", columnDefinition = "TEXT")
    private String ticketMessage;

    @Column(name = "logo_url")
    private String logoUrl;

    @Column(length = 100)
    private String email;

    // ==========================================
    // SECUENCIA MULTI-TENANT DE COMPROBANTES
    // ==========================================
    @Builder.Default
    @Column(name = "last_ticket_number", nullable = false)
    private Long lastTicketNumber = 0L;

    // ==========================================
    // CAMPOS FISCALES ARCA / AFIP (WSFEv1)
    // ==========================================
    @Builder.Default
    @Column(name = "has_tax_data")
    private Boolean hasTaxData = true;

    @Builder.Default
    @Column(name = "afip_environment", length = 10)
    private String afipEnvironment = "HOMO";

    @Builder.Default
    @Column(name = "pos_number")
    private Integer posNumber = 1;

    @Column(name = "cuit", length = 20)
    private String cuit;

    @Column(name = "cert_password", length = 100)
    private String certPassword;

    @Column(length = 50)
    private String iibb;

    @Column(name = "inicio_actividades", length = 20)
    private String inicioActividades;

    @Column(name = "condicion_iva", length = 100)
    private String condicionIva;

    public String getCuit() {
        return (this.cuit != null && !this.cuit.isBlank()) ? this.cuit : this.taxId;
    }
}