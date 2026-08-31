package com.baez.baezpos.provider.repository;

import com.baez.baezpos.provider.entity.ProviderProduct;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProviderProductRepository extends JpaRepository<ProviderProduct, Long> {
    Page<ProviderProduct> findByCompanyIdAndProviderId(Long companyId, Long providerId, Pageable pageable);
    Optional<ProviderProduct> findByCompanyIdAndProviderIdAndProductId(Long companyId, Long providerId, Long productId);
}
