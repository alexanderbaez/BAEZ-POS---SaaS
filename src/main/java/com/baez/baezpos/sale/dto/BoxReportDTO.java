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

        // === CAPA 3: RENDIMIENTO HISTÓRICO Y RANGOS (FLUJO DE CAJA PURO) ===
        BigDecimal periodSales,              // grossRevenue = cashSales + transferSales + cashPayments + transferPayments
        Long periodOperations,
        BigDecimal periodProfit,             // netRevenue sobre ventas efectivamente cobradas
        BigDecimal periodReplacementCost,

        // === CAPA 4: TRAZABILIDAD Y DESGLOSE FINANCIERO EN EL PERÍODO ===
        BigDecimal cashSales,                // Ventas Efectivo
        BigDecimal cashPayments,             // Cobros Cta. Cte. Efectivo
        BigDecimal cashExpenses,             // Gastos Efectivo
        BigDecimal transferSales,            // Ventas Transferencia
        BigDecimal transferPayments,         // Cobros Cta. Cte. Transferencia
        BigDecimal transferExpenses,         // Gastos Transferencia
        BigDecimal creditSales,              // Fiado / Cta Cte emitido
        BigDecimal netCash,                  // cashSales + cashPayments - cashExpenses
        BigDecimal netTransfer,              // transferSales + transferPayments
        Long periodCashCount,
        Long periodTransferCount,
        Long periodCreditCount,

        // Aliases para máxima compatibilidad
        BigDecimal periodCashSales,
        BigDecimal periodTransferSales,
        BigDecimal periodCreditSales,
        BigDecimal periodCustomerPaymentsCash,
        BigDecimal periodCustomerPaymentsTransfer,
        BigDecimal periodExpensesCash,
        BigDecimal periodExpensesTransfer,
        BigDecimal periodNetCash,
        BigDecimal periodNetTransfer,

        // === AUDITORÍA DE TURNOS Y MULTI-CAJA DEL DÍA ===
        List<CashSessionResponseDTO> todaySessions
) {}