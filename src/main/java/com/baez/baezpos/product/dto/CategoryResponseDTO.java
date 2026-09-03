package com.baez.baezpos.product.dto;

public record CategoryResponseDTO(
        Long id,
        String name,
        String description,
        Boolean active
) {
    public CategoryResponseDTO(Long id, String name, String description) {
        this(id, name, description, true);
    }
}