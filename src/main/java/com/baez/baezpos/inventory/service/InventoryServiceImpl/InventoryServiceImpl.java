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
import com.baez.baezpos.shared.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
            throw new UnauthorizedException("No hay un contexto de empresa activo para registrar el movimiento.");
        }

        Product product = productRepository.findByIdAndCompanyId(productId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa. ID: " + productId));

        Company company = companyRepository.getReferenceById(companyId);

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

        // NO hace falta productRepository.save(product) -> JPA hace dirty checking al commit.

        InventoryMovement movement = InventoryMovement.builder()
                .movementType(type)
                .quantity(quantity)
                .reason(reason != null ? reason.trim() : "")
                .product(product)
                .build();

        movement.setCompany(company);
        InventoryMovement savedMovement = inventoryRepository.save(movement);

        return mapToDTO(savedMovement);
    }

    private boolean isNegativeMovement(MovementType type) {
        return switch (type) {
            case OUT, SALE, DAMAGE, ADJUSTMENT_OUT -> true;
            case IN, PURCHASE, ADJUSTMENT_IN, RETURN -> false;
        };
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryMovementResponseDTO> getProductMovements(Long productId) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("Acceso denegado: Contexto de empresa no identificado.");
        }

        return inventoryRepository.findByProductIdAndCompanyIdOrderByCreatedAtDesc(productId, companyId)
                .stream()
                .map(this::mapToDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<InventoryMovementResponseDTO> getAllRecentMovements() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("Acceso denegado: Contexto de empresa no identificado.");
        }

        Pageable pageable = PageRequest.of(0, 100);
        return inventoryRepository.findByCompanyIdOrderByCreatedAtDesc(companyId, pageable)
                .stream()
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