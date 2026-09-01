package com.baez.baezpos.sale.service.SaleService;

import com.baez.baezpos.sale.dto.BoxReportDTO;
import com.baez.baezpos.sale.dto.ChartDataDTO;
import com.baez.baezpos.sale.dto.SaleRequestDTO;
import com.baez.baezpos.sale.dto.SaleResponseDTO;
import com.baez.baezpos.sale.entity.Sale;
import com.baez.baezpos.company.entity.Company;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

public interface SaleService {
    SaleResponseDTO createSale(SaleRequestDTO saleDTO, Long userId);
    SaleResponseDTO getSaleById(Long id);
    List<SaleResponseDTO> getAllSales();
    BoxReportDTO getBoxReport(String period, LocalDate from, LocalDate to);
    List<ChartDataDTO> getSalesChartData();
    void cancelSale(Long saleId);
    List<SaleResponseDTO> getSalesByDateRange(LocalDate desde, LocalDate hasta);
    Page<SaleResponseDTO> getSalesByDateRange(LocalDate desde, LocalDate hasta, Pageable pageable);
    
    // Métodos internos para desacople de transacciones
    Sale persistSaleAndStock(SaleRequestDTO saleDTO, Long userId, Long companyId);
    void updateSaleWithFiscalData(Sale sale, Company company);
}