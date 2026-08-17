package com.baez.baezpos.sale.service.SaleServiceImpl;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.company.repository.CompanyRepository;
import com.baez.baezpos.customer.repository.CustomerMovementRepository;
import com.baez.baezpos.expense.repository.ExpenseRepository;
import com.baez.baezpos.log.service.AuditService;
import com.baez.baezpos.sale.dto.CashSessionResponseDTO;
import com.baez.baezpos.sale.dto.CloseCashSessionRequestDTO;
import com.baez.baezpos.sale.dto.OpenCashSessionRequestDTO;
import com.baez.baezpos.sale.entity.CashRegisterSession;
import com.baez.baezpos.sale.entity.CashSessionStatus;
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.sale.repository.CashRegisterSessionRepository;
import com.baez.baezpos.sale.repository.SaleRepository;
import com.baez.baezpos.sale.service.SaleService.CashRegisterService;
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
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CashRegisterServiceImpl implements CashRegisterService {

    private final CashRegisterSessionRepository cashRegisterSessionRepository;
    private final SaleRepository saleRepository;
    private final UserRepository userRepository;
    private final CompanyRepository companyRepository;
    private final CustomerMovementRepository customerMovementRepository;
    private final ExpenseRepository expenseRepository;
    private final AuditService auditService;

    @Override
    @Transactional
    public CashSessionResponseDTO openSession(OpenCashSessionRequestDTO requestDTO) {
        Long companyId = requireCompanyContext();

        boolean existsOpen = cashRegisterSessionRepository.existsByCompanyIdAndStatus(companyId, CashSessionStatus.OPEN);
        if (existsOpen) {
            throw new BadRequestException("Ya existe una caja abierta para esta empresa. Debe cerrarla antes de abrir una nueva.");
        }

        User user = getCurrentUser();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new ResourceNotFoundException("Empresa asociada no encontrada"));

        // LÓGICA DE SECUENCIA DIARIA POR TENANT (Reinicia cada día a 1)
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        LocalDateTime endOfToday = LocalDate.now().atTime(LocalTime.MAX);
        int todayCount = cashRegisterSessionRepository.countSessionsByCompanyAndDateRange(companyId, startOfToday, endOfToday);
        int nextSessionNumber = todayCount + 1;

        CashRegisterSession session = CashRegisterSession.builder()
                .company(company)
                .user(user)
                .sessionNumber(nextSessionNumber)
                .openedAt(LocalDateTime.now())
                .initialAmount(requestDTO.initialAmount() != null ? requestDTO.initialAmount() : BigDecimal.ZERO)
                .status(CashSessionStatus.OPEN)
                .build();

        CashRegisterSession savedSession = cashRegisterSessionRepository.save(session);

        try {
            auditService.logAction("APERTURA_CAJA", "Caja #" + savedSession.getSessionNumber() + " abierta con fondo inicial de $" + savedSession.getInitialAmount(), "INFO");
        } catch (Exception e) {
            log.error("Error al registrar auditoría de apertura de caja: {}", e.getMessage());
        }

        return mapToResponseDTO(savedSession);
    }

    @Override
    @Transactional
    public CashSessionResponseDTO closeSession(CloseCashSessionRequestDTO requestDTO) {
        Long companyId = requireCompanyContext();

        CashRegisterSession session = cashRegisterSessionRepository
                .findFirstByCompanyIdAndStatusOrderByIdDesc(companyId, CashSessionStatus.OPEN)
                .orElseThrow(() -> new BadRequestException("No hay ninguna caja abierta para cerrar."));

        LocalDateTime closedAt = LocalDateTime.now();
        session.setClosedAt(closedAt);

        // Ventana de auditoría con margen de 2 segundos para eventos concurrentes
        LocalDateTime searchEnd = closedAt.plusSeconds(2);

        List<Sale> sales = saleRepository.findActiveSalesBySessionId(session.getId());

        BigDecimal cashSales = BigDecimal.ZERO;

        for (Sale s : sales) {
            if ("EFECTIVO".equalsIgnoreCase(s.getPaymentMethod())) {
                cashSales = cashSales.add(s.getTotal());
            }
        }

        // Cobros de deudas en efectivo
        BigDecimal cobrosEfe = customerMovementRepository.sumPaymentsByMethodAndCompanyId("EFECTIVO", companyId, session.getOpenedAt(), searchEnd);
        if (cobrosEfe == null) cobrosEfe = BigDecimal.ZERO;

        // Gastos en efectivo
        BigDecimal expensesEfe = expenseRepository.sumDeductibleCashExpenses(companyId, session.getOpenedAt(), searchEnd);
        if (expensesEfe == null) expensesEfe = BigDecimal.ZERO;

        // Ecuación de Arqueo Físico de Cajón
        BigDecimal systemCashCalculated = session.getInitialAmount()
                .add(cashSales)
                .add(cobrosEfe)
                .subtract(expensesEfe);

        BigDecimal declared = requestDTO.declaredAmount() != null ? requestDTO.declaredAmount() : BigDecimal.ZERO;
        BigDecimal difference = declared.subtract(systemCashCalculated);

        session.setSystemAmount(systemCashCalculated);
        session.setDeclaredAmount(declared);
        session.setDifference(difference);
        session.setStatus(CashSessionStatus.CLOSED);
        session.setNotes(requestDTO.notes());

        CashRegisterSession closedSession = cashRegisterSessionRepository.save(session);

        try {
            auditService.logAction("CIERRE_CAJA", "Caja #" + closedSession.getSessionNumber() + " cerrada. Declarado: $" + declared + " | Esperado: $" + systemCashCalculated + " | Dif: $" + difference, "INFO");
        } catch (Exception e) {
            log.error("Error al registrar auditoría de cierre de caja: {}", e.getMessage());
        }

        return mapToResponseDTO(closedSession);
    }

    @Override
    @Transactional(readOnly = true)
    public CashSessionResponseDTO getActiveSession() {
        Long companyId = requireCompanyContext();

        CashRegisterSession session = cashRegisterSessionRepository
                .findFirstByCompanyIdAndStatusOrderByIdDesc(companyId, CashSessionStatus.OPEN)
                .orElseThrow(() -> new ResourceNotFoundException("No se encontró una caja abierta."));

        return mapToResponseDTO(session);
    }

    private Long requireCompanyContext() {
        Long companyId = SecurityUtils.getCurrentCompanyId();
        if (companyId == null) {
            throw new BadRequestException("Acceso denegado: Se requiere un contexto de empresa válido.");
        }
        return companyId;
    }

    private User getCurrentUser() {
        String email = SecurityUtils.getCurrentUserEmail();
        if (email == null) {
            throw new BadRequestException("No se identificó el usuario autenticado.");
        }
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado: " + email));
    }

    private CashSessionResponseDTO mapToResponseDTO(CashRegisterSession session) {
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

        BigDecimal cobrosEfe = customerMovementRepository.sumPaymentsByMethodAndCompanyId("EFECTIVO", session.getCompany().getId(), start, end);
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
}