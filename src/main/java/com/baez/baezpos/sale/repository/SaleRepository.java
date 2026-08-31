package com.baez.baezpos.sale.repository;

import com.baez.baezpos.sale.dto.SessionSalesProjection;
import com.baez.baezpos.sale.entity.Sale;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    Optional<Sale> findByIdAndCompanyId(Long id, Long companyId);

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    List<Sale> findByCompanyIdOrderBySaleDateDesc(Long companyId);

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    org.springframework.data.domain.Page<Sale> findByCompanyIdOrderBySaleDateDesc(Long companyId, org.springframework.data.domain.Pageable pageable);

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    List<Sale> findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(Long companyId, LocalDateTime start, LocalDateTime end);

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    org.springframework.data.domain.Page<Sale> findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(Long companyId, LocalDateTime start, LocalDateTime end, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT s FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    List<Sale> findActiveSalesByCompanyAndDateRange(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(s.total), 0) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    BigDecimal sumTotalByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(s) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    long countByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    /**
     * CRIT-02: Filtro de companyId a\u00F1adido como defensa de segunda l\u00EDnea.
     * La query ahora es autosuficiente en seguridad sin depender del contexto de llamada.
     */
    @Query("SELECT s FROM Sale s WHERE s.cashRegisterSession.id = :sessionId AND s.company.id = :companyId AND s.canceled = false")
    List<Sale> findActiveSalesBySessionIdAndCompanyId(@Param("sessionId") Long sessionId, @Param("companyId") Long companyId);

    /**
     * CRIT-01: Query agregada para eliminar el N+1 en getBoxReport().
     * Retorna (sessionId, paymentMethod, SUM(total)) agrupado \u2014 un solo viaje a la BD
     * en lugar de 1 SELECT * por cada sesi\u00F3n de la jornada.
     */
    @Query("SELECT s.cashRegisterSession.id AS sessionId, s.paymentMethod AS paymentMethod, " +
            "COALESCE(SUM(s.total), 0) AS total " +
            "FROM Sale s WHERE s.cashRegisterSession.id IN :sessionIds AND s.canceled = false " +
            "GROUP BY s.cashRegisterSession.id, s.paymentMethod")
    List<SessionSalesProjection> aggregateSalesBySessionIds(@Param("sessionIds") List<Long> sessionIds);

    /**
     * Agregaci\u00F3n masiva de costo de reposici\u00F3n: calcula SUM(item.cost * item.quantity)
     * directamente en el motor SQL sin hidratar grafos de entidades en el heap.
     */
    @Query("SELECT COALESCE(SUM(i.cost * i.quantity), 0) FROM SaleItem i " +
            "WHERE i.sale.company.id = :companyId " +
            "AND i.sale.saleDate BETWEEN :start AND :end " +
            "AND i.sale.canceled = false " +
            "AND i.sale.paymentMethod != 'CUENTA_CORRIENTE'")
    BigDecimal calculateTotalReplacementCostByCompanyAndDate(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /**
     * Agregaci\u00F3n por m\u00E9todo de pago para rangos de auditor\u00EDa de caja.
     */
    @Query("SELECT s.paymentMethod AS paymentMethod, COUNT(s) AS count, COALESCE(SUM(s.total), 0) AS total " +
            "FROM Sale s " +
            "WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false " +
            "GROUP BY s.paymentMethod")
    List<com.baez.baezpos.sale.dto.PaymentMethodSummaryProjection> aggregateSalesByPaymentMethod(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);
}