package com.baez.baezpos.log.repository;

import com.baez.baezpos.log.entity.SystemLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SystemLogRepository extends JpaRepository<SystemLog, Long> {

    // Obtiene los últimos 100 movimientos acotados por la empresa en sesión
    List<SystemLog> findTop100ByCompanyIdOrderByTimestampDesc(Long companyId);
}