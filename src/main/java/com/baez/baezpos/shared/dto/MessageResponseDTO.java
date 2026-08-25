package com.baez.baezpos.shared.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageResponseDTO {
    private String message;

    public static MessageResponseDTO of(String message) {
        return new MessageResponseDTO(message);
    }
}
