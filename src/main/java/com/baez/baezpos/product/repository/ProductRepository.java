package com.baez.baezpos.product.repository;

import com.baez.baezpos.product.entity.Product;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    @Modifying
    @Query("UPDATE Product p SET p.stock = p.stock - :quantity WHERE p.id = :id AND (p.stock >= :quantity OR p.stock < 0)")
    int decrementStock(@Param("id") Long id, @Param("quantity") BigDecimal quantity);

    Optional<Product> findByIdAndCompanyId(Long id, Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.barcode = :barcode AND p.company.id = :companyId")
    Optional<Product> findByBarcodeAndCompanyIdWithCategory(@Param("barcode") String barcode, @Param("companyId") Long companyId);

    @EntityGraph(attributePaths = {"category"})
    org.springframework.data.domain.Page<Product> findByCompanyIdAndActiveTrue(Long companyId, org.springframework.data.domain.Pageable pageable);

    @EntityGraph(attributePaths = {"category"})
    org.springframework.data.domain.Page<Product> findByActiveTrue(org.springframework.data.domain.Pageable pageable);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.company.id = :companyId AND p.active = true")
    List<Product> findByActiveTrueWithCategoryAndCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.company.id = :companyId AND p.active = false")
    List<Product> findByActiveFalseWithCategoryAndCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.active = true")
    List<Product> findAllActiveWithCategory();

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.active = false")
    List<Product> findAllInactiveWithCategory();

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category " +
           "WHERE p.company.id = :companyId AND p.active = true " +
           "AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :term, '%')) " +
           "     OR LOWER(p.barcode) LIKE LOWER(CONCAT('%', :term, '%')) " +
           "     OR (p.category IS NOT NULL AND LOWER(p.category.name) LIKE LOWER(CONCAT('%', :term, '%')))) " +
           "ORDER BY CASE WHEN p.barcode = :term THEN 0 WHEN LOWER(p.name) LIKE LOWER(CONCAT(:term, '%')) THEN 1 ELSE 2 END, p.name ASC")
    List<Product> searchByTermAndCompanyId(@Param("companyId") Long companyId, @Param("term") String term, org.springframework.data.domain.Pageable pageable);
}