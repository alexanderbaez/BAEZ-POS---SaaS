package com.baez.baezpos.product.service.Impl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.product.dto.ProductRequestDTO;
import com.baez.baezpos.product.dto.ProductResponseDTO;
import com.baez.baezpos.product.entity.Category;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.CategoryRepository;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.product.service.service.ProductService;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ProductServiceImpl implements ProductService {

    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final CompanyRepository companyRepository;

    @Override
    @Transactional
    public ProductResponseDTO createProduct(ProductRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        // 1. Buscamos por código de barras SOLO DENTRO DE ESTA EMPRESA
        Optional<Product> existingProduct = Optional.empty();
        if (dto.barcode() != null && !dto.barcode().trim().isEmpty()) {
            existingProduct = productRepository.findByBarcodeAndCompanyId(dto.barcode(), companyId);
        }

        if (existingProduct.isPresent()) {
            Product productEncontrado = existingProduct.get();

            if (productEncontrado.getActive()) {
                throw new RuntimeException("El producto ya está activo en el sistema.");
            }

            // 2. REANIMACIÓN: Actualizamos producto borrado de la empresa
            var category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                    .orElseThrow(() -> new RuntimeException("Categoría no válida"));

            updateProductData(productEncontrado, dto, category);
            productEncontrado.setActive(true);

            return mapToResponseDTO(productRepository.save(productEncontrado));
        }

        // 3. Crear nuevo Producto asignando Company
        var category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                .orElseThrow(() -> new RuntimeException("Categoría no válida"));

        Company company = companyRepository.getReferenceById(companyId);

        Product nuevoProduct = Product.builder()
                .name(dto.name())
                .description(dto.description())
                .barcode(dto.barcode())
                .cost(dto.cost())
                .price(dto.price())
                .stock(dto.stock())
                .minStock(dto.minStock())
                .category(category)
                .company(company) // <-- ASIGNAMOS LA EMPRESA
                .active(true)
                .build();

        return mapToResponseDTO(productRepository.save(nuevoProduct));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getAllProducts() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return productRepository.findByActiveTrueWithCategoryAndCompanyId(companyId).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    public ProductResponseDTO getProductById(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return productRepository.findByIdAndCompanyId(id, companyId)
                .map(this::mapToResponseDTO)
                .orElseThrow(() -> new RuntimeException("Producto no encontrado"));
    }

    @Override
    @Transactional
    public ProductResponseDTO updateProduct(Long id, ProductRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Producto no encontrado"));

        var category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                .orElseThrow(() -> new RuntimeException("Categoría no válida"));

        updateProductData(product, dto, category);
        return mapToResponseDTO(productRepository.save(product));
    }

    private void updateProductData(Product p, ProductRequestDTO dto, Category cat) {
        p.setName(dto.name());
        p.setDescription(dto.description());
        p.setBarcode(dto.barcode());
        p.setCost(dto.cost());
        p.setPrice(dto.price());
        p.setStock(dto.stock());
        p.setMinStock(dto.minStock());
        p.setCategory(cat);
    }

    @Override
    @Transactional
    public void deleteProduct(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Producto no encontrado"));
        product.setActive(false);
        productRepository.save(product);
    }

    @Override
    public Optional<ProductResponseDTO> getByBarcode(String barcode) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return productRepository.findByBarcodeAndCompanyId(barcode, companyId).map(this::mapToResponseDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getDeletedProducts() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        return productRepository.findByActiveFalseWithCategoryAndCompanyId(companyId).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional
    public ProductResponseDTO activateProduct(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new RuntimeException("Producto no encontrado"));
        product.setActive(true);
        return mapToResponseDTO(productRepository.save(product));
    }

    private ProductResponseDTO mapToResponseDTO(Product p) {
        String catName = (p.getCategory() != null) ? p.getCategory().getName() : "Sin Categoría";
        Long catId = (p.getCategory() != null) ? p.getCategory().getId() : null;

        return new ProductResponseDTO(
                p.getId(),
                p.getName(),
                catName,
                catId,
                p.getPrice(),
                p.getCost(),
                p.getStock(),
                p.getMinStock(),
                p.getBarcode()
        );
    }
}