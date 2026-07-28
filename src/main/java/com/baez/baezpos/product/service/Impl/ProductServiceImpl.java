package com.baez.baezpos.product.service.impl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.product.dto.ProductRequestDTO;
import com.baez.baezpos.product.dto.ProductResponseDTO;
import com.baez.baezpos.product.entity.Category;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.CategoryRepository;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.product.service.ProductService;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
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

    @Override
    @Transactional
    public ProductResponseDTO createProduct(ProductRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("No se puede registrar un producto sin estar asociado a una empresa.");
        }

        validateProductDTO(dto);

        // 1. Buscamos si existe por código de barras dentro de esta empresa
        Optional<Product> existingProduct = Optional.empty();
        if (dto.barcode() != null && !dto.barcode().trim().isEmpty()) {
            existingProduct = productRepository.findByBarcodeAndCompanyId(dto.barcode().trim(), companyId);
        }

        if (existingProduct.isPresent()) {
            Product productEncontrado = existingProduct.get();

            if (productEncontrado.getActive()) {
                throw new BadRequestException("El producto con código '" + dto.barcode() + "' ya está activo.");
            }

            // 2. REANIMACIÓN
            Category category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

            updateProductData(productEncontrado, dto, category);
            productEncontrado.setActive(true);

            return mapToResponseDTO(productRepository.save(productEncontrado));
        }

        // 3. Crear nuevo Producto
        Category category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        Product nuevoProduct = Product.builder()
                .name(dto.name().trim())
                .description(dto.description())
                .barcode(dto.barcode() != null ? dto.barcode().trim() : null)
                .cost(dto.cost())
                .price(dto.price())
                .stock(dto.stock() != null ? dto.stock() : 0)
                .minStock(dto.minStock() != null ? dto.minStock() : 0)
                .category(category)
                .company(company)
                .active(true)
                .build();

        return mapToResponseDTO(productRepository.save(nuevoProduct));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getAllProducts() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<Product> products;

        if (companyId != null) {
            products = productRepository.findByActiveTrueWithCategoryAndCompanyId(companyId);
        } else {
            products = productRepository.findAllActiveWithCategory();
        }

        return products.stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ProductResponseDTO getProductById(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Product product;

        if (companyId != null) {
            product = productRepository.findByIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        } else {
            product = productRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        }

        return mapToResponseDTO(product);
    }

    @Override
    @Transactional
    public ProductResponseDTO updateProduct(Long id, ProductRequestDTO dto) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("No se puede editar productos sin contexto de empresa.");
        }

        validateProductDTO(dto);

        Product product = productRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa"));

        Category category = categoryRepository.findByIdAndCompanyId(dto.categoryId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada en su empresa"));

        updateProductData(product, dto, category);
        return mapToResponseDTO(productRepository.save(product));
    }

    private void updateProductData(Product p, ProductRequestDTO dto, Category cat) {
        p.setName(dto.name().trim());
        p.setDescription(dto.description());
        p.setBarcode(dto.barcode() != null ? dto.barcode().trim() : null);
        p.setCost(dto.cost());
        p.setPrice(dto.price());
        p.setStock(dto.stock() != null ? dto.stock() : 0);
        p.setMinStock(dto.minStock() != null ? dto.minStock() : 0);
        p.setCategory(cat);
    }

    @Override
    @Transactional
    public void deleteProduct(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Product product;

        if (companyId != null) {
            product = productRepository.findByIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        } else {
            product = productRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        }

        product.setActive(false);
        productRepository.save(product);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<ProductResponseDTO> getByBarcode(String barcode) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (barcode == null || barcode.isBlank()) return Optional.empty();

        if (companyId != null) {
            return productRepository.findByBarcodeAndCompanyId(barcode.trim(), companyId)
                    .map(this::mapToResponseDTO);
        }

        return Optional.empty();
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getDeletedProducts() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<Product> products;

        if (companyId != null) {
            products = productRepository.findByActiveFalseWithCategoryAndCompanyId(companyId);
        } else {
            products = productRepository.findAllInactiveWithCategory();
        }

        return products.stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional
    public ProductResponseDTO activateProduct(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Product product;

        if (companyId != null) {
            product = productRepository.findByIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        } else {
            product = productRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        }

        product.setActive(true);
        return mapToResponseDTO(productRepository.save(product));
    }

    private void validateProductDTO(ProductRequestDTO dto) {
        if (dto.name() == null || dto.name().isBlank()) {
            throw new BadRequestException("El nombre del producto es obligatorio.");
        }
        if (dto.categoryId() == null) {
            throw new BadRequestException("Debe seleccionar una categoría.");
        }
        if (dto.cost() == null || dto.cost().compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("El costo no puede ser nulo o negativo.");
        }
        if (dto.price() == null || dto.price().compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("El precio de venta no puede ser nulo o negativo.");
        }
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