package com.baez.baezpos.company.repository;

import com.baez.baezpos.company.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CompanyRepository extends JpaRepository<Company, Long> {
    boolean existsByTaxId(String taxId);
    Optional<Company> findByTaxId(String taxId);
    Optional<Company> findByEmail(String email);

    List<Company> findByActiveTrue();
    long countByActiveTrue(); // <--- Optimización de rendimiento para Stats
}