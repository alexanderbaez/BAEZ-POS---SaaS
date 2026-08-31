package com.baez.baezpos.company.repository;

import com.baez.baezpos.company.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {

    @Modifying
    @Query("UPDATE Company c SET c.lastTicketNumber = COALESCE(c.lastTicketNumber, 0) + 1 WHERE c.id = :id")
    void incrementLastTicketNumber(@Param("id") Long id);

    boolean existsByTaxId(String taxId);
    Optional<Company> findByTaxId(String taxId);
    Optional<Company> findByEmail(String email);

    List<Company> findByActiveTrue();
    long countByActiveTrue(); // <--- Optimizaci\u00F3n de rendimiento para Stats
}