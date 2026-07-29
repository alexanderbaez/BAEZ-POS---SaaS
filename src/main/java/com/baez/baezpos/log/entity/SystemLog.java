package com.baez.baezpos.log.entity;

import com.baez.baezpos.shared.entity.TenantEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "system_logs")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@SuperBuilder
public class SystemLog extends TenantEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String action; // Ej: "VENTA", "ELIMINACION_PRODUCTO", "AJUSTE_STOCK"

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private String userEmail;

    // ➕ Agregamos el campo level para evitar el error de MySQL
    @Builder.Default
    @Column(nullable = false)
    private String level = "INFO";

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

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