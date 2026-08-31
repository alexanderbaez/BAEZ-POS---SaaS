package com.baez.baezpos.user.service.UserService;

import com.baez.baezpos.user.dto.UserRequestDTO;
import com.baez.baezpos.user.dto.UserResponseDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface UserService {
    UserResponseDTO createUser(UserRequestDTO dto);
    UserResponseDTO getUserById(Long id);
    List<UserResponseDTO> getAllUsers();
    Page<UserResponseDTO> getAllUsers(Pageable pageable);
    UserResponseDTO updateUser(Long id, UserRequestDTO dto);
    void deleteUser(Long id);
    void updatePasswordOnly(String email, String newPassword);
    boolean validatePin(String pin);
    String validateSupervisorPin(String requestPin);
}