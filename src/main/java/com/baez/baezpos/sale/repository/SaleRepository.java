package com.baez.baezpos.sale.repository;

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
    @Query("SELECT s FROM Sale s WHERE s.id = :id")
    Optional<Sale> findByIdWithDetails(@Param("id") Long id);

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    List<Sale> findByCompanyIdOrderBySaleDateDesc(Long companyId);

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    List<Sale> findAllByOrderBySaleDateDesc();

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    List<Sale> findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(Long companyId, LocalDateTime start, LocalDateTime end);

    @EntityGraph(attributePaths = {"user", "company", "items", "items.product"})
    List<Sale> findBySaleDateBetweenOrderBySaleDateDesc(LocalDateTime start, LocalDateTime end);

    @Query("SELECT s FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    List<Sale> findActiveSalesByCompanyAndDateRange(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(s.total), 0) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    BigDecimal sumTotalByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(s) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    long countByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT s FROM Sale s WHERE s.cashRegisterSession.id = :sessionId AND s.canceled = false")
    List<Sale> findActiveSalesBySessionId(@Param("sessionId") Long sessionId);
}