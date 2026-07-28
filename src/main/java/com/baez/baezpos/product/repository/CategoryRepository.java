package com.baez.baezpos.product.repository;

import com.baez.baezpos.product.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CategoryRepository extends JpaRepository<Category, Long> {

    Optional<Category> findByIdAndCompanyId(Long id, Long companyId);
    Optional<Category> findByNameAndCompanyId(String name, Long companyId);
    List<Category> findByCompanyIdAndActiveTrue(Long companyId);
    List<Category> findByCompanyIdAndActiveFalse(Long companyId);
    List<Category> findByActiveTrue();
    List<Category> findByActiveFalse();
}