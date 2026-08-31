package com.baez.baezpos.provider.repository;

import com.baez.baezpos.provider.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    Page<PurchaseOrder> findByCompanyIdOrderByOrderDateDesc(Long companyId, Pageable pageable);
    Page<PurchaseOrder> findByCompanyIdAndProviderIdOrderByOrderDateDesc(Long companyId, Long providerId, Pageable pageable);
    Optional<PurchaseOrder> findByIdAndCompanyId(Long id, Long companyId);
}
