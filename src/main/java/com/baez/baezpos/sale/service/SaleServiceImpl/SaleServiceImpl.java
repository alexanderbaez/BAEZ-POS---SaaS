package com.baez.baezpos.sale.service.SaleServiceImpl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.customer.entities.Customer;
import com.baez.baezpos.customer.repository.CustomerMovementRepository;
import com.baez.baezpos.customer.repository.CustomerRepository;
import com.baez.baezpos.customer.service.CustomerService;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.inventory.entity.MovementType;
import com.baez.baezpos.inventory.service.InventoryService.InventoryService;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.sale.dto.*;
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.sale.entity.SaleItem;
import com.baez.baezpos.sale.repository.SaleRepository;
import com.baez.baezpos.sale.service.SaleService.SaleService;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.exception.BadRequestException;
import com.baez.baezpos.shared.exception.ResourceNotFoundException;
import com.baez.baezpos.user.entity.User;
import com.baez.baezpos.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SaleServiceImpl implements SaleService {

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final InventoryService inventoryService;
    private final UserRepository userRepository;
    private final CustomerService customerService;
    private final CustomerRepository customerRepository;
    private final CustomerMovementRepository customerMovementRepository;
    private final CompanyRepository companyRepository;
    private final ExpenseRepository expenseRepository;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SaleResponseDTO createSale(SaleRequestDTO saleDTO, Long userId) {
        Long companyId = requireCompanyContext();

        if (saleDTO.items() == null || saleDTO.items().isEmpty()) {
            throw new BadRequestException("La venta debe contener al menos un producto.");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa no encontrada"));

        BigDecimal recargo = saleDTO.surcharge() != null ? saleDTO.surcharge() : BigDecimal.ZERO;
        BigDecimal porcentajeRecargo = saleDTO.surchargeRate() != null ? saleDTO.surchargeRate() : BigDecimal.ZERO;
        BigDecimal descuento = saleDTO.discount() != null ? saleDTO.discount() : BigDecimal.ZERO;

        if (descuento.compareTo(BigDecimal.ZERO) < 0 || recargo.compareTo(BigDecimal.ZERO) < 0) {
            throw new BadRequestException("Los valores de recargo y descuento deben ser positivos.");
        }

        // ==========================================
        // GENERACIÓN DE NÚMERO DE TICKET MULTI-TENANT
        // ==========================================
        Long siguienteNumeroTicket = (company.getLastTicketNumber() != null ? company.getLastTicketNumber() : 0L) + 1L;
        company.setLastTicketNumber(siguienteNumeroTicket);
        companyRepository.save(company);

        String nroComprobanteFormateado = String.format("00001-%08d", siguienteNumeroTicket);

        Sale sale = Sale.builder()
                .user(user)
                .saleDate(LocalDateTime.now())
                .items(new ArrayList<>())
                .discount(descuento)
                .surcharge(recargo)
                .surchargeRate(porcentajeRecargo)
                .paymentMethod(saleDTO.paymentMethod())
                .canceled(false)
                .nroComprobante(nroComprobanteFormateado)
                .build();

        sale.setCompany(company);

        if (Boolean.TRUE.equals(saleDTO.isFiscal())) {
            sale.setTipoComprobante("FACTURA C");
            sale.setCae("76543210987654");
            sale.setCaeVto(LocalDate.now().plusDays(10).toString());
        } else {
            sale.setTipoComprobante("TICKET INTERNO");
        }

        BigDecimal subtotalAcumulado = BigDecimal.ZERO;

        for (SaleItemRequestDTO itemDTO : saleDTO.items()) {
            if (itemDTO.quantity() == null || itemDTO.quantity().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BadRequestException("La cantidad enviada para el producto debe ser mayor a 0.");
            }

            Product product = productRepository.findByIdAndCompanyId(itemDTO.productId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa: ID " + itemDTO.productId()));

            BigDecimal stockActual = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
            if (stockActual.compareTo(itemDTO.quantity()) < 0) {
                throw new BadRequestException("Stock insuficiente para: " + product.getName() +
                        " (Stock actual: " + stockActual.toPlainString() + ")");
            }

            BigDecimal precioVenta = (itemDTO.price() != null) ? itemDTO.price() : product.getPrice();
            BigDecimal subtotalItem = precioVenta.multiply(itemDTO.quantity());

            SaleItem item = SaleItem.builder()
                    .sale(sale)
                    .product(product)
                    .quantity(itemDTO.quantity())
                    .price(precioVenta)
                    .cost(product.getCost())
                    .subtotal(subtotalItem)
                    .build();

            sale.getItems().add(item);
            subtotalAcumulado = subtotalAcumulado.add(subtotalItem);
        }

        BigDecimal totalFinal = subtotalAcumulado.add(recargo).subtract(descuento);
        sale.setTotal(totalFinal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : totalFinal);

        Sale savedSale = saleRepository.save(sale);

        for (SaleItem item : savedSale.getItems()) {
            inventoryService.registerMovement(
                    item.getProduct().getId(),
                    item.getQuantity(),
                    MovementType.SALE,
                    "Venta #" + savedSale.getNroComprobante()
            );
        }

        if ("CUENTA_CORRIENTE".equalsIgnoreCase(saleDTO.paymentMethod())) {
            handleCreditSale(saleDTO.customerId(), savedSale, companyId);
        }

        log.info("Venta procesada Ticket: {} - Total: ${} - Empresa: {}", savedSale.getNroComprobante(), savedSale.getTotal(), company.getName());
        return mapToResponseDTO(savedSale);
    }

    private void handleCreditSale(Long customerId, Sale savedSale, Long companyId) {
        if (customerId == null) {
            throw new BadRequestException("Debe seleccionar un cliente para realizar una venta a cuenta corriente.");
        }

        Customer customer = customerRepository.findByIdAndCompanyId(customerId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado en su empresa"));

        BigDecimal nuevoSaldo = customer.getCurrentBalance().add(savedSale.getTotal());

        if (customer.getCreditLimit() != null && nuevoSaldo.compareTo(customer.getCreditLimit()) > 0) {
            throw new BadRequestException("La venta supera el límite de crédito configurado para el cliente.");
        }

        customerService.updateBalance(
                customer.getId(),
                savedSale.getTotal(),
                "DEBITO",
                "Venta en libreta Ticket #" + savedSale.getNroComprobante(),
                savedSale,
                savedSale.getPaymentMethod()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponseDTO getSaleById(Long id) {
        Long companyId = requireCompanyContext();
        Sale sale = saleRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada en su empresa"));
        return mapToResponseDTO(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getAllSales() {
        Long companyId = requireCompanyContext();
        return saleRepository.findByCompanyIdOrderBySaleDateDesc(companyId).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BoxReportDTO getBoxReport(String period, LocalDate from, LocalDate to) {
        Long companyId = requireCompanyContext();

        LocalDateTime startToday = LocalDate.now().atStartOfDay();
        LocalDateTime endToday = LocalDate.now().atTime(LocalTime.MAX);

        // Rango para métricas de rendimiento comercial
        LocalDateTime startRange = (from != null) ? from.atStartOfDay() : LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime endRange = (to != null) ? to.atTime(LocalTime.MAX) : LocalDate.now().with(TemporalAdjusters.lastDayOfMonth()).atTime(LocalTime.MAX);

        List<Sale> rangeSales = saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, startRange, endRange);

        // Métricas de Rango / Rendimiento
        BigDecimal periodSales = BigDecimal.ZERO;
        BigDecimal periodReplacementCost = BigDecimal.ZERO;
        long periodOperations = 0;

        // Métricas Exclusivas de HOY (Flujo Diario)
        BigDecimal totalSalesToday = BigDecimal.ZERO;
        BigDecimal cashSalesToday = BigDecimal.ZERO;
        BigDecimal transferSalesToday = BigDecimal.ZERO;
        BigDecimal creditSalesToday = BigDecimal.ZERO;

        for (Sale s : rangeSales) {
            if (Boolean.TRUE.equals(s.getCanceled())) continue;

            periodSales = periodSales.add(s.getTotal());
            periodOperations++;

            for (SaleItem item : s.getItems()) {
                BigDecimal costUnit = item.getCost() != null ? item.getCost() : BigDecimal.ZERO;
                periodReplacementCost = periodReplacementCost.add(costUnit.multiply(item.getQuantity()));
            }

            // Filtrado estricto de ventas del día actual
            if (!s.getSaleDate().isBefore(startToday) && !s.getSaleDate().isAfter(endToday)) {
                totalSalesToday = totalSalesToday.add(s.getTotal());

                if ("EFECTIVO".equalsIgnoreCase(s.getPaymentMethod())) {
                    cashSalesToday = cashSalesToday.add(s.getTotal());
                } else if ("TRANSFERENCIA".equalsIgnoreCase(s.getPaymentMethod())) {
                    transferSalesToday = transferSalesToday.add(s.getTotal());
                } else if ("CUENTA_CORRIENTE".equalsIgnoreCase(s.getPaymentMethod())) {
                    creditSalesToday = creditSalesToday.add(s.getTotal());
                }
            }
        }

        // Cobros de deudas de Cuenta Corriente cobrados HOY
        BigDecimal cobrosEfe = customerMovementRepository.sumPaymentsByMethodAndCompanyId("EFECTIVO", companyId, startToday, endToday);
        BigDecimal cobrosTra = customerMovementRepository.sumPaymentsByMethodAndCompanyId("TRANSFERENCIA", companyId, startToday, endToday);

        cobrosEfe = (cobrosEfe != null) ? cobrosEfe : BigDecimal.ZERO;
        cobrosTra = (cobrosTra != null) ? cobrosTra : BigDecimal.ZERO;
        BigDecimal customerPaymentsToday = cobrosEfe.add(cobrosTra);

        // Gastos autorizados del día a descontar de la caja
        BigDecimal expensesToday = expenseRepository.sumDeductibleExpensesByCompanyIdAndDate(companyId, startToday, endToday);
        if (expensesToday == null) expensesToday = BigDecimal.ZERO;

        // Balance Real Disponible = (Efectivo + Transferencia + Cobros Deudas) - Gastos de Caja
        BigDecimal realBalance = cashSalesToday
                .add(transferSalesToday)
                .add(customerPaymentsToday)
                .subtract(expensesToday);

        // Deuda total acumulada en la calle por clientes
        BigDecimal totalPendingCredit = customerRepository.sumAllBalancesByCompanyId(companyId);
        if (totalPendingCredit == null) totalPendingCredit = BigDecimal.ZERO;

        BigDecimal periodProfit = periodSales.subtract(periodReplacementCost);

        return new BoxReportDTO(
                totalSalesToday,
                cashSalesToday,
                transferSalesToday,
                creditSalesToday,
                customerPaymentsToday,
                expensesToday,
                realBalance,
                totalPendingCredit,
                periodSales,
                periodOperations,
                periodProfit,
                periodReplacementCost
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChartDataDTO> getSalesChartData() {
        Long companyId = requireCompanyContext();
        LocalDate today = LocalDate.now();
        Map<LocalDate, BigDecimal> last7Days = new LinkedHashMap<>();

        for (int i = 6; i >= 0; i--) {
            last7Days.put(today.minusDays(i), BigDecimal.ZERO);
        }

        LocalDateTime start = today.minusDays(6).atStartOfDay();
        LocalDateTime end = today.atTime(23, 59, 59);

        List<Sale> recentSales = saleRepository.findByCompanyIdAndSaleDateBetweenAndCanceledFalse(companyId, start, end);

        for (Sale sale : recentSales) {
            LocalDate localDate = sale.getSaleDate().toLocalDate();
            BigDecimal currentTotal = last7Days.getOrDefault(localDate, BigDecimal.ZERO);
            last7Days.put(localDate, currentTotal.add(sale.getTotal()));
        }

        return last7Days.entrySet().stream()
                .map(e -> new ChartDataDTO(e.getKey().toString(), e.getValue()))
                .toList();
    }

    @Override
    @Transactional
    public void cancelSale(Long saleId) {
        Long companyId = requireCompanyContext();
        Sale sale = saleRepository.findByIdAndCompanyId(saleId, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada en su empresa"));

        if (Boolean.TRUE.equals(sale.getCanceled())) {
            throw new BadRequestException("La venta ya se encuentra anulada.");
        }

        sale.setCanceled(true);

        for (SaleItem item : sale.getItems()) {
            Product product = item.getProduct();
            BigDecimal currentStock = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
            product.setStock(currentStock.add(item.getQuantity()));
            productRepository.save(product);
        }

        saleRepository.save(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getSalesByDateRange(LocalDate desde, LocalDate hasta) {
        Long companyId = requireCompanyContext();
        LocalDateTime start = desde.atStartOfDay();
        LocalDateTime end = hasta.atTime(LocalTime.MAX);

        return saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, start, end).stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    private Long requireCompanyContext() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("Acceso denegado: Operación requiere un contexto de empresa válido.");
        }
        return companyId;
    }

    private SaleResponseDTO mapToResponseDTO(Sale sale) {
        List<SaleItemResponseDTO> itemDTOs = sale.getItems().stream()
                .map(item -> new SaleItemResponseDTO(
                        item.getProduct().getName(),
                        item.getQuantity(),
                        item.getPrice(),
                        item.getSubtotal()
                )).toList();

        Company comp = sale.getCompany();
        String cName = (comp != null) ? comp.getName() : "BÁEZ POS";
        String cTaxId = (comp != null && comp.getTaxId() != null) ? comp.getTaxId() : "";
        String cAddress = (comp != null && comp.getAddress() != null) ? comp.getAddress() : "";
        String uName = (sale.getUser() != null) ? sale.getUser().getName() : "Usuario Desconocido";

        return new SaleResponseDTO(
                sale.getId(),
                sale.getSaleDate(),
                sale.getTotal(),
                sale.getDiscount(),
                sale.getSurcharge(),
                sale.getSurchargeRate(),
                sale.getPaymentMethod(),
                uName,
                cName,
                cTaxId,
                cAddress,
                itemDTOs,
                sale.getCae(),
                sale.getCaeVto(),
                sale.getTipoComprobante(),
                sale.getNroComprobante()
        );
    }
}