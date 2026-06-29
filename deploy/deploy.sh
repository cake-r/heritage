#!/bin/bash
# 云端部署脚本 — 阿里云ECS
set -e

echo "=== 非遗文创系统 云端部署 ==="

# 检查环境变量
if [ ! -f ../backend/.env ]; then
    echo "错误: backend/.env 不存在, 请先创建并配置API Key"
    echo "  cp backend/.env.example backend/.env"
    echo "  然后编辑 backend/.env 填入真实的 API Key"
    exit 1
fi

# 拉取/更新代码
git pull origin main 2>/dev/null || echo "跳过git pull"

# 拷贝 nginx 配置到前端构建目录 (Docker build context 内)
echo "准备 nginx 配置..."
cp deploy/nginx.conf frontend/nginx.conf

# 构建并启动 (云端模式: 基础 compose + cloud 覆盖)
docker compose -f docker-compose.yml -f docker-compose.cloud.yml up -d --build

# 清理临时文件
rm -f frontend/nginx.conf

echo ""
echo "部署完成! 检查容器状态:"
docker compose ps
