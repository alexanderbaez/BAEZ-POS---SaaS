package com.baez.baezpos.afip.service;

import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.sale.entity.Sale;

public interface AfipBillingService {
    void processFiscalSale(Sale sale, Company company);
}
