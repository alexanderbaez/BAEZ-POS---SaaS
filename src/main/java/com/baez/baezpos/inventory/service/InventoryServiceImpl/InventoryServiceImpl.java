package com.baez.baezpos.inventory.service.InventoryServiceImpl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.inventory.dto.InventoryMovementResponseDTO;
import com.baez.baezpos.inventory.entity.InventoryMovement;
import com.baez.baezpos.inventory.entity.MovementType;
import com.baez.baezpos.inventory.repository.InventoryRepository;
import com.baez.baezpos.inventory.service.InventoryService.InventoryService;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class InventoryServiceImpl implements InventoryService {

    private final InventoryRepository inventoryRepository;
    private final ProductRepository productRepository;
    private final CompanyRepository companyRepository;

    @Override
    @Transactional
    public InventoryMovementResponseDTO registerMovement(Long productId, BigDecimal quantity, MovementType type, String reason) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        if (companyId == null) {
            throw new BadRequestException("No se puede registrar un movimiento de stock sin una empresa asociada.");
        }

        if (productId == null) {
            throw new BadRequestException("El ID del producto es obligatorio.");
        }

        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BadRequestException("La cantidad debe ser mayor a cero.");
        }

        if (type == null) {
            throw new BadRequestException("El tipo de movimiento es obligatorio.");
        }

        // 1. Validar producto dentro de la empresa
        Product product = productRepository.findByIdAndCompanyId(productId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa."));

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada."));

        // 2. Lógica de Stock con BigDecimal
        BigDecimal currentStock = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;

        if (isNegativeMovement(type)) {
            if (currentStock.compareTo(quantity) < 0) {
                throw new BadRequestException(
                        "Stock insuficiente para " + product.getName() +
                        ". Stock actual: " + currentStock.toPlainString());
            }
            product.setStock(currentStock.subtract(quantity));
        } else {
            product.setStock(currentStock.add(quantity));
        }

        productRepository.save(product);

        // 3. Crear y guardar movimiento
        InventoryMovement movement = InventoryMovement.builder()
                .movementType(type)
                .quantity(quantity)
                .reason(reason != null ? reason.trim() : "")
                .product(product)
                .build();

        movement.setCompany(company);

        InventoryMovement savedMovement = inventoryRepository.save(movement);
        log.info("Empresa [{}]: Movimiento {} ({}) registrado para producto ID {}",
                companyId, type, quantity.toPlainString(), product.getId());

        return mapToDTO(savedMovement);
    }

    private boolean isNegativeMovement(MovementType type) {
        return switch (type) {
            case SALE, DAMAGE, ADJUSTMENT_OUT -> true;
            case PURCHASE, ADJUSTMENT_IN, RETURN -> false;
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryMovementResponseDTO> getProductMovements(Long productId) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        List<InventoryMovement> movements;
        if (companyId != null) {
            movements = inventoryRepository.findByProductIdAndCompanyIdOrderByCreatedAtDesc(productId, companyId);
        } else {
            movements = inventoryRepository.findByProductIdOrderByCreatedAtDesc(productId);
        }

        return movements.stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryMovementResponseDTO> getAllRecentMovements() {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        List<InventoryMovement> movements;
        if (companyId != null) {
            movements = inventoryRepository.findByCompanyIdOrderByCreatedAtDesc(companyId);
        } else {
            movements = inventoryRepository.findAll();
        }

        return movements.stream()
                .map(this::mapToDTO)
                .toList();
    }

    private InventoryMovementResponseDTO mapToDTO(InventoryMovement movement) {
        return InventoryMovementResponseDTO.builder()
                .id(movement.getId())
                .productId(movement.getProduct().getId())
                .productName(movement.getProduct().getName())
                .movementType(movement.getMovementType())
                .quantity(movement.getQuantity())
                .reason(movement.getReason())
                .createdAt(movement.getCreatedAt())
                .build();
    }
}