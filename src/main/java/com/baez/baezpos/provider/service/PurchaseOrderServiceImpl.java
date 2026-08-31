package com.baez.baezpos.provider.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.mail.service.EmailService;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.provider.dto.PurchaseOrderItemRequestDTO;
import com.baez.baezpos.provider.dto.PurchaseOrderItemResponseDTO;
import com.baez.baezpos.provider.dto.PurchaseOrderRequestDTO;
import com.baez.baezpos.provider.dto.PurchaseOrderResponseDTO;
import com.baez.baezpos.provider.entity.*;
import com.baez.baezpos.provider.repository.ProviderProductRepository;
import com.baez.baezpos.provider.repository.ProviderRepository;
import com.baez.baezpos.provider.repository.PurchaseOrderItemRepository;
import com.baez.baezpos.provider.repository.PurchaseOrderRepository;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import com.baez.baezpos.shared.exception.UnauthorizedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class PurchaseOrderServiceImpl implements PurchaseOrderService {

    private final PurchaseOrderRepository purchaseOrderRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;
    private final ProviderRepository providerRepository;
    private final ProductRepository productRepository;
    private final ProviderProductRepository providerProductRepository;
    private final CompanyRepository companyRepository;
    private final AuditService auditService;
    private final EmailService emailService;

    @Override
    @Transactional
    public PurchaseOrderResponseDTO createOrder(PurchaseOrderRequestDTO dto) {
        Long companyId = getCompanyId();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        Provider provider = providerRepository.findByIdAndCompanyId(dto.providerId(), companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado"));

        PurchaseOrder order = PurchaseOrder.builder()
                .company(company)
                .provider(provider)
                .status(OrderStatus.PENDING)
                .orderDate(LocalDateTime.now())
                .totalAmount(BigDecimal.ZERO)
                .items(new ArrayList<>())
                .build();

        BigDecimal total = BigDecimal.ZERO;

        for (PurchaseOrderItemRequestDTO itemDto : dto.items()) {
            Product product = productRepository.findByIdAndCompanyId(itemDto.productId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado: " + itemDto.productId()));

            BigDecimal subtotal = itemDto.quantity().multiply(itemDto.unitCost());
            total = total.add(subtotal);

            PurchaseOrderItem orderItem = PurchaseOrderItem.builder()
                    .company(company)
                    .purchaseOrder(order)
                    .product(product)
                    .quantity(itemDto.quantity())
                    .unitCost(itemDto.unitCost())
                    .subtotal(subtotal)
                    .build();

            order.getItems().add(orderItem);
        }

        order.setTotalAmount(total);
        PurchaseOrder savedOrder = purchaseOrderRepository.save(order);

        auditService.logAction("ORDEN_COMPRA_CREADA", "Orden ID " + savedOrder.getId() + " creada por $" + total, "INFO");
        return mapToDTO(savedOrder);
    }

    @Override
    @Transactional
    public PurchaseOrderResponseDTO receiveOrder(Long id) {
        Long companyId = getCompanyId();
        PurchaseOrder order = purchaseOrderRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Orden no encontrada"));

        if (order.getStatus() != OrderStatus.PENDING) {
            throw new IllegalStateException("Solo se pueden recibir órdenes en estado PENDING");
        }

        // Actualizar stock y costos
        for (PurchaseOrderItem item : order.getItems()) {
            Product product = item.getProduct();
            
            // Actualizar stock de inventario
            BigDecimal currentStock = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
            product.setStock(currentStock.add(item.getQuantity()));
            
            // Proteger margen de ganancia ante variaciones al alza del costo
            BigDecimal oldCost = product.getCost() != null ? product.getCost() : BigDecimal.ZERO;
            BigDecimal newCost = item.getUnitCost();
            BigDecimal oldPrice = product.getPrice() != null ? product.getPrice() : BigDecimal.ZERO;
            
            if (oldCost.compareTo(BigDecimal.ZERO) > 0 && newCost.compareTo(oldCost) > 0) {
                java.math.BigDecimal factor = newCost.divide(oldCost, 4, java.math.RoundingMode.HALF_UP);
                java.math.BigDecimal newPrice = oldPrice.multiply(factor).setScale(2, java.math.RoundingMode.HALF_UP);
                product.setPrice(newPrice);
            }
            
            product.setCost(newCost);
            productRepository.save(product);
            
            // Registrar/Actualizar relación en ProviderProduct
            ProviderProduct providerProduct = providerProductRepository
                    .findByCompanyIdAndProviderIdAndProductId(companyId, order.getProvider().getId(), product.getId())
                    .orElseGet(() -> ProviderProduct.builder()
                            .company(order.getCompany())
                            .provider(order.getProvider())
                            .product(product)
                            .build());
                            
            providerProduct.setLastCost(item.getUnitCost());
            providerProductRepository.save(providerProduct);
        }

        // Cargar a cuenta corriente del proveedor
        Provider provider = order.getProvider();
        BigDecimal currentBal = provider.getCurrentBalance() != null ? provider.getCurrentBalance() : BigDecimal.ZERO;
        provider.setCurrentBalance(currentBal.add(order.getTotalAmount()));
        providerRepository.save(provider);

        // Actualizar estado de la orden
        order.setStatus(OrderStatus.RECEIVED);
        order.setReceptionDate(LocalDateTime.now());
        purchaseOrderRepository.save(order);

        auditService.logAction("ORDEN_COMPRA_RECIBIDA", "Orden ID " + order.getId() + " recibida. Stock ingresado y deuda actualizada en proveedor.", "INFO");
        return mapToDTO(order);
    }

    @Override
    @Transactional
    public PurchaseOrderResponseDTO cancelOrder(Long id) {
        Long companyId = getCompanyId();
        PurchaseOrder order = purchaseOrderRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Orden no encontrada"));

        if (order.getStatus() != OrderStatus.PENDING) {
            throw new IllegalStateException("Solo se pueden cancelar órdenes en estado PENDING");
        }

        order.setStatus(OrderStatus.CANCELED);
        purchaseOrderRepository.save(order);

        auditService.logAction("ORDEN_COMPRA_CANCELADA", "Orden ID " + order.getId() + " cancelada.", "INFO");
        return mapToDTO(order);
    }

    @Override
    @Transactional
    public void deleteOrder(Long id) {
        Long companyId = getCompanyId();
        PurchaseOrder order = purchaseOrderRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Orden no encontrada"));

        if (order.getStatus() == OrderStatus.RECEIVED) {
            throw new IllegalStateException("No se pueden eliminar órdenes en estado RECEIVED");
        }

        purchaseOrderItemRepository.deleteAll(order.getItems());
        purchaseOrderRepository.delete(order);

        auditService.logAction("ORDEN_COMPRA_ELIMINADA", "Orden ID " + id + " eliminada permanentemente.", "INFO");
    }

    @Override
    @Transactional(readOnly = true)
    public void sendPurchaseOrderEmail(Long id) {
        Long companyId = getCompanyId();
        PurchaseOrder order = purchaseOrderRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Orden no encontrada"));
        
        Provider provider = order.getProvider();
        if (provider.getEmail() == null || provider.getEmail().isBlank()) {
            throw new IllegalStateException("El proveedor no tiene un email registrado");
        }
        
        StringBuilder detalle = new StringBuilder();
        detalle.append("Orden de Compra #").append(order.getId()).append("\n\n");
        for (PurchaseOrderItem item : order.getItems()) {
            detalle.append("- ").append(item.getProduct().getName())
                   .append(" | Cantidad: ").append(item.getQuantity())
                   .append(" | Costo Un.: $").append(item.getUnitCost())
                   .append(" | Subtotal: $").append(item.getSubtotal())
                   .append("\n");
        }
        detalle.append("\nTotal: $").append(order.getTotalAmount());
        
        emailService.enviarMailPurchaseOrder(provider.getEmail(), provider.getBusinessName(), detalle.toString());
    }

    @Override
    @Transactional(readOnly = true)
    public PurchaseOrderResponseDTO getOrderById(Long id) {
        Long companyId = getCompanyId();
        PurchaseOrder order = purchaseOrderRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Orden no encontrada"));
        return mapToDTO(order);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PurchaseOrderResponseDTO> getOrdersByProvider(Long providerId, Pageable pageable) {
        Long companyId = getCompanyId();
        return purchaseOrderRepository.findByCompanyIdAndProviderIdOrderByOrderDateDesc(companyId, providerId, pageable)
                .map(this::mapToDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<PurchaseOrderResponseDTO> getAllOrders(Pageable pageable) {
        Long companyId = getCompanyId();
        return purchaseOrderRepository.findByCompanyIdOrderByOrderDateDesc(companyId, pageable)
                .map(this::mapToDTO);
    }

    private Long getCompanyId() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new UnauthorizedException("Contexto de empresa no identificado.");
        }
        return companyId;
    }

    private PurchaseOrderResponseDTO mapToDTO(PurchaseOrder order) {
        List<PurchaseOrderItemResponseDTO> items = order.getItems().stream()
                .map(i -> new PurchaseOrderItemResponseDTO(
                        i.getId(),
                        i.getProduct().getId(),
                        i.getProduct().getName(),
                        i.getProduct().getBarcode(),
                        i.getQuantity(),
                        i.getUnitCost(),
                        i.getSubtotal()
                )).toList();

        return new PurchaseOrderResponseDTO(
                order.getId(),
                order.getProvider().getId(),
                order.getProvider().getBusinessName(),
                order.getStatus(),
                order.getOrderDate(),
                order.getReceptionDate(),
                order.getTotalAmount(),
                items
        );
    }
}
