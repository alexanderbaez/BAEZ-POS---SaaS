package com.baez.baezpos.sale.repository;

import com.baez.baezpos.sale.entity.Sale;
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

    Optional<Sale> findByIdAndCompanyId(Long id, Long companyId);

    @Query("SELECT COALESCE(SUM(s.total), 0) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    BigDecimal sumTotalByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(s) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    long countByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    List<Sale> findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(Long companyId, LocalDateTime start, LocalDateTime end);

    List<Sale> findBySaleDateBetweenOrderBySaleDateDesc(LocalDateTime start, LocalDateTime end);

    List<Sale> findByCompanyIdAndCanceledFalse(Long companyId);

    List<Sale> findByCompanyIdAndSaleDateBetweenAndCanceledFalse(Long companyId, LocalDateTime start, LocalDateTime end);

    List<Sale> findBySaleDateBetweenAndCanceledFalse(LocalDateTime start, LocalDateTime end);

    List<Sale> findByCompanyIdOrderBySaleDateDesc(Long companyId);

    List<Sale> findAllByOrderBySaleDateDesc();
}