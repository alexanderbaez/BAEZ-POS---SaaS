package com.baez.baezpos.log.entity;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.shared.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_logs", indexes = {
        @Index(name = "idx_system_logs_company", columnList = "company_id"),
        @Index(name = "idx_system_logs_timestamp", columnList = "timestamp")
})
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
public class SystemLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "company_id", nullable = true)
    private Company company;

    @Column(nullable = false)
    private String action; // Ej: "VENTA", "ELIMINACION_PRODUCTO", "AJUSTE_STOCK"

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String userEmail;

    @Builder.Default
    @Column(nullable = false, length = 20)
    private String level = "INFO";

    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (this.timestamp == null) {
            this.timestamp = now;
        }
        if (this.level == null) {
            this.level = "INFO";
        }
        if (this.getCreatedAt() == null) {
            this.setCreatedAt(now);
        }
        if (this.getUpdatedAt() == null) {
            this.setUpdatedAt(now);
        }
    }

    @PreUpdate
    protected void onUpdate() {
        if (this.getUpdatedAt() == null) {
            this.setUpdatedAt(LocalDateTime.now());
        }
    }
}