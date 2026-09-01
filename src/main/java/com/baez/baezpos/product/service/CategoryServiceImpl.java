package com.baez.baezpos.product.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.product.dto.CategoryRequestDTO;
import com.baez.baezpos.product.dto.CategoryResponseDTO;
import com.baez.baezpos.product.entity.Category;
import com.baez.baezpos.product.repository.CategoryRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final CompanyRepository companyRepository;
    private final AuditService auditService;

    @Override
    @Transactional
    @CacheEvict(value = "tenant_categories", key = "T(com.baez.baezpos.security.util.SecurityUtils).getCurrentCompanyId()")
    public CategoryResponseDTO createCategory(CategoryRequestDTO dto) {
        Long companyId = requireCompanyContext();
        String categoryName = dto.name().trim();

        categoryRepository.findByNameAndCompanyId(categoryName, companyId).ifPresent(c -> {
            if (c.getActive()) {
                throw new BadRequestException("Ya existe una categoría activa con el nombre '" + categoryName + "'");
            }
        });

        Company companyRef = companyRepository.getReferenceById(companyId);

        Category newCategory = Category.builder()
                .name(categoryName)
                .description(dto.description())
                .company(companyRef)
                .active(true)
                .build();

        Category saved = categoryRepository.save(newCategory);
        auditService.logAction("CREACION_CATEGORIA", "Categoría creada: " + saved.getName(), "INFO");

        return mapToResponseDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = "tenant_categories", key = "T(com.baez.baezpos.security.util.SecurityUtils).getCurrentCompanyId()")
    public List<CategoryResponseDTO> getAllCategories() {
        Long companyId = requireCompanyContext();
        return categoryRepository.findByCompanyIdAndActiveTrue(companyId).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public CategoryResponseDTO getCategoryById(Long id) {
        Long companyId = requireCompanyContext();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));
        return mapToResponseDTO(category);
    }

    @Override
    @Transactional
    @CacheEvict(value = "tenant_categories", key = "T(com.baez.baezpos.security.util.SecurityUtils).getCurrentCompanyId()")
    public CategoryResponseDTO updateCategory(Long id, CategoryRequestDTO dto) {
        Long companyId = requireCompanyContext();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        category.setName(dto.name().trim());
        category.setDescription(dto.description());

        Category updated = categoryRepository.save(category);
        auditService.logAction("ACTUALIZACION_CATEGORIA", "Categoría actualizada ID: " + id, "INFO");

        return mapToResponseDTO(updated);
    }

    @Override
    @Transactional
    @CacheEvict(value = "tenant_categories", key = "T(com.baez.baezpos.security.util.SecurityUtils).getCurrentCompanyId()")
    public void deleteCategory(Long id) {
        Long companyId = requireCompanyContext();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        category.setActive(false);
        categoryRepository.save(category);
        auditService.logAction("ELIMINACION_CATEGORIA", "Categoría desactivada: " + category.getName(), "WARN");
    }

    @Override
    @Transactional(readOnly = true)
    public List<CategoryResponseDTO> getDeletedCategories() {
        Long companyId = requireCompanyContext();
        return categoryRepository.findByCompanyIdAndActiveFalse(companyId).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional
    @CacheEvict(value = "tenant_categories", key = "T(com.baez.baezpos.security.util.SecurityUtils).getCurrentCompanyId()")
    public CategoryResponseDTO activateCategory(Long id) {
        Long companyId = requireCompanyContext();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        category.setActive(true);
        Category saved = categoryRepository.save(category);
        auditService.logAction("ACTIVACION_CATEGORIA", "Categoría reactivada: " + category.getName(), "INFO");

        return mapToResponseDTO(saved);
    }

    private Long requireCompanyContext() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("Acceso denegado: Operación requiere un contexto de empresa válido.");
        }
        return companyId;
    }

    private CategoryResponseDTO mapToResponseDTO(Category c) {
        return new CategoryResponseDTO(c.getId(), c.getName(), c.getDescription());
    }
}