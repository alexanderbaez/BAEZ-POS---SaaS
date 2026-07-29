package com.baez.baezpos.sale.controller;

import com.baez.baezpos.sale.dto.BoxReportDTO;
import com.baez.baezpos.sale.dto.ChartDataDTO;
import com.baez.baezpos.sale.dto.SaleRequestDTO;
import com.baez.baezpos.sale.dto.SaleResponseDTO;
import com.baez.baezpos.sale.service.SaleService.SaleService;
import com.baez.baezpos.security.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@Slf4j
@RequestMapping("/api/v1/sales")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SaleController {

    private final SaleService saleService;

    @PostMapping
    public ResponseEntity<SaleResponseDTO> create(@RequestBody SaleRequestDTO saleDTO) {
        Long userId = SecurityUtils.getCurrentUserId();
        log.info("REST: Creando venta - Usuario: {}", userId);
        return new ResponseEntity<>(saleService.createSale(saleDTO, userId), HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<SaleResponseDTO>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {

        if (desde == null) desde = LocalDate.now();
        if (hasta == null) hasta = LocalDate.now();

        return ResponseEntity.ok(saleService.getSalesByDateRange(desde, hasta));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SaleResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.getSaleById(id));
    }

    @GetMapping("/report/box")
    public ResponseEntity<BoxReportDTO> getBoxReport(@RequestParam(required = false, defaultValue = "hoy") String period) {
        return ResponseEntity.ok(saleService.getBoxReport(period));
    }

    @GetMapping("/report/chart")
    public ResponseEntity<List<ChartDataDTO>> getSalesChartData() {
        return ResponseEntity.ok(saleService.getSalesChartData());
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelSale(@PathVariable Long id) {
        saleService.cancelSale(id);
        return ResponseEntity.noContent().build();
    }
}