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

    @Query("SELECT l FROM SystemLog l LEFT JOIN FETCH l.company WHERE l.company.id = :companyId ORDER BY l.timestamp DESC")
    List<SystemLog> findByCompanyIdOrderByTimestampDesc(@Param("companyId") Long companyId, Pageable pageable);

    @Query("SELECT l FROM SystemLog l LEFT JOIN FETCH l.company WHERE (:companyId IS NULL OR l.company.id = :companyId) ORDER BY l.timestamp DESC")
    List<SystemLog> findLogsForSuperAdmin(@Param("companyId") Long companyId, Pageable pageable);
}