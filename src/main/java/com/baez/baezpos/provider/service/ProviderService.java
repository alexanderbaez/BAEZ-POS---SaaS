package com.baez.baezpos.provider.service;

import com.baez.baezpos.provider.dto.ProviderPaymentRequestDTO;
import com.baez.baezpos.provider.dto.ProviderRequestDTO;
import com.baez.baezpos.provider.dto.ProviderResponseDTO;

import java.util.List;

public interface ProviderService {

    List<ProviderResponseDTO> getAll();

    ProviderResponseDTO getById(Long id);

    List<ProviderResponseDTO> search(String query);

    ProviderResponseDTO create(ProviderRequestDTO dto);

    ProviderResponseDTO update(Long id, ProviderRequestDTO dto);

    void delete(Long id);

    ProviderResponseDTO pay(Long id, ProviderPaymentRequestDTO dto);
}
