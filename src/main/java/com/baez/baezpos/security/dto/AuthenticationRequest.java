package com.baez.baezpos.security.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthenticationRequest {

    @Email(message = "Formato de email inv\u00E1lido")
    @NotBlank(message = "El email es obligatorio")
    private String email;

    @NotBlank(message = "La contrase\u00F1a es obligatoria")
    private String password;
}