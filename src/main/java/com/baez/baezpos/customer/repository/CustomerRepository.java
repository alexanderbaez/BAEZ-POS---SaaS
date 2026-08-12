package com.baez.baezpos.customer.repository;

import com.baez.baezpos.customer.entities.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    List<Customer> findByCompanyId(Long companyId);

    List<Customer> findByCompanyIdAndActiveTrue(Long companyId);

    Optional<Customer> findByIdAndCompanyId(Long id, Long companyId);

    @Query("SELECT c FROM Customer c WHERE c.company.id = :companyId AND c.active = true AND " +
            "(LOWER(c.name) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(c.dniCuit) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Customer> searchCustomersByCompanyId(@Param("query") String query, @Param("companyId") Long companyId);

    @Query("SELECT COALESCE(SUM(c.currentBalance), 0) FROM Customer c WHERE c.company.id = :companyId AND c.active = true")
    BigDecimal sumAllBalancesByCompanyId(@Param("companyId") Long companyId);
}