package com.baez.baezpos.product.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.product.dto.CategoryRequestDTO;
import com.baez.baezpos.product.dto.CategoryResponseDTO;
import com.baez.baezpos.product.entity.Category;
import com.baez.baezpos.product.repository.CategoryRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
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
        Long companyId = requireCompanyContext();

        if (dto.name() == null || dto.name().isBlank()) {
            throw new BadRequestException("El nombre de la categoría es obligatorio.");
        }

        String categoryName = dto.name().trim();

        Optional<Category> existing = categoryRepository.findByNameAndCompanyId(categoryName, companyId);
        if (existing.isPresent()) {
            Category category = existing.get();
            if (category.getActive()) {
                throw new BadRequestException("Ya existe una categoría activa con el nombre '" + categoryName + "'");
            } else {
                category.setActive(true);
                category.setDescription(dto.description());
                return mapToResponseDTO(categoryRepository.save(category));
            }
        }

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        Category newCategory = Category.builder()
                .name(categoryName)
                .description(dto.description())
                .company(company)
                .active(true)
                .build();

        return mapToResponseDTO(categoryRepository.save(newCategory));
    }

    @Override
    @Transactional(readOnly = true)
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
    public CategoryResponseDTO updateCategory(Long id, CategoryRequestDTO dto) {
        Long companyId = requireCompanyContext();

        if (dto.name() == null || dto.name().isBlank()) {
            throw new BadRequestException("El nombre de la categoría es obligatorio.");
        }

        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        category.setName(dto.name().trim());
        category.setDescription(dto.description());

        return mapToResponseDTO(categoryRepository.save(category));
    }

    @Override
    @Transactional
    public void deleteCategory(Long id) {
        Long companyId = requireCompanyContext();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        category.setActive(false);
        categoryRepository.save(category);
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
    public CategoryResponseDTO activateCategory(Long id) {
        Long companyId = requireCompanyContext();
        Category category = categoryRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        category.setActive(true);
        return mapToResponseDTO(categoryRepository.save(category));
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