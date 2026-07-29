package com.baez.baezpos.sale.service.SaleService;

import com.baez.baezpos.sale.dto.BoxReportDTO;
import com.baez.baezpos.sale.dto.ChartDataDTO;
import com.baez.baezpos.sale.dto.SaleRequestDTO;
import com.baez.baezpos.sale.dto.SaleResponseDTO;

import java.time.LocalDate;
import java.util.List;

public interface SaleService {
    SaleResponseDTO createSale(SaleRequestDTO saleDTO, Long userId);
    SaleResponseDTO getSaleById(Long id);
    List<SaleResponseDTO> getAllSales();
    BoxReportDTO getBoxReport(String period);
    List<ChartDataDTO> getSalesChartData();
    void cancelSale(Long saleId);
    List<SaleResponseDTO> getSalesByDateRange(LocalDate desde, LocalDate hasta);
}