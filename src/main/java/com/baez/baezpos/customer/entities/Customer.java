package com.baez.baezpos.customer.entities;

import com.baez.baezpos.shared.entity.TenantEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLDelete;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "customers")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
@SQLDelete(sql = "UPDATE customers SET active = false WHERE id = ?")
public class Customer extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 30)
    private String phone;

    @Column(name = "dni_cuit", length = 20)
    private String dniCuit;

    @Column(name = "current_balance", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal currentBalance = BigDecimal.ZERO;

    @Column(name = "credit_limit", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal creditLimit = BigDecimal.valueOf(10000);

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    @Version
    @Builder.Default
    private Long version = 0L;
}