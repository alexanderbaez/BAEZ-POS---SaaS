package com.baez.baezpos.sale.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;

public class BoxReportDTO {

    @JsonProperty("totalSalesToday")
    private BigDecimal totalSalesToday;      // Total vendido hoy (Efectivo + Transferencia + Fiado)

    @JsonProperty("cashSalesToday")
    private BigDecimal cashSalesToday;       // Efectivo entrado SOLO por ventas de hoy

    @JsonProperty("transferSalesToday")
    private BigDecimal transferSalesToday;   // Transferencias entradas SOLO por ventas de hoy

    @JsonProperty("creditSalesToday")
    private BigDecimal creditSalesToday;     // Fiado emitido HOY

    @JsonProperty("customerPaymentsToday")
    private BigDecimal customerPaymentsToday;// Cobros de Cta Cte recibidos HOY (Efectivo + Transferencia)

    @JsonProperty("expensesToday")
    private BigDecimal expensesToday;        // Gastos restables de caja abonados HOY

    @JsonProperty("realBalance")
    private BigDecimal realBalance;          // (CashSales + TransferSales + CustomerPayments) - Expenses

    @JsonProperty("totalPendingCredit")
    private BigDecimal totalPendingCredit;   // Deuda histórica total acumulada de clientes

    // Métricas del Período / Históricas (Rango de fechas)
    @JsonProperty("periodSales")
    private BigDecimal periodSales;          // Facturación total del rango

    @JsonProperty("periodOperations")
    private Long periodOperations;           // Total tickets del rango

    @JsonProperty("periodProfit")
    private BigDecimal periodProfit;         // Ganancia neta real (Ventas - Costos de productos)

    @JsonProperty("periodReplacementCost")
    private BigDecimal periodReplacementCost;// Costo total de reposición

    public BoxReportDTO(
            BigDecimal totalSalesToday, BigDecimal cashSalesToday, BigDecimal transferSalesToday,
            BigDecimal creditSalesToday, BigDecimal customerPaymentsToday, BigDecimal expensesToday,
            BigDecimal realBalance, BigDecimal totalPendingCredit, BigDecimal periodSales,
            Long periodOperations, BigDecimal periodProfit, BigDecimal periodReplacementCost) {
        this.totalSalesToday = totalSalesToday;
        this.cashSalesToday = cashSalesToday;
        this.transferSalesToday = transferSalesToday;
        this.creditSalesToday = creditSalesToday;
        this.customerPaymentsToday = customerPaymentsToday;
        this.expensesToday = expensesToday;
        this.realBalance = realBalance;
        this.totalPendingCredit = totalPendingCredit;
        this.periodSales = periodSales;
        this.periodOperations = periodOperations;
        this.periodProfit = periodProfit;
        this.periodReplacementCost = periodReplacementCost;
    }

    public BigDecimal getTotalSalesToday() { return totalSalesToday; }
    public BigDecimal getCashSalesToday() { return cashSalesToday; }
    public BigDecimal getTransferSalesToday() { return transferSalesToday; }
    public BigDecimal getCreditSalesToday() { return creditSalesToday; }
    public BigDecimal getCustomerPaymentsToday() { return customerPaymentsToday; }
    public BigDecimal getExpensesToday() { return expensesToday; }
    public BigDecimal getRealBalance() { return realBalance; }
    public BigDecimal getTotalPendingCredit() { return totalPendingCredit; }
    public BigDecimal getPeriodSales() { return periodSales; }
    public Long getPeriodOperations() { return periodOperations; }
    public BigDecimal getPeriodProfit() { return periodProfit; }
    public BigDecimal getPeriodReplacementCost() { return periodReplacementCost; }
}