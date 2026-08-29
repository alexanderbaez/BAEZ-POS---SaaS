package com.baez.baezpos.user.service.UserService;

import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;
import java.util.List;

public interface UserService {
    UserResponseDTO createUser(UserRequestDTO dto);
    UserResponseDTO getUserById(Long id);
    List<UserResponseDTO> getAllUsers();
    UserResponseDTO updateUser(Long id, UserRequestDTO dto);
    void deleteUser(Long id);
    void updatePasswordOnly(String email, String newPassword);
    boolean validatePin(String pin);
    boolean validateSupervisorPin(String requestPin);
}