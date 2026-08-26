package com.baez.baezpos.provider.entity;

import com.baez.baezpos.shared.entity.TenantEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.SQLDelete;

import java.math.BigDecimal;

@Entity
@Table(name = "providers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
@SQLDelete(sql = "UPDATE providers SET active = false WHERE id = ?")
public class Provider extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "business_name", nullable = false, length = 150)
    private String businessName;

    @Column(name = "tax_id", length = 30)
    private String taxId;

    @Column(length = 50)
    private String phone;

    @Column(length = 120)
    private String email;

    @Builder.Default
    @Column(name = "current_balance", nullable = false, precision = 12, scale = 2)
    private BigDecimal currentBalance = BigDecimal.ZERO;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;
}
