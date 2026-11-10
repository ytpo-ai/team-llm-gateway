# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: Build — 安装依赖并执行 Vite 构建
# ============================================================
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

# 先复制 workspace 根配置，利用 Docker layer cache
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/portal-frontend/package.json apps/portal-frontend/

RUN pnpm install --frozen-lockfile

# 复制前端源码并构建
COPY apps/portal-frontend apps/portal-frontend/
RUN pnpm --filter portal-frontend build

# ============================================================
# Stage 2: Production — Nginx 静态文件服务
# ============================================================
FROM nginx:alpine AS production

# 复制构建产物
COPY --from=build /app/apps/portal-frontend/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY apps/portal-frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1