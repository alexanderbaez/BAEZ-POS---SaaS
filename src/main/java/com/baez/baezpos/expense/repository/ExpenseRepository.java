package com.baez.baezpos.expense.repository;

import com.baez.baezpos.expense.entity.Expense;
import com.baez.baezpos.shared.entity.PaymentMethod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {


    org.springframework.data.domain.Page<Expense> findByCompanyId(Long companyId, org.springframework.data.domain.Pageable pageable);

    org.springframework.data.domain.Page<Expense> findByCompanyIdOrderByExpenseDateDesc(Long companyId, org.springframework.data.domain.Pageable pageable);

    org.springframework.data.domain.Page<Expense> findByCompanyIdAndExpenseDateBetweenOrderByExpenseDateDesc(Long companyId, LocalDateTime start, LocalDateTime end, org.springframework.data.domain.Pageable pageable);

    Optional<Expense> findByIdAndCompanyId(Long id, Long companyId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.company.id = :companyId AND e.expenseDate BETWEEN :start AND :end")
    BigDecimal sumTotalByDateRangeAndCompanyId(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    @Deprecated
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.company.id = :companyId AND e.deductFromBox = true AND e.expenseDate BETWEEN :start AND :end")
    BigDecimal sumDeductibleExpensesByCompanyIdAndDate(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    // ==========================================
    // CONSULTAS PRECISAS PARA ARQUEO DE CAJA
    // ==========================================

    /**
     * Gastos Deducibles pagados estrictamente con un Medio de Pago específico.
     * Utiliza el Enum com.baez.baezpos.shared.entity.PaymentMethod (EFECTIVO_CAJA, TRANSFERENCIA, TARJETA)
     */
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e " +
            "WHERE e.company.id = :companyId " +
            "AND e.deductFromBox = true " +
            "AND e.paymentMethod = :paymentMethod " +
            "AND e.expenseDate BETWEEN :start AND :end")
    BigDecimal sumDeductibleExpensesByPaymentMethod(
            @Param("companyId") Long companyId,
            @Param("paymentMethod") PaymentMethod paymentMethod,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);

    /**
     * Método directo para obtener Gastos Deducibles en EFECTIVO_CAJA.
     */
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e " +
            "WHERE e.company.id = :companyId " +
            "AND e.deductFromBox = true " +
            "AND e.paymentMethod = com.baez.baezpos.shared.entity.PaymentMethod.EFECTIVO_CAJA " +
            "AND e.expenseDate BETWEEN :start AND :end")
    BigDecimal sumDeductibleCashExpenses(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);
}