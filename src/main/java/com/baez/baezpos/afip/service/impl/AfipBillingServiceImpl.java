package com.baez.baezpos.afip.service.impl;

import com.baez.baezpos.afip.service.AfipBillingService;
import com.baez.baezpos.company.entity.Company;
import com.baez.baezpos.sale.entity.Sale;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
@Slf4j
public class AfipBillingServiceImpl implements AfipBillingService {

    @Override
    public void processFiscalSale(Sale sale, Company company) {
        if (sale == null || company == null) {
            return;
        }

        String env = company.getAfipEnvironment() != null ? company.getAfipEnvironment().toUpperCase().trim() : "HOMO";
        Integer posNumber = company.getPosNumber() != null ? company.getPosNumber() : 1;

        log.info("[AFIP WSFEv1] Procesando comprobante fiscal electrónico para empresa '{}' (CUIT: {}) en entorno: {}", 
                company.getName(), company.getCuit(), env);

        // Determinación del tipo de comprobante según condición IVA
        String condicionIva = company.getCondicionIva() != null ? company.getCondicionIva().toUpperCase() : "MONOTRIBUTO";
        String tipoComprobante = condicionIva.contains("RESPONSABLE INSCRIPTO") ? "FACTURA B" : "FACTURA C";

        // Secuencia fiscal correlativa
        Long nextFiscalNumber = (company.getLastTicketNumber() != null ? company.getLastTicketNumber() : 0L) + 1L;
        company.setLastTicketNumber(nextFiscalNumber);
        String invoiceNumber = String.format("%04d-%08d", posNumber, nextFiscalNumber);

        // Generación de CAE simulado de 14 dígitos numéricos para entorno HOMO
        long randomCaeNumber = ThreadLocalRandom.current().nextLong(10000000000000L, 99999999999999L);
        String simulatedCae = String.valueOf(randomCaeNumber);
        LocalDate expiration = LocalDate.now().plusDays(10);

        sale.setCae(simulatedCae);
        sale.setCaeExpiration(expiration);
        sale.setCaeVto(expiration.toString());
        sale.setInvoiceType(tipoComprobante);
        sale.setTipoComprobante(tipoComprobante);
        sale.setInvoiceNumber(invoiceNumber);
        sale.setNroComprobante(invoiceNumber);

        log.info("[AFIP Mock] CAE generado exitosamente: {} | Vencimiento: {} | Comprobante: {} Nº {}", 
                simulatedCae, expiration, tipoComprobante, invoiceNumber);
    }
}
