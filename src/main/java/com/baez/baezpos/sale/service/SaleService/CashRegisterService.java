package com.baez.baezpos.sale.service.SaleService;

import com.baez.baezpos.sale.dto.CashSessionResponseDTO;
import com.baez.baezpos.sale.dto.CloseCashSessionRequestDTO;
import com.baez.baezpos.sale.dto.OpenCashSessionRequestDTO;

public interface CashRegisterService {
    CashSessionResponseDTO openSession(OpenCashSessionRequestDTO requestDTO);
    CashSessionResponseDTO closeSession(CloseCashSessionRequestDTO requestDTO);
    CashSessionResponseDTO getActiveSession();
}