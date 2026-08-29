package com.baez.baezpos.product.repository;

import com.baez.baezpos.product.entity.Product;
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

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.company.id = :companyId AND p.active = true")
    List<Product> findByActiveTrueWithCategoryAndCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.company.id = :companyId AND p.active = false")
    List<Product> findByActiveFalseWithCategoryAndCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.active = true")
    List<Product> findAllActiveWithCategory();

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.active = false")
    List<Product> findAllInactiveWithCategory();

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.company.id = :companyId AND p.active = true AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :term, '%')) OR LOWER(p.barcode) LIKE LOWER(CONCAT('%', :term, '%')))")
    List<Product> searchByTermAndCompanyId(@Param("companyId") Long companyId, @Param("term") String term);
}