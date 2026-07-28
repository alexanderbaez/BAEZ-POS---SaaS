package com.baez.baezpos;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.io.IOException;

@SpringBootApplication
@EnableJpaAuditing
@EnableAsync
public class BaezposApplication {

	public static void main(String[] args) {
		SpringApplication.run(BaezposApplication.class, args);
		System.out.println("==========================================");
		System.out.println("BÁEZ POS SaaS Multi-Tenant iniciado correctamente.");
		System.out.println("==========================================");
	}
}