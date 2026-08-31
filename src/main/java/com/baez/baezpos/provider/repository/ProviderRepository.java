package com.baez.baezpos.provider.repository;

import com.baez.baezpos.provider.entity.Provider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProviderRepository extends JpaRepository<Provider, Long> {

    List<Provider> findByCompanyId(Long companyId);

    List<Provider> findByCompanyIdAndActiveTrueOrderByIdDesc(Long companyId);

    List<Provider> findByCompanyIdAndActiveTrue(Long companyId);

    org.springframework.data.domain.Page<Provider> findByCompanyIdAndActiveTrue(Long companyId, org.springframework.data.domain.Pageable pageable);

    Optional<Provider> findByIdAndCompanyId(Long id, Long companyId);

    Optional<Provider> findByIdAndCompanyIdAndActiveTrue(Long id, Long companyId);

    @Query("SELECT p FROM Provider p WHERE p.company.id = :companyId AND p.active = true AND " +
            "(LOWER(p.businessName) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(p.taxId) LIKE LOWER(CONCAT('%', :query, '%')))")
    List<Provider> searchProvidersByCompanyId(@Param("query") String query, @Param("companyId") Long companyId);

    @Query("SELECT p FROM Provider p WHERE p.company.id = :companyId AND p.active = true AND " +
            "(LOWER(p.businessName) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(p.taxId) LIKE LOWER(CONCAT('%', :query, '%')))")
    org.springframework.data.domain.Page<Provider> searchProvidersByCompanyId(@Param("query") String query, @Param("companyId") Long companyId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.currentBalance), 0) FROM Provider p WHERE p.company.id = :companyId AND p.active = true")
    BigDecimal sumAllBalancesByCompanyId(@Param("companyId") Long companyId);
}
