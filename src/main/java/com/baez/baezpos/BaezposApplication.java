package com.baez.baezpos;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.TimeZone;
import java.util.concurrent.Executor;

@SpringBootApplication
@EnableJpaAuditing
@EnableAsync
public class BaezposApplication {

	@PostConstruct
	public void init() {
		TimeZone.setDefault(TimeZone.getTimeZone("America/Argentina/Buenos_Aires"));
	}

	public static void main(String[] args) {
		SpringApplication.run(BaezposApplication.class, args);
		System.out.println("==========================================");
		System.out.println("BAEZ POS SaaS Multi-Tenant iniciado correctamente.");
		System.out.println("==========================================");
	}

	/**
	 * Pool de hilos asíncronos optimizado para Render Free Tier (1 vCPU / 512MB).
	 * Core=1 hilo (mínimo), Max=2 (pico), Queue=50 tareas encoladas.
	 * Previene OOM y thread starvation en entornos de recursos estrictos.
	 */
	@Bean(name = "taskExecutor")
	public Executor taskExecutor() {
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(1);
		executor.setMaxPoolSize(2);
		executor.setQueueCapacity(50);
		executor.setThreadNamePrefix("AsyncWorker-");
		executor.setWaitForTasksToCompleteOnShutdown(true);
		executor.setAwaitTerminationSeconds(15);
		executor.initialize();
		return executor;
	}

	/**
	 * RestTemplate reutilizable con timeouts de conexión explícitos.
	 * Evita instanciar un RestTemplate nuevo por cada correo enviado.
	 */
	@Bean
	public RestTemplate restTemplate(RestTemplateBuilder builder) {
		return builder
				.connectTimeout(Duration.ofSeconds(10))
				.readTimeout(Duration.ofSeconds(15))
				.build();
	}
}
