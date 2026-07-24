package com.baez.baezpos.sale.repository;

import com.baez.baezpos.sale.entity.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    Optional<Sale> findByIdAndCompanyId(Long id, Long companyId);

    // CONSULTA MAESTRA PARA DASHBOARD FILTRADA POR EMPRESA
    @Query(value = "SELECT date(sale_date) as fecha, " +
            "SUM(CASE WHEN payment_method = 'EFECTIVO' THEN total ELSE 0 END) as efectivo, " +
            "SUM(CASE WHEN payment_method = 'TRANSFERENCIA' THEN total ELSE 0 END) as transferencia, " +
            "SUM(CASE WHEN payment_method = 'CUENTA_CORRIENTE' THEN total ELSE 0 END) as fiado, " +
            "SUM(total) as total_dia " +
            "FROM sales WHERE company_id = :companyId AND date(sale_date) = :today AND canceled = 0", nativeQuery = true)
    List<Object[]> getTodayStats(@Param("companyId") Long companyId, @Param("today") String today);

    // GRÁFICO DE 7 DÍAS FILTRADO POR EMPRESA
    @Query(value = "SELECT date(sale_date) as fecha, SUM(total) as total " +
            "FROM sales WHERE company_id = :companyId AND date(sale_date) >= date('now', 'localtime', '-7 days') AND canceled = 0 " +
            "GROUP BY date(sale_date) ORDER BY fecha ASC", nativeQuery = true)
    List<Object[]> getSalesChartData(@Param("companyId") Long companyId);

    @Query("SELECT COALESCE(SUM(s.total), 0) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    BigDecimal sumTotalByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    @Query("SELECT COUNT(s) FROM Sale s WHERE s.company.id = :companyId AND s.saleDate BETWEEN :start AND :end AND s.canceled = false")
    long countByDateRangeAndCompanyId(@Param("companyId") Long companyId, @Param("start") LocalDateTime start, @Param("end") LocalDateTime end);

    List<Sale> findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(Long companyId, LocalDateTime start, LocalDateTime end);

    List<Sale> findByCompanyIdAndCanceledFalse(Long companyId);

    List<Sale> findByCompanyIdAndSaleDateBetweenAndCanceledFalse(Long companyId, LocalDateTime start, LocalDateTime end);

    List<Sale> findByCompanyIdOrderBySaleDateDesc(Long companyId);
}