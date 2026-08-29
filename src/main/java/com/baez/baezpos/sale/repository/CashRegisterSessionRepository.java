package com.baez.baezpos.sale.repository;

import com.baez.baezpos.sale.entity.CashRegisterSession;
import com.baez.baezpos.sale.entity.CashSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CashRegisterSessionRepository extends JpaRepository<CashRegisterSession, Long> {

    /**
     * MED-03: Propagation.MANDATORY garantiza que este UPDATE no pueda ejecutarse
     * fuera del contexto transaccional de createSale. Si se llama sin transaccion activa
     * lanza IllegalTransactionStateException, previniendo actualizaciones huerfanas.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    @Modifying
    @Query("UPDATE CashRegisterSession c SET c.systemAmount = COALESCE(c.systemAmount, 0) + :amount WHERE c.id = :id")
    void addBalance(@Param("id") Long id, @Param("amount") BigDecimal amount);

    Optional<CashRegisterSession> findFirstByCompanyIdAndStatusOrderByIdDesc(Long companyId, CashSessionStatus status);
    boolean existsByCompanyIdAndStatus(Long companyId, CashSessionStatus status);

    // Cuenta cuántas cajas se han abierto en el día de hoy para asignar la secuencia (1, 2, 3...)
    @Query("SELECT COUNT(s) FROM CashRegisterSession s WHERE s.company.id = :companyId AND s.openedAt BETWEEN :start AND :end")
    int countSessionsByCompanyAndDateRange(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    /**
     * CRIT-03: Limita el arrastre de cajas OPEN huerfanas a un maximo de 48 horas.
     * Sin este cutoff, una caja olvidada de dias anteriores inflaria los totales del dashboard actual.
     */
    @Query("SELECT s FROM CashRegisterSession s WHERE s.company.id = :companyId " +
            "AND ((s.openedAt BETWEEN :start AND :end) OR (s.status = 'OPEN' AND s.openedAt >= :cutoff)) " +
            "ORDER BY s.id DESC")
    List<CashRegisterSession> findCommercialDaySessions(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("cutoff") LocalDateTime cutoff
    );
}