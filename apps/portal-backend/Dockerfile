# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: Build — 安装所有依赖并编译 NestJS
# ============================================================
FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

# 先复制 workspace 根配置，利用 Docker layer cache
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/portal-backend/package.json apps/portal-backend/

RUN pnpm install --frozen-lockfile

# 复制后端源码并构建
COPY apps/portal-backend apps/portal-backend/
RUN pnpm --filter portal-backend build

# ============================================================
# Stage 2: Production — 仅安装生产依赖 + 运行
# ============================================================
FROM node:22-alpine AS production

RUN corepack enable && corepack prepare pnpm@10.14.0 --activate

WORKDIR /app

# 复制 workspace 配置和后端 package.json
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json /app/.npmrc ./
COPY --from=build /app/apps/portal-backend/package.json apps/portal-backend/

# 只安装生产依赖
RUN pnpm install --frozen-lockfile --filter portal-backend --prod

# 复制构建产物
COPY --from=build /app/apps/portal-backend/dist apps/portal-backend/dist/

# 安全：非 root 运行
RUN addgroup -S app && adduser -S app -G app
USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "apps/portal-backend/dist/main"]