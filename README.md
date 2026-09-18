<div align="center">

# 文博灵境

**非遗数字交互与文创生成系统**

基于多模态大模型的非物质文化遗产数字化平台
集「识别 · 学习 · 创作 · 对话 · 浏览」于一体的沉浸式非遗文化体验

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## 目录

- [项目简介](#项目简介)
- [界面预览](#界面预览)
- [功能特性](#功能特性)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [环境变量说明](#环境变量说明)
- [项目结构](#项目结构)
- [核心 API](#核心-api)
- [测试](#测试)
- [部署](#部署)
- [设计规范](#设计规范)
- [常见问题](#常见问题)
- [许可证](#许可证)

---

## 项目简介

**文博灵境** 是一个面向非物质文化遗产（非遗）数字化传承场景的综合平台。系统融合计算机视觉（CV）、自然语言处理（NLP）与 AIGC 技术，通过多模态大模型为非遗文化提供从「**识别**」到「**创作**」的全链路数字化服务。

平台面向三类核心场景：

| 场景 | 说明 |
|------|------|
| **文化认知** | 上传非遗图片即可获得 AI 讲解、纹样解析与文化图谱定位 |
| **数字创作** | 基于 20 种非遗风格的文生图 / 图生图文创生成，支持纹样基因重组 |
| **文物修复** | 五步 AI 修复流水线，含损伤分析、轮廓提取、RAG 提示词生成与修复核验 |

同时引入**游戏化修习体系**、**数字护照**与 **Live2D 智能伴游**，提升非遗学习的沉浸感与持续参与度。

---

## 界面预览

<div align="center">

**首页** — 国风 Hero 区 · 实时统计 · 热门藏品推荐

<img src="docs/screenshots/home.jpg" width="820" alt="首页" />

**数字展厅** — 56 件非遗藏品，支持品类 / 地区 / 年代多维筛选

<img src="docs/screenshots/exhibition.jpg" width="820" alt="数字展厅" />

**文化图谱** — 旭日图 / 时间线 / 地理热力图三视图联动

<img src="docs/screenshots/knowledge-graph.jpg" width="820" alt="文化图谱" />

</div>

---

## 功能特性

### 🎨 智能识别与文化解析

- **AI 图像识别** — 基于 Qwen-VL-Max 识别上传的非遗物品，输出品类、年代、地域与工艺解读
- **纹样基因引擎** — 上传纹样 → 视觉识别 → 模糊匹配 85 条纹样基因库 → 拖拽式重组设计 → Canvas 导出
- **知识图谱** — ECharts 时间线 / 旭日图 / 地理热力图三视图，7 个聚合历史分期，支持四维引导搜索
- **技艺亲缘关系图** — 桑基图呈现「品类 → 技艺 → 地域」三列流向关系

### 🖌️ 文创生成与画廊

- **双模式生成** — 文生图（T2I）与图生图（I2I），基于通义万相
- **丰富风格库** — 20 种非遗风格 × 11 种配色方案 × 10 种构图模板 + 元素自定义
- **作品画廊** — 风格/模式筛选、搜索、排序、视图切换、详情抽屉、下载/分享/发布管理

### 🔧 文物修复

- **五步修复流水线** — 损伤分析 → OpenCV 轮廓提取 → DeepSeek + RAG 修复提示词 → 万相 I2I 修复 → VL 模型核验（单步失败即终止）
- **修复工作台** — 裁剪局部重绘 + OpenCV 无缝融合，支持人机协同修复
- **全局对比** — 修复前后等比对照展示

### 🧭 个性化体验

- **AI 伴游「灵儿」** — Live2D 虚拟形象，结合用户旅程与语义检索的个性化导游，支持拖拽/缩放/全屏视线跟随与 5 种表情
- **个性化推荐引擎** — 19 维偏好向量，冷启动按热度 → 积累交互后个性化；推荐语预生成，请求零 LLM 调用
- **修习体系** — 5 级段位、6 大技能树、18 种自动校验任务、连胜激励
- **数字护照** — 20+ 种印章、地域热力图、时间轴与导出

### 🎭 其他

- **传承人对话（Workshop）** — 与非遗传承人角色 SSE 流式对话，支持自定义传承人
- **Story Mode** — 8 步非遗故事自动演示，SSE 实时推送
- **Agent 子系统** — 执行追踪 + 推理路径可视化（ECharts 树图，诚实标注 AI 来源）+ Prompt 版本管理
- **全局搜索** — `Ctrl/⌘ + K` 命令面板，跨藏品/传承人/上传内容检索
- **通知中心** — 修习任务完成、段位晋升、新地域解锁自动推送，localStorage 持久化

---

## 系统架构

```
┌──────────────────────────────────────────────────────────┐
│                     浏览器 (React SPA)                     │
└───────────────────────────┬──────────────────────────────┘
                            │ HTTP / SSE / WebSocket
┌───────────────────────────▼──────────────────────────────┐
│         Nginx — 静态资源 · 反向代理 · WebSocket 升级         │
└───────────────────────────┬──────────────────────────────┘
                            │
┌───────────────────────────▼──────────────────────────────┐
│                    FastAPI 主服务 (:8000)                  │
│   ┌─────────────┬──────────────┬──────────────────────┐  │
│   │  Auth (JWT) │  REST API    │  SSE 流式聊天         │  │
│   │             │  30+ 路由模块 │  任务 WebSocket       │  │
│   └─────────────┴──────────────┴──────────────────────┘  │
└──────┬────────────────────────────────────┬──────────────┘
       │                                    │
┌──────▼──────────────┐          ┌──────────▼──────────────┐
│  Redis              │          │  外部 AI 服务            │
│  限流 · 缓存 · 会话   │          │  · 阿里云 DashScope      │
│  RQ 任务队列         │          │    (Qwen-VL / 万相 / TTS)│
│  ※ 不可用时降级 SQLite│          │  · DeepSeek             │
└──────┬──────────────┘          └─────────────────────────┘
       │
┌──────▼──────────────┐
│   RQ Worker          │  ← AI 长耗时任务 + DB 写入解耦
│   （重型异步任务）     │
└──────┬──────────────┘
       │
┌──────▼──────────────────────────────────────────────────┐
│  开发: SQLite (WAL 模式)                                  │
│  生产: PostgreSQL 16 + pgvector (向量检索)                │
└─────────────────────────────────────────────────────────┘
```

**关键设计**：

- **服务解耦** — API 层仅处理请求/响应，AI 长耗时任务与 DB 写入交由独立 RQ Worker
- **分级异步** — `enqueue_write`（串行队列，解决 SQLite 锁竞争）/ `run_in_thread`（并发轻任务）/ `submit_task`（持久化 RQ 队列，失败重试 + 崩溃恢复）
- **优雅降级** — Redis 不可用时自动降级到 SQLite，保证开发环境零依赖启动
- **双数据库** — 开发用 SQLite（零配置），生产切 PostgreSQL（pgvector 向量检索）

---

## 技术栈

### 后端

| 类别 | 技术 |
|------|------|
| 框架 | FastAPI 0.115 + Uvicorn |
| ORM | SQLAlchemy 2.0（同步） |
| 数据库 | SQLite（开发，WAL）/ PostgreSQL 16 + pgvector（生产） |
| 缓存/队列 | Redis 5 + RQ 2 |
| 认证 | JWT（python-jose）+ bcrypt（passlib） |
| 图像处理 | OpenCV 4.10 + Pillow |
| 测试 | pytest 8.3 |
| 迁移 | Alembic + 自研轻量迁移 |

### 前端

| 类别 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript 6 |
| 构建 | Vite 8 |
| UI | Ant Design 6 + TailwindCSS 3 |
| 图标 | lucide-react（全项目统一，零 emoji） |
| 状态 | Zustand 5（5 个 Store）+ Context |
| 动画 | framer-motion + CSS @keyframes |
| 图表 | ECharts 6 + echarts-for-react |
| 其他 | fabric（Canvas）、html2canvas、react-easy-crop、@dnd-kit、react-virtuoso、react-markdown |
| 虚拟形象 | pixi.js 7 + pixi-live2d-display |

### AI 模型

| 平台 | 模型 | 用途 |
|------|------|------|
| 阿里云 DashScope | `qwen-vl-max` | 图像识别、纹样检测、修复核验 |
| 阿里云 DashScope | `wanx2.1-t2i-plus` | 文生图 |
| 阿里云 DashScope | `wan2.5-i2i-preview` | 图像修复（异步轮询） |
| 阿里云 DashScope | `cosyvoice-v1` | 语音合成 |
| DeepSeek | `deepseek-chat` | 对话、故事、推荐、工具调用 |
| DeepSeek | `deepseek-embedding` | 知识库向量检索 |

---

## 快速开始

### 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Python | 3.11+（推荐 3.12） | 后端运行时 |
| Node.js | 20+（推荐 22/24） | 前端构建 |
| Docker | 可选 | 一键部署方案 |

> **本项目开发环境实测**：Python 3.12.0 + Node.js 24.12.0

### 方式一：本地开发（推荐）

**1. 克隆仓库**

```bash
git clone https://github.com/cake-r/heritage.git
cd heritage
```

**2. 启动后端**

```bash
cd backend

# 创建虚拟环境（可选但推荐）
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY 与 DEEPSEEK_API_KEY

# 启动服务
uvicorn app.main:app --reload --port 8000
```

> ⚠️ **必须在 `backend/` 目录下执行启动命令**，否则 SQLite 相对路径会异常。
> ⚠️ `.env` 修改后**必须重启服务**，配置无热更新。

后端启动后：

- API 服务：http://localhost:8000
- 交互式文档：http://localhost:8000/api/docs （Swagger UI）
- 首次启动会自动建表并导入种子数据（85 条纹样基因 + 50 条非遗知识 + 展品数据）

**3. 启动前端**

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173 即可。

> 前端 `/api` 与 `/static` 请求均通过 Vite proxy 转发至 `localhost:8000`（见 `vite.config.ts`），无需额外配置 CORS。

### 方式二：Docker 一键启动

```bash
cd deploy
docker compose up -d
```

启动后访问 http://localhost:3000

该方案会同时拉起 PostgreSQL、Redis、后端 API、RQ Worker 与 Nginx 前端。

### Mock 模式（离线演示）

无需任何 API Key 即可完整跑通业务流程：

```bash
cd backend
MOCK_MODE=true uvicorn app.main:app --reload --port 8000
```

`MOCK_MODE=true` 时读取 `data/mock/` 下的本地 JSON，跳过所有外部 AI 调用与 DB 写入队列，适合答辩演示与离线开发。

---

## 环境变量说明

在 `backend/.env` 中配置（参考 `backend/.env.example`）：

| 变量 | 必填 | 默认值 | 说明 |
|------|:----:|--------|------|
| `DASHSCOPE_API_KEY` | ✅ | — | 阿里云百炼 Key（Qwen / 万相 / CosyVoice） |
| `DEEPSEEK_API_KEY` | ✅ | — | DeepSeek Key（对话 / 故事 / 推荐 / 向量） |
| `DEEPSEEK_BASE_URL` | | `https://api.deepseek.com` | DeepSeek API 地址 |
| `SECRET_KEY` | ✅ | `change-me-...` | JWT 签名密钥，**生产必须修改** |
| `ALGORITHM` | | `HS256` | JWT 算法 |
| `ACCESS_TOKEN_EXPIRE_HOURS` | | `24` | Token 有效期（小时） |
| `DATABASE_URL` | | `sqlite:///./data/database.sqlite` | 数据库连接串 |
| `REDIS_URL` | | — | Redis 连接串，留空则降级 SQLite |
| `MOCK_MODE` | | `false` | 模拟模式开关 |
| `DEPLOY_ENV` | | `local` | `local` / `cloud`（cloud 关闭 API 文档） |
| `CORS_ORIGINS` | | `http://localhost:5173,...` | 允许的跨域来源（逗号分隔） |
| `EXHIBITION_ADMIN_PASSWORD` | | `123456` | 展厅管理密码，**生产必须修改** |
| `MAX_UPLOAD_SIZE_MB` | | `10` | 上传文件大小上限 |
| `UPLOAD_DIR` | | `./data/uploads` | 上传文件存储目录 |

> 服务启动时会检测 `SECRET_KEY` 与 `EXHIBITION_ADMIN_PASSWORD` 是否为默认值，若是则输出安全警告（不阻塞启动）。

---

## 项目结构

```
project/
├── backend/                      # FastAPI 后端
│   ├── app/
│   │   ├── api/                  # 31 个路由模块（auth / recognition / generation ...）
│   │   ├── models/               # 24 张数据表模型
│   │   ├── schemas/              # Pydantic 请求/响应模型
│   │   ├── services/             # 业务逻辑层
│   │   │   ├── ai/               # AI 服务（recommendation / image_gen / restoration_pipeline）
│   │   │   ├── agent/            # Agent 子系统（执行追踪 / 推理可视化）
│   │   │   ├── passport_service.py
│   │   │   ├── cultivation_service.py
│   │   │   ├── task_handlers.py  # RQ 任务处理器
│   │   │   └── task_scheduler.py
│   │   ├── utils/                # 工具函数
│   │   ├── config.py             # 配置加载
│   │   └── main.py               # 应用入口 + 路由注册
│   ├── data/                     # SQLite / 上传文件 / Mock 数据
│   ├── tests/                    # 11 个测试文件 · 74 个测试用例
│   ├── scripts/                  # 迁移与运维脚本
│   ├── alembic/                  # 数据库迁移
│   └── requirements.txt
│
├── frontend/                     # React 前端
│   ├── src/
│   │   ├── pages/                # 23 个页面
│   │   ├── components/           # 通用组件
│   │   │   └── decoration/       # 18 种国风背景纹样（SVG）
│   │   ├── services/             # 22 个 API 服务模块
│   │   ├── stores/               # Zustand 状态（app / cultivation / companion / notification / sound）
│   │   ├── contexts/             # Auth / Theme Context
│   │   ├── config/icons.tsx      # 统一图标映射（60+ lucide 图标 + 3 个自定义 SVG）
│   │   ├── hooks/                # 自定义 Hooks（useLive2D / useRipple ...）
│   │   └── styles/               # tokens.css + globals.css
│   ├── public/live2d/            # Live2D 模型资源
│   └── vite.config.ts
│
├── deploy/                       # 部署配置
│   ├── docker-compose.yml        # 开发编排（PG + Redis + Backend + Worker + Nginx）
│   ├── docker-compose.cloud.yml  # 云部署编排
│   ├── Dockerfile.worker         # RQ Worker 镜像
│   ├── nginx.conf                # Nginx 配置
│   └── deploy.sh                 # 部署脚本
│
├── docs/                         # 项目文档
│   ├── 项目立项报告.md
│   ├── 项目复盘报告.md
│   ├── DESIGN.md                 # 设计规范
│   └── ...
│
├── PROJECT_ARCHITECTURE.md       # 架构详解
├── CLAUDE.md                     # 开发约定与避坑指南
└── README.md
```

---

## 核心 API

所有接口以 `/api` 为前缀，完整文档见 http://localhost:8000/api/docs

| 模块 | 前缀 | 说明 |
|------|------|------|
| 鉴权 | `/api/auth` | 注册（限流 3 次/10 分钟/IP）、登录、JWT 签发 |
| 智能识别 | `/api/recognition` | 非遗图像识别与讲解 |
| 文创生成 | `/api/generation` | 文生图 / 图生图、画廊作品管理 |
| 数字展厅 | `/api/exhibition` | 展品列表、详情、分类/地区/年代筛选 |
| 传承人对话 | `/api/chat` | SSE 流式对话（`text/event-stream`） |
| 文化图谱 | `/api/knowledge-graph` | 图谱聚合、关系查询 |
| 纹样引擎 | `/api/pattern-engine` | 纹样识别、基因匹配 |
| 文物修复 | `/api/restoration` | 五步修复流水线 |
| 协同修复 | `/api/restoration-workbench` | 修复工作台（局部重绘） |
| 数字护照 | `/api/passport` | 印章、地域追踪、热力图 |
| 个性化推荐 | `/api/recommendations` | 冷启动 / 个性化推荐流 |
| 修习之路 | `/api/cultivation` | 段位、技能树、任务校验 |
| 智能伴游 | `/api/companion` | 伴游对话与建议 |
| 全局搜索 | `/api/search` | 跨藏品 / 传承人 / 上传检索 |
| 管理后台 | `/api/admin/*` | 用户、任务、成本、配置、驾驶舱、Prompt |

**SSE 流式对话**：`POST /api/chat/sessions/{id}/send`，返回 `text/event-stream`，核心事件包括 `message` / `done` / `error` / `tool_start` / `tool_progress` / `image_batch`。

---

## 测试

后端测试基于 `pytest`，无需启动服务器（使用 `TestClient` 直接测试应用）：

```bash
cd backend

# 全量测试（Mock 模式，跳过外部 AI 调用）
MOCK_MODE=true pytest tests/ -v

# 单个模块
MOCK_MODE=true pytest tests/test_auth.py -v

# 指定用例
MOCK_MODE=true pytest tests/test_recommendations.py::test_xxx -v
```

前端代码检查与构建：

```bash
cd frontend
npm run lint     # oxlint
npm run build    # tsc -b 类型检查 + vite build
```

---

## 部署

### Docker Compose（推荐）

```bash
cd deploy
docker compose up -d --build
```

服务编排：PostgreSQL 16 + Redis 7 + Backend + RQ Worker + Nginx 前端。

**切换到生产数据库**：编辑 `deploy/docker-compose.yml`，在 `backend` 与 `worker` 服务中注释 SQLite 行、取消注释 PostgreSQL 与 Redis 行：

```yaml
- DATABASE_URL=postgresql://postgres:postgres@postgres:5432/ich_platform
- REDIS_URL=redis://redis:6379/0
```

### SQLite → PostgreSQL 数据迁移

仓库内置一键迁移脚本：

```bash
python backend/scripts/migrate_sqlite_to_pg.py
```

### 生产部署检查清单

- [ ] 修改 `SECRET_KEY` 为强随机字符串
- [ ] 修改 `EXHIBITION_ADMIN_PASSWORD`
- [ ] 设置 `DEPLOY_ENV=cloud`（关闭 API 文档暴露）
- [ ] 配置 `CORS_ORIGINS` 为实际域名
- [ ] 切换 PostgreSQL 并启用 Redis
- [ ] 生成 Alembic 初始 revision（`alembic/versions/` 当前为空）
- [ ] 配置 HTTPS 与反向代理

---

## 设计规范

系统采用**新中式国风**视觉体系，所有视觉属性通过 CSS 变量统一管理。

### 主题色

| 名称 | 色值 | 用途 |
|------|------|------|
| 朱砂红 | `#B8463A` | 主色 / 强调 |
| 鎏金 | `#C4A265` | 装饰 / 点缀 |
| 宣纸米白 | `#F7F4ED` | 背景 |
| 深褐 | `#1E1B18` | 文字 / 深色底 |

### 设计 Token 体系

`tokens.css`（CSS 变量）→ `tailwind.config.js`（同步色值）→ `globals.css`（组件类与微交互）

亮/暗双模式通过 `[data-theme="dark"]` 切换，覆盖全部 Token；暗色模式**不依赖** Ant Design `darkAlgorithm`（避免 CSS 变量导致 tinycolor2 解析崩溃）。

### 背景纹样系统

`frontend/src/components/decoration/` 提供 18 种纯 SVG 国风纹样（织锦纹 / 流云纹 / 回纹 / 菱花窗格纹 / 团花纹 / 金缮菱纹 / 经纬星图纹 等），按页面语义分配，统一支持亮暗双主题。

### 字体模量级（基准 18px）

| Token | 大小 | 用途 |
|-------|:----:|------|
| `--text-xs` | 15px | 最小可读文字 |
| `--text-sm` | 16px | 辅助描述 |
| `--text-base` | 18px | 正文基准 |
| `--text-md` | 24px | 中等标题 |
| `--text-lg` | 28px | 大标题 |
| `--text-xl` | 36px | Hero 标题 |
| `--text-2xl` | 48px | 页面大标题 |

> 更详细的开发约定与避坑指南见 [`CLAUDE.md`](CLAUDE.md)，架构详解见 [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md)。

---

## 常见问题

<details>
<summary><b>启动后 API 返回旧结果 / 代码改动不生效</b></summary>

uvicorn `--reload` 有时会失效（尤其修改深层 service 文件时）。执行 `taskkill //F //IM python.exe`（Windows）清理进程后重启。

</details>

<details>
<summary><b>SQLite 数据库连接异常 / 找不到表</b></summary>

必须在 `backend/` 目录下执行启动命令，否则 `sqlite:///./data/database.sqlite` 相对路径解析错误。

</details>

<details>
<summary><b>没有 API Key 可以运行吗？</b></summary>

可以。设置 `MOCK_MODE=true` 即读取 `data/mock/` 本地 JSON，跳过所有外部 AI 调用，适合离线演示。

</details>

<details>
<summary><b>Redis 未启动会怎样？</b></summary>

系统自动降级：限流、缓存、会话改用 SQLite 实现，开发环境可正常运行。但基于 RQ 的重型异步任务（如修复流水线）将不可用。

</details>

<details>
<summary><b>前端图片显示为裂图</b></summary>

系统传承人的头像文件在仓库中不存在，必须使用 Ant Design `<Avatar>` 组件渲染（`src` 加载失败时自动回退到 `icon`），不可使用原生 `<img>`。

</details>

<details>
<summary><b>ECharts 地图 / 桑基图不显示</b></summary>

ECharts 6.x 不含内置地图，使用 `map: 'china'` 前必须 `echarts.registerMap()`。sankey / treemap / map 等图表类型不在 tree-shaking 范围内，需 `import * as echarts from 'echarts'`。

</details>

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源，**仅限学术与教育用途**。

### 第三方资源声明

- **Live2D 模型**（乐正绫绫声电台同人）版权归原作者所有，本项目仅用于学术教育用途。**商业化需获取双重授权**（Crypton Future Media 与 Live2D Inc.）。
- 非遗展品图片来源于公开网络，版权归各自权利人所有，仅供学习研究使用。

---

<div align="center">

**文博灵境** — 让非遗在数字世界中被看见、被理解、被传承

</div>
