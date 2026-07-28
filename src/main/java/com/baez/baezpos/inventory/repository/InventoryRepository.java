package com.baez.baezpos.inventory.repository;

import com.baez.baezpos.inventory.entity.InventoryMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryRepository extends JpaRepository<InventoryMovement, Long> {

    List<InventoryMovement> findByProductIdAndCompanyIdOrderByCreatedAtDesc(Long productId, Long companyId);
    List<InventoryMovement> findByProductIdOrderByCreatedAtDesc(Long productId);
    List<InventoryMovement> findByCompanyIdOrderByCreatedAtDesc(Long companyId);
}