package com.baez.baezpos.customer.entities;

import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.shared.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

@Entity
@Table(name = "customer_movements")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
public class CustomerMovement extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 10)
    private String type; // "DEBITO" (Deuda) o "CREDITO" (Pago)

    @Column(length = 255)
    private String description;

    @Column(name = "payment_method", length = 30)
    private String paymentMethod; // "EFECTIVO", "TRANSFERENCIA", "TARJETA", etc.

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_id")
    private Sale sale;
}