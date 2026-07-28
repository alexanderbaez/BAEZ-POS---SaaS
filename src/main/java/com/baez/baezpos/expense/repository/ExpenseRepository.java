package com.baez.baezpos.expense.repository;

import com.baez.baezpos.expense.entity.Expense;
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

    List<Expense> findByCompanyIdOrderByExpenseDateDesc(Long companyId);

    Optional<Expense> findByIdAndCompanyId(Long id, Long companyId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.company.id = :companyId AND e.expenseDate BETWEEN :start AND :end")
    BigDecimal sumTotalByDateRangeAndCompanyId(
            @Param("companyId") Long companyId,
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end);
}