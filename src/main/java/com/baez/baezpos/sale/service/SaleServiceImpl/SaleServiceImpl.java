package com.baez.baezpos.sale.service.SaleServiceImpl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.customer.entities.Customer;
import com.baez.baezpos.customer.repository.CustomerMovementRepository;
import com.baez.baezpos.customer.repository.CustomerRepository;
import com.baez.baezpos.customer.service.CustomerService;
import com.baez.baezpos.inventory.entity.MovementType;
import com.baez.baezpos.inventory.service.InventoryService;
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
import java.math.RoundingMode;
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

    @Override
    @Transactional(rollbackFor = Exception.class)
    public SaleResponseDTO createSale(SaleRequestDTO saleDTO, Long userId) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("No se puede registrar una venta sin estar asociado a una empresa.");
        }

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

        Sale sale = Sale.builder()
                .user(user)
                .saleDate(LocalDateTime.now())
                .items(new ArrayList<>())
                .discount(descuento)
                .surcharge(recargo)
                .surchargeRate(porcentajeRecargo)
                .paymentMethod(saleDTO.paymentMethod())
                .canceled(false)
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
            if (itemDTO.quantity() == null || itemDTO.quantity() <= 0) {
                throw new BadRequestException("La cantidad enviada para el producto debe ser mayor a 0.");
            }

            Product product = productRepository.findByIdAndCompanyId(itemDTO.productId(), companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado en su empresa: ID " + itemDTO.productId()));

            if (product.getStock() < itemDTO.quantity()) {
                throw new BadRequestException("Stock insuficiente para: " + product.getName() + " (Stock actual: " + product.getStock() + ")");
            }

            BigDecimal precioVenta = (itemDTO.price() != null) ? itemDTO.price() : product.getPrice();
            BigDecimal subtotalItem = precioVenta.multiply(BigDecimal.valueOf(itemDTO.quantity()));

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
        savedSale.setNroComprobante(String.format("00001-%08d", savedSale.getId()));
        savedSale = saleRepository.save(savedSale);

        for (SaleItem item : savedSale.getItems()) {
            inventoryService.registerMovement(
                    item.getProduct().getId(),
                    item.getQuantity(),
                    MovementType.SALE,
                    "Venta #" + savedSale.getId()
            );
        }

        if ("CUENTA_CORRIENTE".equals(saleDTO.paymentMethod())) {
            handleCreditSale(saleDTO.customerId(), savedSale, companyId);
        }

        log.info("Venta procesada ID: {} - Total: ${} - Empresa: {}", savedSale.getId(), savedSale.getTotal(), company.getName());
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
                "Venta en libreta #" + savedSale.getId(),
                savedSale,
                savedSale.getPaymentMethod()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public SaleResponseDTO getSaleById(Long id) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Sale sale;

        if (companyId != null) {
            sale = saleRepository.findByIdAndCompanyId(id, companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada"));
        } else {
            sale = saleRepository.findById(id)
                    .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada"));
        }

        return mapToResponseDTO(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getAllSales() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        List<Sale> sales;

        if (companyId != null) {
            sales = saleRepository.findByCompanyIdOrderBySaleDateDesc(companyId);
        } else {
            sales = saleRepository.findAllByOrderBySaleDateDesc();
        }

        return sales.stream()
                .map(this::mapToResponseDTO)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public BoxReportDTO getBoxReport(String period, LocalDate from, LocalDate to) {
        Long companyId = SecurityUtils.getCurrentCompanyId();

        // 1. Fechas fijas para métricas de "HOY"
        LocalDateTime startToday = LocalDate.now().atStartOfDay();
        LocalDateTime endToday = LocalDate.now().atTime(LocalTime.MAX);

        // 2. Fechas dinámicas para el rango/mes solicitado
        LocalDateTime startRange;
        LocalDateTime endRange;

        if (from != null && to != null) {
            startRange = from.atStartOfDay();
            endRange = to.atTime(LocalTime.MAX);
        } else {
            // Fallback por defecto: Mes Actual
            startRange = LocalDate.now().withDayOfMonth(1).atStartOfDay();
            endRange = LocalDate.now().with(TemporalAdjusters.lastDayOfMonth()).atTime(LocalTime.MAX);
        }

        // Consultar ventas en el rango dinámico
        List<Sale> rangeSales;
        if (companyId != null) {
            rangeSales = saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, startRange, endRange);
        } else {
            rangeSales = saleRepository.findBySaleDateBetweenOrderBySaleDateDesc(startRange, endRange);
        }

        BigDecimal vCash = BigDecimal.ZERO;
        BigDecimal vTransfer = BigDecimal.ZERO;
        BigDecimal tProfitDirecto = BigDecimal.ZERO;

        BigDecimal mSales = BigDecimal.ZERO;
        BigDecimal mCostAccumulator = BigDecimal.ZERO;
        long mCount = 0;

        for (Sale s : rangeSales) {
            if (s.getCanceled()) continue;

            // Acumuladores del periodo seleccionado (Calendario)
            mSales = mSales.add(s.getTotal());
            mCount++;

            for (SaleItem item : s.getItems()) {
                BigDecimal costUnit = item.getCost() != null ? item.getCost() : BigDecimal.ZERO;
                BigDecimal itemCostTotal = costUnit.multiply(BigDecimal.valueOf(item.getQuantity()));
                mCostAccumulator = mCostAccumulator.add(itemCostTotal);
            }

            // Filtro exclusivo para caja del día actual (Top Cards)
            if (!s.getSaleDate().isBefore(startToday) && !s.getSaleDate().isAfter(endToday)) {
                if ("EFECTIVO".equals(s.getPaymentMethod())) {
                    vCash = vCash.add(s.getTotal());
                } else if ("TRANSFERENCIA".equals(s.getPaymentMethod())) {
                    vTransfer = vTransfer.add(s.getTotal());
                }

                if (!"CUENTA_CORRIENTE".equals(s.getPaymentMethod())) {
                    for (SaleItem item : s.getItems()) {
                        BigDecimal costUnit = item.getCost() != null ? item.getCost() : BigDecimal.ZERO;
                        BigDecimal itemProfit = item.getSubtotal().subtract(costUnit.multiply(BigDecimal.valueOf(item.getQuantity())));
                        tProfitDirecto = tProfitDirecto.add(itemProfit);
                    }
                }
            }
        }

        BigDecimal cobrosEfe = BigDecimal.ZERO;
        BigDecimal cobrosTra = BigDecimal.ZERO;

        if (companyId != null) {
            cobrosEfe = customerMovementRepository.sumPaymentsByMethodAndCompanyId("EFECTIVO", companyId, startToday, endToday);
            cobrosTra = customerMovementRepository.sumPaymentsByMethodAndCompanyId("TRANSFERENCIA", companyId, startToday, endToday);
        }

        if (cobrosEfe == null) cobrosEfe = BigDecimal.ZERO;
        if (cobrosTra == null) cobrosTra = BigDecimal.ZERO;

        BigDecimal cobrosTotalHoy = cobrosEfe.add(cobrosTra);
        BigDecimal cashFinal = vCash.add(cobrosEfe);
        BigDecimal transferFinal = vTransfer.add(cobrosTra);
        BigDecimal recaudacionYBalanceReal = cashFinal.add(transferFinal);

        BigDecimal margenGananciaPromedio = BigDecimal.ZERO;
        if (mSales.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal mProfitTemp = mSales.subtract(mCostAccumulator);
            margenGananciaPromedio = mProfitTemp.divide(mSales, 4, RoundingMode.HALF_UP);
        }

        BigDecimal gananciaCobrosLibreta = cobrosTotalHoy.multiply(margenGananciaPromedio);
        BigDecimal totalProfitReal = tProfitDirecto.add(gananciaCobrosLibreta);

        BigDecimal mProfit = mSales.subtract(mCostAccumulator);
        BigDecimal deudaTotalHistorica = BigDecimal.ZERO;

        if (companyId != null) {
            deudaTotalHistorica = customerRepository.sumAllBalancesByCompanyId(companyId);
        }

        if (deudaTotalHistorica == null) deudaTotalHistorica = BigDecimal.ZERO;

        return new BoxReportDTO(
                recaudacionYBalanceReal,
                cashFinal,
                transferFinal,
                deudaTotalHistorica,
                totalProfitReal,
                recaudacionYBalanceReal,
                mSales,
                mCount,
                mProfit,
                mCostAccumulator
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChartDataDTO> getSalesChartData() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        LocalDate today = LocalDate.now();
        Map<LocalDate, BigDecimal> last7Days = new LinkedHashMap<>();

        for (int i = 6; i >= 0; i--) {
            last7Days.put(today.minusDays(i), BigDecimal.ZERO);
        }

        LocalDateTime start = today.minusDays(6).atStartOfDay();
        LocalDateTime end = today.atTime(23, 59, 59);

        List<Sale> recentSales;
        if (companyId != null) {
            recentSales = saleRepository.findByCompanyIdAndSaleDateBetweenAndCanceledFalse(companyId, start, end);
        } else {
            recentSales = saleRepository.findBySaleDateBetweenAndCanceledFalse(start, end);
        }

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
        Long companyId = SecurityUtils.getCurrentCompanyId();
        Sale sale;

        if (companyId != null) {
            sale = saleRepository.findByIdAndCompanyId(saleId, companyId)
                    .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada"));
        } else {
            sale = saleRepository.findById(saleId)
                    .orElseThrow(() -> new ResourceNotFoundException("Venta no encontrada"));
        }

        if (Boolean.TRUE.equals(sale.getCanceled())) {
            throw new BadRequestException("La venta ya se encuentra anulada.");
        }

        sale.setCanceled(true);

        for (SaleItem item : sale.getItems()) {
            Product product = item.getProduct();
            product.setStock(product.getStock() + item.getQuantity());
            productRepository.save(product);
        }

        saleRepository.save(sale);
    }

    @Override
    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getSalesByDateRange(LocalDate desde, LocalDate hasta) {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        LocalDateTime start = desde.atStartOfDay();
        LocalDateTime end = hasta.atTime(LocalTime.MAX);

        List<Sale> sales;
        if (companyId != null) {
            sales = saleRepository.findByCompanyIdAndSaleDateBetweenOrderBySaleDateDesc(companyId, start, end);
        } else {
            sales = saleRepository.findBySaleDateBetweenOrderBySaleDateDesc(start, end);
        }

        return sales.stream()
                .map(this::mapToResponseDTO)
                .toList();
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