# syntax=docker/dockerfile:1
# Multi-stage: build da SPA com Node, serve estática com nginx.

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Instala deps com lockfile determinístico (camada cacheável)
COPY package.json package-lock.json ./
RUN npm ci

# Código + build. VITE_API_URL é embutido em tempo de build (default /api).
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS serve
LABEL org.opencontainers.image.title="nba-scout-frontend" \
      org.opencontainers.image.description="NBA Scout — SPA Vite servida por nginx (proxy /api)" \
      org.opencontainers.image.source="https://github.com/Nba-Scout/AnalyzerNBAscouts" \
      org.opencontainers.image.licenses="MIT"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
