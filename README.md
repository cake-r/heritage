# 非遗数字交互与文创生成系统

## 项目简介
基于多模态大模型的非遗数字交互与文创生成系统，融合CV、NLP、AIGC技术，面向非遗文化数字化传承场景。

## 技术栈
- **后端**: FastAPI + SQLAlchemy + SQLite + JWT
- **前端**: React 18 + TypeScript + Vite + Ant Design + TailwindCSS
- **AI**: Qwen-VL-Max / DeepSeek-V3 / 通义万相2.1 / CosyVoice 3
- **部署**: Docker + Nginx + 阿里云ECS

## 快速开始

### 环境要求
- Python 3.11+
- Node.js 20+
- Docker Desktop

### 本地开发

```bash
# 后端
cd backend
cp .env.example .env  # 编辑.env填入API Key
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

### Docker 一键启动

```bash
docker compose up -d
```

访问 http://localhost:3000

## 项目结构

```
project/
├── backend/          # FastAPI 后端
├── frontend/         # React 前端
├── deploy/           # 部署配置
└── docs/             # 文档
```

## 许可证
MIT
