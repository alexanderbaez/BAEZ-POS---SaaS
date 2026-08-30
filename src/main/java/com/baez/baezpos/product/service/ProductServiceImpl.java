package com.baez.baezpos.product.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.product.dto.ProductRequestDTO;
import com.baez.baezpos.product.dto.ProductResponseDTO;
import com.baez.baezpos.product.entity.Category;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.CategoryRepository;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CompanyRepository companyRepository;
    private final AuditService auditService;

    @Override
    @Transactional
    public ProductResponseDTO createProduct(ProductRequestDTO dto) {
        Long companyId = requireCompanyContext();

        // 1. Validar duplicado por código de barras dentro de la misma empresa
        if (dto.barcode() != null && !dto.barcode().trim().isEmpty()) {
            Optional<Product> existing = productRepository.findByBarcodeAndCompanyIdWithCategory(dto.barcode().trim(), companyId);
            if (existing.isPresent()) {
                Product p = existing.get();
                if (p.getActive()) {
                    throw new BadRequestException("El producto con código '" + dto.barcode() + "' ya existe en su empresa.");
                }
                // Si estaba inactivo, se reactiva con los nuevos datos
                Category category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                        .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

                updateProductData(p, dto, category);
                p.setActive(true);
                Product saved = productRepository.save(p);
                auditService.logAction("REACTIVACION_PRODUCTO", "Producto reactivado mediante creación: " + saved.getName(), "INFO");
                return mapToResponseDTO(saved);
            }
        }

        // 2. Crear nuevo producto
        Category category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        Company companyRef = companyRepository.getReferenceById(companyId);

        Product newProduct = Product.builder()
                .name(dto.name().trim())
                .description(dto.description())
                .barcode(dto.barcode() != null ? dto.barcode().trim() : null)
                .cost(dto.cost())
                .price(dto.price())
                .stock(dto.stock() != null ? dto.stock() : BigDecimal.ZERO)
                .minStock(dto.minStock() != null ? dto.minStock() : BigDecimal.ZERO)
                .isFractional(dto.isFractional() != null && dto.isFractional())
                .category(category)
                .company(companyRef)
                .active(true)
                .build();

        Product saved = productRepository.save(newProduct);
        auditService.logAction("CREACION_PRODUCTO", "Producto creado: " + saved.getName() + " (ID: " + saved.getId() + ")", "INFO");

        return mapToResponseDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getAllProducts() {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        List<Product> products = (companyId != null)
                ? productRepository.findByActiveTrueWithCategoryAndCompanyId(companyId)
                : productRepository.findAllActiveWithCategory();

        return products.stream().map(this::mapToResponseDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ProductResponseDTO> getAllProducts(Pageable pageable) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        Page<Product> page = (companyId != null)
                ? productRepository.findByCompanyIdAndActiveTrue(companyId, pageable)
                : productRepository.findByActiveTrue(pageable);

        return page.map(this::mapToResponseDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponseDTO getProductById(Long id) {
        Long companyId = requireCompanyContext();

        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa"));

        return mapToResponseDTO(product);
    }

    @Override
    @Transactional
    public ProductResponseDTO updateProduct(Long id, ProductRequestDTO dto) {
        Long companyId = requireCompanyContext();

        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa"));

        Category category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        updateProductData(product, dto, category);
        Product updated = productRepository.save(product);

        auditService.logAction("ACTUALIZACION_PRODUCTO", "Producto actualizado: " + updated.getName() + " (ID: " + id + ")", "INFO");

        return mapToResponseDTO(updated);
    }

    @Override
    @Transactional
    public void deleteProduct(Long id) {
        Long companyId = requireCompanyContext();

        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa"));

        product.setActive(false);
        productRepository.save(product);

        auditService.logAction("ELIMINACION_PRODUCTO", "Producto desactivado: " + product.getName() + " (ID: " + id + ")", "WARN");
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProductResponseDTO> getByBarcode(String barcode) {
        Long companyId = requireCompanyContext();
        if (barcode == null || barcode.isBlank()) return Optional.empty();

        return productRepository.findByBarcodeAndCompanyIdWithCategory(barcode.trim(), companyId)
                .map(this::mapToResponseDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getDeletedProducts() {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        List<Product> products = (companyId != null)
                ? productRepository.findByActiveFalseWithCategoryAndCompanyId(companyId)
                : productRepository.findAllInactiveWithCategory();

        return products.stream().map(this::mapToResponseDTO).toList();
    }

    @Override
    @Transactional
    public ProductResponseDTO activateProduct(Long id) {
        Long companyId = requireCompanyContext();

        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa"));

        product.setActive(true);
        Product saved = productRepository.save(product);

        auditService.logAction("ACTIVACION_PRODUCTO", "Producto reactivado: " + saved.getName() + " (ID: " + id + ")", "INFO");

        return mapToResponseDTO(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> searchProducts(String term) {
        return searchProducts(term, 20);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> searchProducts(String term, int limit) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) return List.of();

        int maxResults = (limit > 0 && limit <= 100) ? limit : 20;
        Pageable pageable = PageRequest.of(0, maxResults);

        if (term == null || term.isBlank()) {
            return productRepository.findByCompanyIdAndActiveTrue(companyId, pageable)
                    .map(this::mapToResponseDTO)
                    .getContent();
        }

        return productRepository.searchByTermAndCompanyId(companyId, term.trim(), pageable)
                .stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    private Long requireCompanyContext() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("Acceso denegado: Operación requiere contexto de empresa.");
        }
        return companyId;
    }

    private void updateProductData(Product p, ProductRequestDTO dto, Category cat) {
        p.setName(dto.name().trim());
        p.setDescription(dto.description());
        p.setBarcode(dto.barcode() != null ? dto.barcode().trim() : null);
        p.setCost(dto.cost());
        p.setPrice(dto.price());
        p.setStock(dto.stock() != null ? dto.stock() : BigDecimal.ZERO);
        p.setMinStock(dto.minStock() != null ? dto.minStock() : BigDecimal.ZERO);
        p.setIsFractional(dto.isFractional() != null && dto.isFractional());
        p.setCategory(cat);
    }

    private ProductResponseDTO mapToResponseDTO(Product p) {
        String catName = (p.getCategory() != null) ? p.getCategory().getName() : "Sin Categoría";
        Long catId = (p.getCategory() != null) ? p.getCategory().getId() : null;

        return new ProductResponseDTO(
                p.getId(),
                p.getName(),
                p.getDescription(),
                catName,
                catId,
                p.getPrice(),
                p.getCost(),
                p.getStock(),
                p.getMinStock(),
                p.getBarcode(),
                p.getIsFractional() != null && p.getIsFractional()
        );
    }
}