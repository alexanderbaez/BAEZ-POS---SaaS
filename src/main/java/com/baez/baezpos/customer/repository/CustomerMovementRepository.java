package com.baez.baezpos.customer.repository;

import com.baez.baezpos.customer.entities.CustomerMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerMovementRepository extends JpaRepository<CustomerMovement, Long> {

    List<CustomerMovement> findByCustomerIdAndCustomerCompanyIdOrderByIdDesc(Long customerId, Long companyId);

    List<CustomerMovement> findByCustomerIdOrderByIdDesc(Long customerId);

    @Query("SELECT COALESCE(SUM(cm.amount), 0) FROM CustomerMovement cm " +
            "WHERE cm.customer.company.id = :companyId AND cm.type = 'CREDITO' AND cm.createdAt BETWEEN :start AND :end")
    BigDecimal sumCreditsByDateRangeAndCompanyId(@Param("companyId") Long companyId,
                                                 @Param("start") LocalDateTime start,
                                                 @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(cm.amount), 0) FROM CustomerMovement cm " +
            "WHERE cm.customer.company.id = :companyId AND cm.type = 'CREDITO' AND UPPER(cm.paymentMethod) = UPPER(:method) " +
            "AND cm.createdAt BETWEEN :start AND :end")
    BigDecimal sumPaymentsByMethodAndCompanyId(@Param("method") String method,
                                               @Param("companyId") Long companyId,
                                               @Param("start") LocalDateTime start,
                                               @Param("end") LocalDateTime end);

    @Query("SELECT COALESCE(SUM(cm.amount), 0) FROM CustomerMovement cm " +
            "WHERE cm.customer.company.id = :companyId AND cm.type = 'CREDITO' AND UPPER(cm.paymentMethod) = UPPER(:method) " +
            "AND ((:sessionId IS NOT NULL AND cm.cashRegisterSession.id = :sessionId) OR (cm.cashRegisterSession IS NULL AND cm.createdAt BETWEEN :start AND :end))")
    BigDecimal sumPaymentsBySessionAndMethod(@Param("method") String method,
                                             @Param("companyId") Long companyId,
                                             @Param("sessionId") Long sessionId,
                                             @Param("start") LocalDateTime start,
                                             @Param("end") LocalDateTime end);

    /**
     * MED-04: Versión con tenant-scope obligatorio.
     * Navega Customer.company.id para garantizar que el movimiento pertenece
     * a la misma empresa del usuario autenticado — defense in depth en anulación de ventas.
     */
    Optional<CustomerMovement> findFirstBySaleIdAndCustomerCompanyId(Long saleId, Long companyId);

    @Query("SELECT cm FROM CustomerMovement cm JOIN FETCH cm.customer c " +
           "WHERE c.company.id = :companyId AND cm.type = 'CREDITO' " +
           "ORDER BY cm.createdAt DESC")
    List<CustomerMovement> findRecentPaymentsByCompanyId(@Param("companyId") Long companyId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT cm FROM CustomerMovement cm JOIN FETCH cm.customer c " +
           "WHERE c.company.id = :companyId AND cm.type = 'CREDITO' " +
           "AND cm.createdAt BETWEEN :start AND :end " +
           "ORDER BY cm.createdAt DESC")
    List<CustomerMovement> findPaymentsByCompanyIdAndDateRange(@Param("companyId") Long companyId,
                                                               @Param("start") LocalDateTime start,
                                                               @Param("end") LocalDateTime end,
                                                               org.springframework.data.domain.Pageable pageable);
}