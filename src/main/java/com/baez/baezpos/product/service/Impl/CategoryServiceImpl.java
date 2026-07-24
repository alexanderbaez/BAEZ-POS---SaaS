package com.baez.baezpos.product.service.Impl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.product.dto.CategoryRequestDTO;
import com.baez.baezpos.product.dto.CategoryResponseDTO;
import com.baez.baezpos.product.entity.Category;
import com.baez.baezpos.product.repository.CategoryRepository;
import com.baez.baezpos.product.service.service.CategoryService;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final CompanyRepository companyRepository;

    @Override
    @Transactional
    public CategoryResponseDTO createCategory(CategoryRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        // 1. Buscamos si el nombre ya existe DENTRO de la misma empresa
        Optional<Category> existing = categoryRepository.findByNameAndCompanyId(dto.name(), companyId);

        if (existing.isPresent()) {
            Category category = existing.get();
            if (category.getActive()) {
                throw new RuntimeException("Ya existe una categoría activa con ese nombre");
            } else {
                // Reanimación de categoría borrada
                category.setActive(true);
                category.setDescription(dto.description());
                return mapToResponseDTO(categoryRepository.save(category));
            }
        }

        // 2. Creación con la Company del usuario
        Company company = companyRepository.getReferenceById(companyId);

        Category newCategory = Category.builder()
                .name(dto.name())
                .description(dto.description())
                .company(company) // <-- ASIGNAMOS LA EMPRESA
                .active(true)
                .build();

        return mapToResponseDTO(categoryRepository.save(newCategory));
    }

    @Override
    public List<CategoryResponseDTO> getAllCategories() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return categoryRepository.findByCompanyIdAndActiveTrue(companyId).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    public CategoryResponseDTO getCategoryById(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return categoryRepository.findByIdAndCompanyId(id, companyId)
                .map(this::mapToResponseDTO)
                .orElseThrow(() -> new RuntimeException("Categoría no encontrada"));
    }

    @Override
    @Transactional
    public CategoryResponseDTO updateCategory(Long id, CategoryRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Categoría no encontrada"));

        category.setName(dto.name());
        category.setDescription(dto.description());

        return mapToResponseDTO(categoryRepository.save(category));
    }

    @Override
    @Transactional
    public void deleteCategory(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Categoría no encontrada"));

        category.setActive(false);
        categoryRepository.save(category);
    }

    @Override
    public List<CategoryResponseDTO> getDeletedCategories() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return categoryRepository.findByCompanyIdAndActiveFalse(companyId).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional
    public CategoryResponseDTO activateCategory(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Categoría no encontrada"));

        category.setActive(true);
        return mapToResponseDTO(categoryRepository.save(category));
    }

    private CategoryResponseDTO mapToResponseDTO(Category c) {
        return new CategoryResponseDTO(c.getId(), c.getName(), c.getDescription());
    }
}