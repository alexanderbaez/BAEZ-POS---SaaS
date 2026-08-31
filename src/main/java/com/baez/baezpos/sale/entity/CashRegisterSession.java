package com.baez.baezpos.sale.entity;

import com.baez.baezpos.shared.entity.TenantEntity;
import com.baez.baezpos.user.entity.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cash_register_sessions", indexes = {
        @Index(name = "idx_cash_session_company_status", columnList = "company_id, status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class CashRegisterSession extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // NUEVO: N\u00FAmero correlativo diario (1, 2, 3...) reiniciado por d\u00EDa/tenant
    @Column(name = "session_number", nullable = false)
    @Builder.Default
    private Integer sessionNumber = 1;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "opened_at", nullable = false)
    private LocalDateTime openedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "initial_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal initialAmount;

    @Column(name = "declared_amount", precision = 12, scale = 2)
    private BigDecimal declaredAmount;

    @Column(name = "system_amount", precision = 12, scale = 2)
    private BigDecimal systemAmount;

    @Column(precision = 12, scale = 2)
    private BigDecimal difference;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private CashSessionStatus status = CashSessionStatus.OPEN;

    @Column(columnDefinition = "TEXT")
    private String notes;
}