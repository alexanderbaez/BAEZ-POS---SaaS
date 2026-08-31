package com.baez.baezpos.user.dto;

import com.baez.baezpos.user.entity.Role;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserRequestDTO {
    @NotBlank(message = "El nombre es obligatorio")
    private String name;

    @Email(message = "Debe ser un email vÃ¡lido")
    @NotBlank(message = "El email es obligatorio")
    private String email;

    private String password; // Opcional en actualizaciones

    private Role role;

    private String securityPin; // PIN numÃ©rico opcional (4-6 dÃ­gitos)
}