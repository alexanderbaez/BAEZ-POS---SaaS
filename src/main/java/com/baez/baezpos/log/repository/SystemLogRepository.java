package com.baez.baezpos.log.repository;

import com.baez.baezpos.log.entity.SystemLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SystemLogRepository extends JpaRepository<SystemLog, Long> {

    // Obtiene los últimos 100 movimientos acotados por la empresa en sesión (Tenant)
    List<SystemLog> findTop100ByCompanyIdOrderByTimestampDesc(Long companyId);

    // Obtiene los últimos 100 logs globales de todo el sistema (Para el SUPER_ADMIN)
    List<SystemLog> findTop100ByOrderByTimestampDesc();
}