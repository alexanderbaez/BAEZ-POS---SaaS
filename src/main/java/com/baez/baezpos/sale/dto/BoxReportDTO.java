package com.baez.baezpos.sale.dto;

import java.math.BigDecimal;
import java.util.List;

public record BoxReportDTO(
        // === CAPA 1: TURNO OPERATIVO / CAJÓN FÍSICO ===
        BigDecimal initialAmount,
        BigDecimal cashSalesToday,
        BigDecimal customerPaymentsToday,
        BigDecimal expensesToday,
        BigDecimal realBalance,

        // === CAPA 2: MÉTRICAS COMERCIALES DEL DÍA ===
        BigDecimal totalSalesToday,
        BigDecimal transferSalesToday,
        BigDecimal transferExpensesToday,
        BigDecimal creditSalesToday,
        BigDecimal totalPendingCredit,

        // === CAPA 3: RENDIMIENTO HISTÓRICO Y RANGOS ===
        BigDecimal periodSales,
        Long periodOperations,
        BigDecimal periodProfit,
        BigDecimal periodReplacementCost,

        // === CAPA 4: DESGLOSE FINANCIERO POR MEDIO DE PAGO EN EL PERÍODO ===
        BigDecimal periodCashSales,
        BigDecimal periodTransferSales,
        BigDecimal periodCreditSales,
        BigDecimal periodCustomerPaymentsCash,
        BigDecimal periodCustomerPaymentsTransfer,
        BigDecimal periodExpensesCash,
        BigDecimal periodExpensesTransfer,
        BigDecimal periodNetCash,        // Ventas Directas Efectivo + Pagos Cta Cte Efectivo - Gastos Efectivo
        BigDecimal periodNetTransfer,    // Ventas Directas Transferencia + Pagos Cta Cte Transferencia
        Long periodCashCount,
        Long periodTransferCount,
        Long periodCreditCount,

        // === AUDITORÍA DE TURNOS Y MULTI-CAJA DEL DÍA ===
        List<CashSessionResponseDTO> todaySessions
) {}