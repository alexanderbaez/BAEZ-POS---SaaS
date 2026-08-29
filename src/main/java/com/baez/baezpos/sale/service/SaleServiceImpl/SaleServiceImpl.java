package com.baez.baezpos.sale.service.SaleServiceImpl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.customer.entities.Customer;
import com.baez.baezpos.customer.entities.CustomerMovement;
import com.baez.baezpos.customer.repository.CustomerMovementRepository;
import com.baez.baezpos.customer.repository.CustomerRepository;
import com.baez.baezpos.customer.service.CustomerService;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.inventory.entity.InventoryMovement;
import com.baez.baezpos.inventory.entity.MovementType;
import com.baez.baezpos.inventory.repository.InventoryRepository;
import com.baez.baezpos.inventory.service.InventoryService.InventoryService;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.sale.dto.*;
import com.baez.baezpos.sale.entity.CashRegisterSession;
import com.baez.baezpos.sale.entity.CashSessionStatus;
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.sale.entity.SaleItem;
import com.baez.baezpos.sale.repository.CashRegisterSessionRepository;
import com.baez.baezpos.sale.repository.SaleRepository;
import com.baez.baezpos.sale.service.SaleService.SaleService;
import com.baez.baezpos.security.util.SecurityUtils;
import com.baez.baezpos.shared.entity.PaymentMethod;
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
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SaleServiceImpl implements SaleService {

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final InventoryService inventoryService;
    private final InventoryRepository inventoryRepository;
    private final UserRepository userRepository;
    private final CustomerService customerService;
    private final CustomerRepository customerRepository;
    private final CustomerMovementRepository customerMovementRepository;
    private final CompanyRepository companyRepository;
    private final ExpenseRepository expenseRepository;
    private final AuditService auditService;
    private final CashRegisterSessionRepository cashRegisterSessionRepository;
    private final com.baez.baezpos.afip.service.AfipBillingService afipBillingService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SaleResponseDTO createSale(SaleRequestDTO saleDTO, Long userId) {
        Long companyId = requireCompanyContext();

        if (saleDTO.items() == null || saleDTO.items().isEmpty()) {
            throw new BadRequestException("La venta debe contener al menos un producto.");
        }

        CashRegisterSession activeSession = cashRegisterSessionRepository
                .findFirstByCompanyIdAndStatusOrderByIdDesc(companyId, CashSessionStatus.OPEN)
                .orElseThrow(() -> new BadRequestException("No hay una caja abierta. Debe abrir la caja antes de registrar ventas."));

        Long authenticatedUserId = SecurityUtils.getCurrentUserId();
        User user = null;
        if (authenticatedUserId != null) {
            user = userRepository.findById(authenticatedUserId).orElse(null);
        }
        if (user == null) {
            String currentEmail = SecurityUtils.getCurrentUserEmail();
            if (currentEmail != null) {
                user = userRepository.findByEmail(currentEmail).orElse(null);
            }
        }
        if (user == null && userId != null) {
            user = userRepository.findById(userId).orElse(null);
        }
        if (user == null) {
            throw new BadRequestException("No se pudo identificar al usuario emisor de la venta.");
        }

        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa asociada no encontrada"));

        BigDecimal recargo = saleDTO.surcharge() != null ? saleDTO.surcharge() : BigDecimal.ZERO;
        BigDecimal porcentajeRecargo = saleDTO.surchargeRate() != null ? saleDTO.surchargeRate() : BigDecimal.ZERO;
        BigDecimal descuento = saleDTO.discount() != null ? saleDTO.discount() : BigDecimal.ZERO;
        String paymentMethodClean = normalizePaymentMethod(saleDTO.paymentMethod());

        Sale sale = Sale.builder()
                .user(user)
                .company(company)
                .cashRegisterSession(activeSession)
                .saleDate(LocalDateTime.now())
                .items(new ArrayList<>())
                .discount(descuento)
                .surcharge(recargo)
                .surchargeRate(porcentajeRecargo)
                .paymentMethod(paymentMethodClean)
                .canceled(false)
                .total(BigDecimal.ZERO)
                .build();

        BigDecimal subtotalAcumulado = BigDecimal.ZERO;

        for (SaleItemRequestDTO itemDTO : saleDTO.items()) {
            Product product = productRepository.findByIdForUpdate(itemDTO.productId())
                    .orElseThrow(() -> new ResourceNotFoundException("Producto ID " + itemDTO.productId() + " no encontrado."));

            if (product.getCompany() == null || !product.getCompany().getId().equals(companyId)) {
                throw new ResourceNotFoundException("Producto ID " + itemDTO.productId() + " no encontrado en su empresa.");
            }

            BigDecimal stockActual = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
            BigDecimal cantidadVendida = itemDTO.quantity() != null ? itemDTO.quantity() : BigDecimal.ONE;

            if (stockActual.compareTo(cantidadVendida) < 0) {
                throw new BadRequestException("Stock insuficiente para: " + product.getName() + " (Disponible: " + stockActual + ")");
            }

            product.setStock(stockActual.subtract(cantidadVendida));
            productRepository.save(product);

            BigDecimal precioVenta = (itemDTO.price() != null) ? itemDTO.price() : product.getPrice();
            BigDecimal subtotalItem = precioVenta.multiply(cantidadVendida);

            SaleItem item = SaleItem.builder()
                    .sale(sale)
                    .product(product)
                    .quantity(cantidadVendida)
                    .price(precioVenta)
                    .cost(product.getCost() != null ? product.getCost() : BigDecimal.ZERO)
                    .subtotal(subtotalItem)
                    .build();

            sale.addItem(item);
            subtotalAcumulado = subtotalAcumulado.add(subtotalItem);
        }

        BigDecimal totalFinal = subtotalAcumulado.add(recargo).subtract(descuento);
        sale.setTotal(totalFinal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : totalFinal);

        // ==========================================
        // EMISIÓN FISCAL AFIP WSFEv1
        // ==========================================
        if (saleDTO.shouldEmitInvoice()) {
            afipBillingService.processFiscalSale(sale, company);
        } else {
            Long siguienteNumeroTicket = (company.getLastTicketNumber() != null ? company.getLastTicketNumber() : 0L) + 1L;
            company.setLastTicketNumber(siguienteNumeroTicket);
            String nroComprobanteFormateado = String.format("00001-%08d", siguienteNumeroTicket);

            sale.setInvoiceType("TICKET INTERNO");
            sale.setTipoComprobante("TICKET INTERNO");
            sale.setInvoiceNumber(nroComprobanteFormateado);
            sale.setNroComprobante(nroComprobanteFormateado);
        }

        Sale savedSale = saleRepository.save(sale);

        for (SaleItem item : savedSale.getItems()) {
            InventoryMovement movement = InventoryMovement.builder()
                    .movementType(MovementType.SALE)
                    .quantity(item.getQuantity())
                    .reason("Venta Ticket #" + savedSale.getNroComprobante())
                    .product(item.getProduct())
                    .build();
            movement.setCompany(company);
            inventoryRepository.save(movement);
        }

        if ("CUENTA_CORRIENTE".equals(paymentMethodClean)) {
            handleCreditSale(saleDTO.customerId(), savedSale, companyId);
        }

        try {
            auditService.logAction(
                    "VENTA_REGISTRADA",
                    "Ticket #" + savedSale.getNroComprobante() + " por $" + savedSale.getTotal(),
                    "INFO"
            );
        } catch (Exception e) {
            log.error("Error al registrar auditoría de la venta #{}: {}", savedSale.getNroComprobante(), e.getMessage());
        }

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
                "Venta Libreta Ticket #" + savedSale.getNroComprobante(),
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
        List<Sale> sales = saleRepository.findByCompanyIdOrderBySaleDateDesc(companyId);

        return sales.stream().map(this::mapToResponseDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BoxReportDTO getBoxReport(String period, LocalDate from, LocalDate to) {
        Long companyId = requireCompanyContext();

        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime endOfToday = LocalDate.now().atTime(LocalTime.MAX);

        // 1. OBTENER CAJAS DE LA JORNADA COMERCIAL (Incluye abiertas de trasnoche pasadas las 00:00 hs)
        List<CashRegisterSession> todaySessionsEntities = cashRegisterSessionRepository
                .findCommercialDaySessions(companyId, startOfToday, endOfToday);

        List<CashSessionResponseDTO> todaySessions = new ArrayList<>();

        BigDecimal activeInitialAmount = BigDecimal.ZERO;
        BigDecimal activeCashSales = BigDecimal.ZERO;
        BigDecimal activeCustomerPayments = BigDecimal.ZERO;
        BigDecimal activeExpenses = BigDecimal.ZERO;
        BigDecimal activeRealBalance = BigDecimal.ZERO;

        for (CashRegisterSession session : todaySessionsEntities) {
            CashSessionResponseDTO sessionDTO = mapToSessionResponseDTO(session);
            todaySessions.add(sessionDTO);

            if (session.getStatus() == CashSessionStatus.OPEN || activeRealBalance.equals(BigDecimal.ZERO)) {
                activeInitialAmount = sessionDTO.initialAmount();
                activeCashSales = sessionDTO.totalCashSales();
                activeCustomerPayments = sessionDTO.totalCustomerPayments();
                activeExpenses = sessionDTO.totalExpenses();

                activeRealBalance = activeInitialAmount
                        .add(activeCashSales)
                        .add(activeCustomerPayments)
                        .subtract(activeExpenses);
            }
        }

        // 2. CAPA COMERCIAL CONSOLIDADA DEL DÍA (Flujo de Caja Puro)
        List<Sale> todaySales = saleRepository.findActiveSalesByCompanyAndDateRange(companyId, startOfToday, endOfToday);
        BigDecimal directCashSalesToday = BigDecimal.ZERO;
        BigDecimal directTransferSalesToday = BigDecimal.ZERO;
        BigDecimal creditSalesToday = BigDecimal.ZERO;

        for (Sale s : todaySales) {
            if (Boolean.TRUE.equals(s.getCanceled())) continue;
            String method = normalizePaymentMethod(s.getPaymentMethod());

            if ("EFECTIVO".equals(method)) {
                directCashSalesToday = directCashSalesToday.add(s.getTotal());
            } else if ("TRANSFERENCIA".equals(method)) {
                directTransferSalesToday = directTransferSalesToday.add(s.getTotal());
            } else if ("CUENTA_CORRIENTE".equals(method)) {
                creditSalesToday = creditSalesToday.add(s.getTotal());
            }
        }

        BigDecimal cobrosEfeToday = customerMovementRepository.sumPaymentsByMethodAndCompanyId("EFECTIVO", companyId, startOfToday, endOfToday);
        if (cobrosEfeToday == null) cobrosEfeToday = BigDecimal.ZERO;

        BigDecimal cobrosTraToday = customerMovementRepository.sumPaymentsByMethodAndCompanyId("TRANSFERENCIA", companyId, startOfToday, endOfToday);
        if (cobrosTraToday == null) cobrosTraToday = BigDecimal.ZERO;

        BigDecimal cashExpensesToday = expenseRepository.sumDeductibleCashExpenses(companyId, startOfToday, endOfToday);
        if (cashExpensesToday == null) cashExpensesToday = BigDecimal.ZERO;

        BigDecimal transferExpensesToday = expenseRepository.sumDeductibleExpensesByPaymentMethod(companyId, PaymentMethod.TRANSFERENCIA, startOfToday, endOfToday);
        if (transferExpensesToday == null) transferExpensesToday = BigDecimal.ZERO;

        // Total Ingresos Reales del Día (Ventas Efectivo/Transferencia + Cobros de Deudas)
        BigDecimal totalSalesToday = directCashSalesToday
                .add(directTransferSalesToday)
                .add(cobrosEfeToday)
                .add(cobrosTraToday);

        BigDecimal transferSalesToday = directTransferSalesToday.add(cobrosTraToday);

        BigDecimal totalPendingCredit = customerRepository.sumAllBalancesByCompanyId(companyId);
        if (totalPendingCredit == null) totalPendingCredit = BigDecimal.ZERO;

        // 3. CAPA HISTÓRICA / RANGOS AUDITADOS (FLUJO DE CAJA PURO)
        LocalDateTime startRange = (from != null) ? from.atStartOfDay() : LocalDate.now().atStartOfDay();
        LocalDateTime endRange = (to != null) ? to.atTime(LocalTime.MAX) : LocalDate.now().atTime(LocalTime.MAX);

        List<Sale> rangeSales = saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, startRange, endRange);
        BigDecimal collectedReplacementCost = BigDecimal.ZERO;
        long periodOperations = 0;

        BigDecimal periodCashSales = BigDecimal.ZERO;
        BigDecimal periodTransferSales = BigDecimal.ZERO;
        BigDecimal periodCreditSales = BigDecimal.ZERO;
        long periodCashCount = 0;
        long periodTransferCount = 0;
        long periodCreditCount = 0;

        for (Sale s : rangeSales) {
            if (Boolean.TRUE.equals(s.getCanceled())) continue;
            periodOperations++;

            String method = normalizePaymentMethod(s.getPaymentMethod());
            if ("EFECTIVO".equals(method)) {
                periodCashSales = periodCashSales.add(s.getTotal());
                periodCashCount++;
            } else if ("TRANSFERENCIA".equals(method)) {
                periodTransferSales = periodTransferSales.add(s.getTotal());
                periodTransferCount++;
            } else if ("CUENTA_CORRIENTE".equals(method)) {
                periodCreditSales = periodCreditSales.add(s.getTotal());
                periodCreditCount++;
            }

            // El costo de mercadería y ganancia se calculan solo sobre ventas efectivamente cobradas (Efectivo y Transferencia)
            if (!"CUENTA_CORRIENTE".equals(method) && s.getItems() != null) {
                for (SaleItem item : s.getItems()) {
                    BigDecimal costUnit = item.getCost() != null ? item.getCost() : BigDecimal.ZERO;
                    collectedReplacementCost = collectedReplacementCost.add(costUnit.multiply(item.getQuantity()));
                }
            }
        }

        // Cobros de Cuenta Corriente en el período
        BigDecimal periodCustomerPaymentsCash = customerMovementRepository.sumPaymentsByMethodAndCompanyId("EFECTIVO", companyId, startRange, endRange);
        if (periodCustomerPaymentsCash == null) periodCustomerPaymentsCash = BigDecimal.ZERO;

        BigDecimal periodCustomerPaymentsTransfer = customerMovementRepository.sumPaymentsByMethodAndCompanyId("TRANSFERENCIA", companyId, startRange, endRange);
        if (periodCustomerPaymentsTransfer == null) periodCustomerPaymentsTransfer = BigDecimal.ZERO;

        // Gastos en el período
        BigDecimal periodExpensesCash = expenseRepository.sumDeductibleCashExpenses(companyId, startRange, endRange);
        if (periodExpensesCash == null) periodExpensesCash = BigDecimal.ZERO;

        BigDecimal periodExpensesTransfer = expenseRepository.sumDeductibleExpensesByPaymentMethod(companyId, PaymentMethod.TRANSFERENCIA, startRange, endRange);
        if (periodExpensesTransfer == null) periodExpensesTransfer = BigDecimal.ZERO;

        // FÓRMULA DE RECAUDACIÓN (FLUJO DE CAJA PURO):
        // grossRevenue = Ventas (Efectivo + Transferencia) + Cobros de Deudas (Efectivo + Transferencia)
        BigDecimal grossRevenue = periodCashSales
                .add(periodTransferSales)
                .add(periodCustomerPaymentsCash)
                .add(periodCustomerPaymentsTransfer);

        // netRevenue (Ganancia Neta) sobre ventas efectivamente cobradas menos costo de mercadería
        BigDecimal netRevenue = grossRevenue.subtract(collectedReplacementCost);

        // Total Efectivo = Ventas Directas Efectivo + Pagos Cta. Cte. Efectivo - Gastos Efectivo
        BigDecimal periodNetCash = periodCashSales.add(periodCustomerPaymentsCash).subtract(periodExpensesCash);

        // Total Transferencia = Ventas Directas Transferencia + Pagos Cta. Cte. Transferencia
        BigDecimal periodNetTransfer = periodTransferSales.add(periodCustomerPaymentsTransfer);

        return new BoxReportDTO(
                activeInitialAmount,
                directCashSalesToday,
                cobrosEfeToday,
                cashExpensesToday,
                activeRealBalance,
                totalSalesToday,
                transferSalesToday,
                transferExpensesToday,
                creditSalesToday,
                totalPendingCredit,
                grossRevenue,
                periodOperations,
                netRevenue,
                collectedReplacementCost,
                periodCashSales,
                periodCustomerPaymentsCash,
                periodExpensesCash,
                periodTransferSales,
                periodCustomerPaymentsTransfer,
                periodExpensesTransfer,
                periodCreditSales,
                periodNetCash,
                periodNetTransfer,
                periodCashCount,
                periodTransferCount,
                periodCreditCount,
                periodCashSales,
                periodTransferSales,
                periodCreditSales,
                periodCustomerPaymentsCash,
                periodCustomerPaymentsTransfer,
                periodExpensesCash,
                periodExpensesTransfer,
                periodNetCash,
                periodNetTransfer,
                todaySessions
        );
    }

    private CashSessionResponseDTO mapToSessionResponseDTO(CashRegisterSession session) {
        LocalDateTime start = session.getOpenedAt();
        LocalDateTime end = session.getClosedAt() != null ? session.getClosedAt().plusSeconds(2) : LocalDateTime.now().plusSeconds(2);

        List<Sale> sales = saleRepository.findActiveSalesBySessionId(session.getId());

        BigDecimal cashSales = BigDecimal.ZERO;
        BigDecimal transferSales = BigDecimal.ZERO;
        BigDecimal creditSales = BigDecimal.ZERO;

        for (Sale s : sales) {
            if ("EFECTIVO".equalsIgnoreCase(s.getPaymentMethod())) {
                cashSales = cashSales.add(s.getTotal());
            } else if ("TRANSFERENCIA".equalsIgnoreCase(s.getPaymentMethod())) {
                transferSales = transferSales.add(s.getTotal());
            } else if ("CUENTA_CORRIENTE".equalsIgnoreCase(s.getPaymentMethod())) {
                creditSales = creditSales.add(s.getTotal());
            }
        }

        BigDecimal cobrosEfe = customerMovementRepository.sumPaymentsBySessionAndMethod("EFECTIVO", session.getCompany().getId(), session.getId(), start, end);
        if (cobrosEfe == null) cobrosEfe = BigDecimal.ZERO;

        BigDecimal expensesEfe = expenseRepository.sumDeductibleCashExpenses(session.getCompany().getId(), start, end);
        if (expensesEfe == null) expensesEfe = BigDecimal.ZERO;

        String uName = session.getUser() != null ? session.getUser().getName() : "Usuario Desconocido";

        return new CashSessionResponseDTO(
                session.getId(),
                session.getSessionNumber() != null ? session.getSessionNumber() : 1,
                uName,
                session.getOpenedAt(),
                session.getClosedAt(),
                session.getInitialAmount(),
                session.getDeclaredAmount(),
                session.getSystemAmount(),
                session.getDifference(),
                session.getStatus(),
                session.getNotes(),
                cashSales,
                transferSales,
                creditSales,
                cobrosEfe,
                expensesEfe
        );
    }

    private String normalizePaymentMethod(String method) {
        if (method == null) return "EFECTIVO";
        String upper = method.trim().toUpperCase();

        if (upper.contains("EFECTIVO") || upper.contains("CASH")) {
            return "EFECTIVO";
        }
        if (upper.contains("TRANSFER") || upper.contains("QR") || upper.contains("DEBITO")
                || upper.contains("CREDITO") || upper.contains("MP") || upper.contains("MERCADOPAGO")) {
            return "TRANSFERENCIA";
        }
        if (upper.contains("CUENTA_CORRIENTE") || upper.contains("CTA") || upper.contains("FIADO") || upper.contains("LIBRETA")) {
            return "CUENTA_CORRIENTE";
        }
        return upper;
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
        LocalDateTime end = today.atTime(LocalTime.MAX);

        List<Sale> recentSales = saleRepository.findActiveSalesByCompanyAndDateRange(companyId, start, end);

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
            if (product != null) {
                inventoryService.registerMovement(
                        product.getId(),
                        item.getQuantity(),
                        MovementType.IN,
                        "Devolución por anulación de Ticket #" + sale.getNroComprobante()
                );
            }
        }

        // Compensación contable en cuenta corriente si el pago fue fiado / cuenta corriente
        if ("CUENTA_CORRIENTE".equalsIgnoreCase(sale.getPaymentMethod())) {
            Optional<CustomerMovement> movementOpt = customerMovementRepository.findFirstBySaleId(sale.getId());
            if (movementOpt.isPresent()) {
                Customer customer = movementOpt.get().getCustomer();
                customerService.updateBalance(
                        customer.getId(),
                        sale.getTotal(),
                        "CREDITO",
                        "Compensación por anulación de Ticket #" + sale.getNroComprobante(),
                        sale,
                        sale.getPaymentMethod()
                );
            }
        }

        saleRepository.save(sale);

        try {
            auditService.logAction("ANULACION_VENTA", "Ticket #" + sale.getNroComprobante() + " anulado", "WARN");
        } catch (Exception e) {
            log.error("Error al registrar auditoría de anulación para el Ticket #{}: {}", sale.getNroComprobante(), e.getMessage());
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getSalesByDateRange(LocalDate desde, LocalDate hasta) {
        Long companyId = requireCompanyContext();
        LocalDateTime start = desde.atStartOfDay();
        LocalDateTime end = hasta.atTime(LocalTime.MAX);

        List<Sale> sales = saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, start, end);

        return sales.stream().map(this::mapToResponseDTO).toList();
    }

    private Long requireCompanyContext() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("Acceso denegado: Se requiere un contexto de empresa válido.");
        }
        return companyId;
    }

    private SaleResponseDTO mapToResponseDTO(Sale sale) {
        List<SaleItemResponseDTO> itemDTOs = sale.getItems().stream()
                .map(item -> {
                    Product p = item.getProduct();
                    boolean isFrac = (p != null && Boolean.TRUE.equals(p.getIsFractional()));
                    String unit = isFrac ? "KG" : "UN";

                    return new SaleItemResponseDTO(
                            p != null ? p.getId() : null,
                            p != null ? p.getName() : "Producto Eliminado",
                            item.getQuantity(),
                            item.getPrice(),
                            item.getSubtotal(),
                            unit,
                            isFrac
                    );
                }).toList();

        Company comp = sale.getCompany();
        String cName = (comp != null) ? comp.getName() : "SISTEMA BASE";
        String cTaxId = (comp != null && comp.getTaxId() != null) ? comp.getTaxId() : "";
        String cAddress = (comp != null && comp.getAddress() != null) ? comp.getAddress() : "";
        String uName = (sale.getUser() != null) ? sale.getUser().getName() : "Usuario Sistema";

        return new SaleResponseDTO(
                sale.getId(),
                sale.getSaleDate(),
                sale.getTotal(),
                sale.getDiscount(),
                sale.getSurcharge(),
                sale.getSurchargeRate(),
                sale.getPaymentMethod(),
                sale.getCanceled(),
                uName,
                cName,
                cTaxId,
                cAddress,
                itemDTOs,
                sale.getCae(),
                sale.getCaeVto(),
                sale.getTipoComprobante(),
                sale.getNroComprobante(),
                sale.getInvoiceType(),
                sale.getInvoiceNumber(),
                sale.getCaeExpiration()
        );
    }
}