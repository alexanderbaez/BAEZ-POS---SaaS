package com.baez.baezpos.log.repository;

import com.baez.baezpos.log.entity.SystemLog;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SystemLogRepository extends JpaRepository<SystemLog, Long> {

    // Obtiene logs por empresa con límite mediante Pageable
    List<SystemLog> findByCompanyIdOrderByTimestampDesc(Long companyId, Pageable pageable);

    // Obtiene logs globales
    List<SystemLog> findByOrderByTimestampDesc(Pageable pageable);

    // Permite al Super Admin filtrar explícitamente por una empresa
    @Query("SELECT l FROM SystemLog l WHERE (:companyId IS NULL OR l.company.id = :companyId) ORDER BY l.timestamp DESC")
    List<SystemLog> findLogsForSuperAdmin(@Param("companyId") Long companyId, Pageable pageable);
}