package com.baez.baezpos.expense.entity;

import com.baez.baezpos.shared.entity.PaymentMethod;
import com.baez.baezpos.shared.entity.TenantEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "expenses", indexes = {
        @Index(name = "idx_expenses_company_date", columnList = "company_id, expense_date"),
        @Index(name = "idx_expenses_company_payment", columnList = "company_id, payment_method")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
public class Expense extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDateTime expenseDate;

    @Column(name = "deduct_from_box", nullable = false)
    @Builder.Default
    private Boolean deductFromBox = true;

    // --- NUEVOS CAMPOS ---
    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private ExpenseCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 30)
    private PaymentMethod paymentMethod;

    @Column(name = "reference", length = 100)
    private String reference;

    @Column(name = "provider_id")
    private Long providerId;

    @Column(name = "invoice_number", length = 50)
    private String invoiceNumber;
}