package com.baez.baezpos.user.repository;

import com.baez.baezpos.user.entity.Role;
import com.baez.baezpos.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    @Query("SELECT u FROM User u LEFT JOIN FETCH u.company WHERE u.email = :email")
    Optional<User> findByEmail(@Param("email") String email);

    boolean existsByEmail(String email);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.password = :password, u.passwordResetAt = :resetAt, u.updatedAt = :now, u.version = COALESCE(u.version, 0) + 1 WHERE u.id = :id")
    int updatePasswordAndResetAt(@Param("id") Long id, @Param("password") String password, @Param("resetAt") LocalDateTime resetAt, @Param("now") LocalDateTime now);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.passwordResetAt = NULL, u.updatedAt = :now WHERE u.id = :id")
    int clearPasswordResetAt(@Param("id") Long id, @Param("now") LocalDateTime now);

    // ==========================================
    // BÚSQUEDAS FILTRADAS POR BAJA LÓGICA (active = true)
    // ==========================================
    List<User> findByCompanyIdAndActiveTrue(Long companyId);

    org.springframework.data.domain.Page<User> findByCompanyIdAndActiveTrue(Long companyId, org.springframework.data.domain.Pageable pageable);

    long countByCompanyIdAndActiveTrue(Long companyId);

    List<User> findByActiveTrue();

    org.springframework.data.domain.Page<User> findByActiveTrue(org.springframework.data.domain.Pageable pageable);

    Optional<User> findByIdAndCompanyIdAndActiveTrue(Long id, Long companyId);

    List<User> findByCompanyIdAndRoleAndActiveTrue(Long companyId, Role role);

    // ==========================================
    // MÉTODOS MANTENIDOS PARA COMPATIBILIDAD CON OTROS MÓDULOS
    // ==========================================
    List<User> findByCompanyIdAndRole(Long companyId, Role role); // <--- RESTAURADO PARA SOLUCIONAR EL ERROR DE COMPILACIÓN

    List<User> findByCompanyId(Long companyId);

    Optional<User> findByIdAndCompanyId(Long id, Long companyId);
}