# ==========================================
# ETAPA 1: Compilación y Cache de Dependencias
# ==========================================
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Copiar archivos de configuración de Maven y wrapper
COPY pom.xml mvnw ./
COPY .mvn .mvn

# Descargar dependencias en modo offline para aprovechar el cache de capas
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Copiar código fuente y compilar el JAR ejecutable
COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# ==========================================
# ETAPA 2: Runtime Seguro y Liviano
# ==========================================
FROM eclipse-temurin:21-jre-alpine AS runner

WORKDIR /app

# Crear usuario y grupo sin privilegios por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar artefacto final desde la etapa de compilación
COPY --from=builder --chown=appuser:appgroup /app/target/*.jar app.jar

# Ejecutar con el usuario no privilegiado
USER appuser

EXPOSE 8080

# Flags de JVM optimizados para contenedores y límites de memoria
ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]