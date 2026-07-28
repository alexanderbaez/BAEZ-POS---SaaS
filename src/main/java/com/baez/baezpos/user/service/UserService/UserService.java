package com.baez.baezpos.user.service.UserService;

import com.baez.baezpos.user.dto.UserResponseDTO;
import com.baez.baezpos.user.entity.User;
import java.util.List;

public interface UserService { // <-- Verificá que NO diga "extends UserDetailsService"
    UserResponseDTO createUser(User user);
    UserResponseDTO getUserById(Long id);
    List<UserResponseDTO> getAllUsers();
    UserResponseDTO updateUser(Long id, User user);
    void deleteUser(Long id);
    void updatePasswordOnly(String email, String newPassword);
}