package com.baez.baezpos.product.repository;

import com.baez.baezpos.product.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    Optional<Product> findByIdAndCompanyId(Long id, Long companyId);
    Optional<Product> findByBarcodeAndCompanyId(String barcode, Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.company.id = :companyId AND p.active = true")
    List<Product> findByActiveTrueWithCategoryAndCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.company.id = :companyId AND p.active = false")
    List<Product> findByActiveFalseWithCategoryAndCompanyId(@Param("companyId") Long companyId);

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.active = true")
    List<Product> findAllActiveWithCategory();

    @Query("SELECT p FROM Product p LEFT JOIN FETCH p.category WHERE p.active = false")
    List<Product> findAllInactiveWithCategory();
}