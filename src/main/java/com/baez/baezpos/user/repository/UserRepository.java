package com.baez.baezpos.user.repository;

import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.company WHERE u.email = :email")
    Optional<User> findByEmail(@Param("email") String email);

    boolean existsByEmail(String email);

    // ==========================================
    // BÚSQUEDAS FILTRADAS POR BAJA LÓGICA (active = true)
    // ==========================================
    List<User> findByCompanyIdAndActiveTrue(Long companyId);

    List<User> findByActiveTrue();

    Optional<User> findByIdAndCompanyIdAndActiveTrue(Long id, Long companyId);

    List<User> findByCompanyIdAndRoleAndActiveTrue(Long companyId, Role role);

    // ==========================================
    // MÉTODOS MANTENIDOS PARA COMPATIBILIDAD CON OTROS MÓDULOS
    // ==========================================
    List<User> findByCompanyIdAndRole(Long companyId, Role role); // <--- RESTAURADO PARA SOLUCIONAR EL ERROR DE COMPILACIÓN

    List<User> findByCompanyId(Long companyId);

    Optional<User> findByIdAndCompanyId(Long id, Long companyId);
}