#!/usr/bin/env bash
# ============================================================
# Docker 镜像构建脚本
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# ---- 默认值 ----
TAG="${TAG:-latest}"
REGISTRY="${REGISTRY:-}"
PUSH=false
SERVICE="${SERVICE:-all}"

# ---- 帮助 ----
usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --tag TAG         镜像标签 (默认: latest)
  --registry URL    容器仓库地址 (如: ghcr.io/myorg)
  --push            构建后推送镜像到仓库
  --service NAME    指定构建服务: backend | frontend | all (默认: all)
  -h, --help        显示帮助

Examples:
  $0                                          # 构建全部，标签 latest
  $0 --tag v1.2.3                             # 构建全部，标签 v1.2.3
  $0 --service backend --tag dev              # 仅构建 backend
  $0 --registry ghcr.io/myorg --tag v1.0 --push  # 构建并推送

Environment:
  TAG              镜像标签
  REGISTRY         仓库地址
EOF
  exit 0
}

# ---- 参数解析 ----
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)       TAG="$2";      shift 2 ;;
    --registry)  REGISTRY="$2";  shift 2 ;;
    --push)      PUSH=true;     shift ;;
    --service)   SERVICE="$2";  shift 2 ;;
    -h|--help)   usage ;;
    *)           echo "❌ Unknown option: $1"; usage ;;
  esac
done

# ---- 构建函数 ----
build_image() {
  local name="$1"
  local dockerfile="$2"
  local image

  if [[ -n "$REGISTRY" ]]; then
    image="${REGISTRY}/${name}:${TAG}"
  else
    image="${name}:${TAG}"
  fi

  echo ""
  echo "=============================================="
  echo " Building: ${image}"
  echo " Dockerfile: ${dockerfile}"
  echo "=============================================="

  docker build -f "$dockerfile" -t "$image" .

  if $PUSH; then
    if [[ -z "$REGISTRY" ]]; then
      echo "❌ --push requires --registry to be set"
      exit 1
    fi
    echo " Pushing: ${image}..."
    docker push "$image"
  fi

  echo "✅ ${image} done"
}

# ---- 执行 ----
case "$SERVICE" in
  backend)
    build_image "portal-backend" "apps/portal-backend/Dockerfile"
    ;;
  frontend)
    build_image "portal-frontend" "apps/portal-frontend/Dockerfile"
    ;;
  all)
    build_image "portal-backend" "apps/portal-backend/Dockerfile"
    build_image "portal-frontend" "apps/portal-frontend/Dockerfile"
    ;;
  *)
    echo "❌ Unknown service: $SERVICE (use: backend | frontend | all)"
    exit 1
    ;;
esac

echo ""
echo "🎉 All builds complete!"