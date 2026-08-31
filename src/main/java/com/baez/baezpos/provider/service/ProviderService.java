package com.baez.baezpos.provider.service;

import com.baez.baezpos.provider.dto.ProviderPaymentRequestDTO;
import com.baez.baezpos.provider.dto.ProviderRequestDTO;
import com.baez.baezpos.provider.dto.ProviderResponseDTO;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface ProviderService {

    List<ProviderResponseDTO> getAll();

    Page<ProviderResponseDTO> getAll(Pageable pageable);

    ProviderResponseDTO getById(Long id);

    List<ProviderResponseDTO> search(String query);

    Page<ProviderResponseDTO> search(String query, Pageable pageable);

    ProviderResponseDTO create(ProviderRequestDTO dto);

    ProviderResponseDTO update(Long id, ProviderRequestDTO dto);

    void delete(Long id);

    ProviderResponseDTO pay(Long id, ProviderPaymentRequestDTO dto);
}
