package com.baez.baezpos.inventory.repository;

import com.baez.baezpos.inventory.entity.InventoryMovement;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryRepository extends JpaRepository<InventoryMovement, Long> {

    @Query("SELECT m FROM InventoryMovement m JOIN FETCH m.product WHERE m.product.id = :productId AND m.company.id = :companyId ORDER BY m.createdAt DESC")
    List<InventoryMovement> findByProductIdAndCompanyIdOrderByCreatedAtDesc(@Param("productId") Long productId, @Param("companyId") Long companyId);

    @Query("SELECT m FROM InventoryMovement m JOIN FETCH m.product WHERE m.product.id = :productId ORDER BY m.createdAt DESC")
    List<InventoryMovement> findByProductIdOrderByCreatedAtDesc(@Param("productId") Long productId);

    @Query("SELECT m FROM InventoryMovement m JOIN FETCH m.product WHERE m.company.id = :companyId ORDER BY m.createdAt DESC")
    List<InventoryMovement> findByCompanyIdOrderByCreatedAtDesc(@Param("companyId") Long companyId, Pageable pageable);

    @Query("SELECT m FROM InventoryMovement m JOIN FETCH m.product ORDER BY m.createdAt DESC")
    List<InventoryMovement> findAllRecentForSuperAdmin(Pageable pageable);
}