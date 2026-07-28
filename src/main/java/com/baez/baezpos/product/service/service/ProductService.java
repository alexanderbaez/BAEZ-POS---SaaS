package com.baez.baezpos.product.service;

import com.baez.baezpos.product.dto.ProductRequestDTO;
import com.baez.baezpos.product.dto.ProductResponseDTO;

import java.util.List;
import java.util.Optional;

public interface ProductService {
    ProductResponseDTO createProduct(ProductRequestDTO dto);
    ProductResponseDTO getProductById(Long id);
    List<ProductResponseDTO> getAllProducts();
    ProductResponseDTO updateProduct(Long id, ProductRequestDTO dto);
    void deleteProduct(Long id);
    Optional<ProductResponseDTO> getByBarcode(String barcode);
    ProductResponseDTO activateProduct(Long id);
    List<ProductResponseDTO> getDeletedProducts();
}