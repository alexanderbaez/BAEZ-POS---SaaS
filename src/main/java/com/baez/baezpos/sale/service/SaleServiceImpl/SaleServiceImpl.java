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
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.product.entity.Product;
import com.baez.baezpos.product.repository.ProductRepository;
import com.baez.baezpos.sale.dto.*;
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.sale.entity.SaleItem;
import com.baez.baezpos.sale.repository.SaleRepository;
import com.baez.baezpos.sale.service.SaleService;
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
    private final UserRepository userRepository;
    private final CustomerService customerService;
    private final CustomerRepository customerRepository;
    private final CustomerMovementRepository customerMovementRepository;
    private final CompanyRepository companyRepository;
    private final ExpenseRepository expenseRepository;
    private final AuditService auditService;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SaleResponseDTO createSale(SaleRequestDTO saleDTO, Long userId) {
        Long companyId = requireCompanyContext();

        if (saleDTO.items() == null || saleDTO.items().isEmpty()) {
            throw new BadRequestException("La venta debe contener al menos un producto.");
        }

        // 1. Obtención eficiente del usuario emisor
        User user;
        if (userId != null) {
            user = userRepository.getReferenceById(userId);
        } else {
            String currentEmail = SecurityUtils.getCurrentUserEmail();
            if (currentEmail == null) {
                throw new BadRequestException("No se pudo identificar al usuario emisor de la venta.");
            }
            user = userRepository.findByEmail(currentEmail)
                    .orElseThrow(() -> new ResourceNotFoundException("Usuario emisor no encontrado: " + currentEmail));
        }

        // 2. Obtención de la empresa
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa asociada no encontrada"));

        BigDecimal recargo = saleDTO.surcharge() != null ? saleDTO.surcharge() : BigDecimal.ZERO;
        BigDecimal porcentajeRecargo = saleDTO.surchargeRate() != null ? saleDTO.surchargeRate() : BigDecimal.ZERO;
        BigDecimal descuento = saleDTO.discount() != null ? saleDTO.discount() : BigDecimal.ZERO;

        // 3. Asignación del número de comprobante (Hibernate sincroniza al commit por Dirty Checking)
        Long siguienteNumeroTicket = (company.getLastTicketNumber() != null ? company.getLastTicketNumber() : 0L) + 1L;
        company.setLastTicketNumber(siguienteNumeroTicket);

        String nroComprobanteFormateado = String.format("00001-%08d", siguienteNumeroTicket);

        // 4. Mapeo de entidad Venta
        Sale sale = Sale.builder()
                .user(user)
                .company(company)
                .saleDate(LocalDateTime.now())
                .items(new ArrayList<>())
                .discount(descuento)
                .surcharge(recargo)
                .surchargeRate(porcentajeRecargo)
                .paymentMethod(saleDTO.paymentMethod().toUpperCase())
                .canceled(false)
                .total(BigDecimal.ZERO)
                .nroComprobante(nroComprobanteFormateado)
                .tipoComprobante(Boolean.TRUE.equals(saleDTO.isFiscal()) ? "FACTURA C" : "TICKET INTERNO")
                .cae(Boolean.TRUE.equals(saleDTO.isFiscal()) ? "76543210987654" : null)
                .caeVto(Boolean.TRUE.equals(saleDTO.isFiscal()) ? LocalDate.now().plusDays(10).toString() : null)
                .build();

        // 5. Carga BATCH de productos en 1 sola consulta SQL
        List<Long> productIds = saleDTO.items().stream().map(SaleItemRequestDTO::productId).toList();
        List<Product> products = productRepository.findAllById(productIds);

        Map<Long, Product> productMap = products.stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));

        BigDecimal subtotalAcumulado = BigDecimal.ZERO;

        // 6. Validaciones y armado de ítems en memoria
        for (SaleItemRequestDTO itemDTO : saleDTO.items()) {
            Product product = productMap.get(itemDTO.productId());
            if (product == null || !product.getCompany().getId().equals(companyId)) {
                throw new ResourceNotFoundException("Producto ID " + itemDTO.productId() + " no encontrado en su empresa.");
            }

            BigDecimal stockActual = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
            if (stockActual.compareTo(itemDTO.quantity()) < 0) {
                throw new BadRequestException("Stock insuficiente para: " + product.getName() + " (Disponible: " + stockActual + ")");
            }

            BigDecimal precioVenta = (itemDTO.price() != null) ? itemDTO.price() : product.getPrice();
            BigDecimal subtotalItem = precioVenta.multiply(itemDTO.quantity());

            SaleItem item = SaleItem.builder()
                    .sale(sale)
                    .product(product)
                    .quantity(itemDTO.quantity())
                    .price(precioVenta)
                    .cost(product.getCost() != null ? product.getCost() : BigDecimal.ZERO)
                    .subtotal(subtotalItem)
                    .build();

            sale.addItem(item);
            subtotalAcumulado = subtotalAcumulado.add(subtotalItem);
        }

        // 7. Cálculo final de total y persistencia
        BigDecimal totalFinal = subtotalAcumulado.add(recargo).subtract(descuento);
        sale.setTotal(totalFinal.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : totalFinal);

        Sale savedSale = saleRepository.save(sale);

        // 8. Registro de movimientos de stock
        for (SaleItem item : savedSale.getItems()) {
            inventoryService.registerMovement(
                    item.getProduct().getId(),
                    item.getQuantity(),
                    MovementType.SALE,
                    "Venta Ticket #" + savedSale.getNroComprobante()
            );
        }

        // 9. Manejo de Cuenta Corriente
        if ("CUENTA_CORRIENTE".equalsIgnoreCase(saleDTO.paymentMethod())) {
            handleCreditSale(saleDTO.customerId(), savedSale, companyId);
        }

        // 10. Auditoría desacoplada (no bloqueante)
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
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Sale sale = (companyId != null)
                ? saleRepository.findByIdAndCompanyId(id, companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada en su empresa"))
                : saleRepository.findByIdWithDetails(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada"));

        return mapToResponseDTO(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getAllSales() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<Sale> sales = (companyId != null)
                ? saleRepository.findByCompanyIdOrderBySaleDateDesc(companyId)
                : saleRepository.findAllByOrderBySaleDateDesc();

        return sales.stream().map(this::mapToResponseDTO).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BoxReportDTO getBoxReport(String period, LocalDate from, LocalDate to) {
        Long companyId = requireCompanyContext();

        LocalDateTime startToday = LocalDate.now().atStartOfDay();
        LocalDateTime endToday = LocalDate.now().atTime(LocalTime.MAX);

        LocalDateTime startRange = (from != null) ? from.atStartOfDay() : LocalDate.now().withDayOfMonth(1).atStartOfDay();
        LocalDateTime endRange = (to != null) ? to.atTime(LocalTime.MAX) : LocalDate.now().with(TemporalAdjusters.lastDayOfMonth()).atTime(LocalTime.MAX);

        List<Sale> rangeSales = saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, startRange, endRange);

        BigDecimal periodSales = BigDecimal.ZERO;
        BigDecimal periodReplacementCost = BigDecimal.ZERO;
        long periodOperations = 0;

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

        BigDecimal cobrosEfe = customerMovementRepository.sumPaymentsByMethodAndCompanyId("EFECTIVO", companyId, startToday, endToday);
        BigDecimal cobrosTra = customerMovementRepository.sumPaymentsByMethodAndCompanyId("TRANSFERENCIA", companyId, startToday, endToday);

        cobrosEfe = (cobrosEfe != null) ? cobrosEfe : BigDecimal.ZERO;
        cobrosTra = (cobrosTra != null) ? cobrosTra : BigDecimal.ZERO;
        BigDecimal customerPaymentsToday = cobrosEfe.add(cobrosTra);

        BigDecimal expensesToday = expenseRepository.sumDeductibleExpensesByCompanyIdAndDate(companyId, startToday, endToday);
        if (expensesToday == null) expensesToday = BigDecimal.ZERO;

        BigDecimal realBalance = cashSalesToday.add(transferSalesToday).add(customerPaymentsToday).subtract(expensesToday);

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
            BigDecimal currentStock = product.getStock() != null ? product.getStock() : BigDecimal.ZERO;
            product.setStock(currentStock.add(item.getQuantity()));

            inventoryService.registerMovement(
                    product.getId(),
                    item.getQuantity(),
                    MovementType.IN,
                    "Devolución por anulación de Ticket #" + sale.getNroComprobante()
            );
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
        Long companyId = SecurityUtils.getCurrentCompanyId();
        LocalDateTime start = desde.atStartOfDay();
        LocalDateTime end = hasta.atTime(LocalTime.MAX);

        List<Sale> sales = (companyId != null)
                ? saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, start, end)
                : saleRepository.findBySaleDateBetweenOrderBySaleDateDesc(start, end);

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
                .map(item -> new SaleItemResponseDTO(
                        item.getProduct().getId(),
                        item.getProduct().getName(),
                        item.getQuantity(),
                        item.getPrice(),
                        item.getSubtotal()
                )).toList();

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
                sale.getNroComprobante()
        );
    }
}