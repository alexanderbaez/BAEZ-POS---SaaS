package com.baez.baezpos.sale.service.SaleService;

import com.baez.baezpos.sale.dto.CashSessionResponseDTO;
import com.baez.baezpos.sale.dto.CloseCashSessionRequestDTO;
import com.baez.baezpos.sale.dto.OpenCashSessionRequestDTO;

import java.math.BigDecimal;

public interface CashRegisterService {
    CashSessionResponseDTO openSession(OpenCashSessionRequestDTO requestDTO);
    CashSessionResponseDTO closeSession(CloseCashSessionRequestDTO requestDTO);
    CashSessionResponseDTO getActiveSession();
    BigDecimal getActivePhysicalCashBalance(Long companyId);
    void validatePhysicalCashAvailability(Long companyId, BigDecimal amountToDeduct);
}