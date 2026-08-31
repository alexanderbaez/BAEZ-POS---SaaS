package com.baez.baezpos.provider.service;

import com.baez.baezpos.provider.dto.PurchaseOrderRequestDTO;
import com.baez.baezpos.provider.dto.PurchaseOrderResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface PurchaseOrderService {
    PurchaseOrderResponseDTO createOrder(PurchaseOrderRequestDTO dto);
    PurchaseOrderResponseDTO receiveOrder(Long id);
    PurchaseOrderResponseDTO cancelOrder(Long id);
    void deleteOrder(Long id);
    void sendPurchaseOrderEmail(Long id);
    PurchaseOrderResponseDTO getOrderById(Long id);
    Page<PurchaseOrderResponseDTO> getOrdersByProvider(Long providerId, Pageable pageable);
    Page<PurchaseOrderResponseDTO> getAllOrders(Pageable pageable);
}
