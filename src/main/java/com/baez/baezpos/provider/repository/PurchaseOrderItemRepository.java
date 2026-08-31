package com.baez.baezpos.provider.repository;

import com.baez.baezpos.provider.entity.PurchaseOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseOrderItemRepository extends JpaRepository<PurchaseOrderItem, Long> {
    List<PurchaseOrderItem> findByCompanyIdAndPurchaseOrderId(Long companyId, Long purchaseOrderId);
}
