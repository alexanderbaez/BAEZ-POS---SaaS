package com.baez.baezpos.user.entity;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.shared.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_users_company_active", columnList = "company_id, active"),
        @Index(name = "idx_users_company_email", columnList = "company_id, email")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
public class User extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "password_reset_at")
    private LocalDateTime passwordResetAt;

    @Column(name = "security_pin", length = 255, nullable = true)
    private String securityPin;

    // RELACIÓN MULTI-TENANT (SaaS)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = true)
    private Company company;

    // Blindaje extra: Asegura que nunca se guarde como null o falso por descuido al persistir
    @PrePersist
    public void prePersist() {
        if (this.active == null) {
            this.active = true;
        }
    }
}