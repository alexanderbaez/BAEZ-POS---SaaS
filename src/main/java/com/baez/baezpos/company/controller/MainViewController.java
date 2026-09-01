package com.baez.baezpos.company.controller;

import com.baez.baezpos.company.repository.CompanyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@RequiredArgsConstructor
public class MainViewController {

    private final CompanyRepository companyRepository;

    @GetMapping("/")
    public String index() {
        // Redirigimos siempre a login, el frontend (login.js) decidirá si nos manda a setup.html
        return "redirect:/login.html";
    }

    @GetMapping("/login")
    public String showLogin() {
        return "redirect:/login.html";
    }

    @GetMapping("/admin-maestro")
    public String showAdmin() {
        return "redirect:/admin-maestro.html";
    }
}