package com.baez.baezpos.sale.repository;

import com.baez.baezpos.sale.entity.CashRegisterSession;
import com.baez.baezpos.sale.entity.CashSessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CashRegisterSessionRepository extends JpaRepository<CashRegisterSession, Long> {

    Optional<CashRegisterSession> findFirstByCompanyIdAndStatusOrderByIdDesc(Long companyId, CashSessionStatus status);
    boolean existsByCompanyIdAndStatus(Long companyId, CashSessionStatus status);

    // Cuenta cuántas cajas se han abierto en el día de hoy para asignar la secuencia (1, 2, 3...)
    @Query("SELECT COUNT(s) FROM CashRegisterSession s WHERE s.company.id = :companyId AND s.openedAt BETWEEN :start AND :end")
    int countSessionsByCompanyAndDateRange(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );

    // JORNADA COMERCIAL: Cajas que abrieron hoy O que continúan en estado 'OPEN' (cajas de trasnoche pasadas las 00:00 hs)
    @Query("SELECT s FROM CashRegisterSession s WHERE s.company.id = :companyId " +
            "AND ((s.openedAt BETWEEN :start AND :end) OR s.status = 'OPEN') " +
            "ORDER BY s.id DESC")
    List<CashRegisterSession> findCommercialDaySessions(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end
    );
}