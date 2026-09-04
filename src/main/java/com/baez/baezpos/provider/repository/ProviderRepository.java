package com.baez.baezpos.provider.repository;

import com.baez.baezpos.provider.entity.Provider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProviderRepository extends JpaRepository<Provider, Long> {

    org.springframework.data.domain.Page<Provider> findByCompanyIdAndActiveTrue(Long companyId, org.springframework.data.domain.Pageable pageable);

    org.springframework.data.domain.Page<Provider> findByCompanyIdAndActiveTrueOrderByBusinessNameAsc(Long companyId, org.springframework.data.domain.Pageable pageable);

    org.springframework.data.domain.Page<Provider> findByCompanyIdOrderByBusinessNameAsc(Long companyId, org.springframework.data.domain.Pageable pageable);

    List<Provider> findByCompanyIdAndActiveTrueOrderByBusinessNameAsc(Long companyId);

    List<Provider> findByCompanyIdOrderByBusinessNameAsc(Long companyId);

    Optional<Provider> findByIdAndCompanyId(Long id, Long companyId);

    Optional<Provider> findByIdAndCompanyIdAndActiveTrue(Long id, Long companyId);

    @Query("SELECT p FROM Provider p WHERE p.company.id = :companyId AND p.active = true AND " +
            "(LOWER(p.businessName) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(p.taxId) LIKE LOWER(CONCAT('%', :query, '%'))) " +
            "ORDER BY p.businessName ASC")
    org.springframework.data.domain.Page<Provider> searchProvidersByCompanyId(@Param("query") String query, @Param("companyId") Long companyId, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.currentBalance), 0) FROM Provider p WHERE p.company.id = :companyId AND p.active = true")
    BigDecimal sumAllBalancesByCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT COALESCE(SUM(p.currentBalance), 0) FROM Provider p WHERE p.company.id = :companyId AND p.active = true AND p.currentBalance > 0")
    BigDecimal sumTotalDebtByCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT COUNT(p) FROM Provider p WHERE p.company.id = :companyId AND p.active = true AND p.currentBalance > 0")
    Long countProvidersWithDebtByCompanyId(@Param("companyId") Long companyId);

    Long countByCompanyIdAndActiveTrueAndCurrentBalanceGreaterThan(Long companyId, BigDecimal currentBalance);
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Provider p SET p.currentBalance = p.currentBalance - :amount WHERE p.id = :id")
    int subtractBalance(@Param("id") Long id, @Param("amount") BigDecimal amount);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE Provider p SET p.currentBalance = p.currentBalance + :amount WHERE p.id = :id")
    int addBalance(@Param("id") Long id, @Param("amount") BigDecimal amount);
}
