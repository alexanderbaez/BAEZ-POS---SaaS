package com.baez.baezpos.sale.controller;

import com.baez.baezpos.sale.dto.BoxReportDTO;
import com.baez.baezpos.sale.dto.ChartDataDTO;
import com.baez.baezpos.sale.dto.SaleRequestDTO;
import com.baez.baezpos.sale.dto.SaleResponseDTO;
import com.baez.baezpos.sale.service.SaleService;
import com.baez.baezpos.security.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sales")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SaleController {

    private final SaleService saleService;

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<SaleResponseDTO> create(@Valid @RequestBody SaleRequestDTO saleDTO) {
        Long userId = SecurityUtils.getCurrentUserId();
        return ResponseEntity.status(HttpStatus.CREATED).body(saleService.createSale(saleDTO, userId));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<List<SaleResponseDTO>> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        if (desde == null) desde = LocalDate.now();
        if (hasta == null) hasta = LocalDate.now();
        return ResponseEntity.ok(saleService.getSalesByDateRange(desde, hasta));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'VENDEDOR', 'SUPER_ADMIN')")
    public ResponseEntity<SaleResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(saleService.getSaleById(id));
    }

    @GetMapping("/report/box")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<BoxReportDTO> getBoxReport(
            @RequestParam(required = false, defaultValue = "hoy") String period,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        LocalDate desde = (from != null) ? from : startDate;
        LocalDate hasta = (to != null) ? to : endDate;
        return ResponseEntity.ok(saleService.getBoxReport(period, desde, hasta));
    }

    @GetMapping("/report/chart")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<List<ChartDataDTO>> getSalesChartData() {
        return ResponseEntity.ok(saleService.getSalesChartData());
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<Void> cancelSale(@PathVariable Long id) {
        saleService.cancelSale(id);
        return ResponseEntity.noContent().build();
    }
}