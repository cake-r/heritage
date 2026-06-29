# 基于多模态大模型的非遗数字交互与文创生成系统 — 系统设计文档

> 版本: v1.0 | 日期: 2026-06-27 | 状态: 已确认

---

## 一、项目概述

### 1.1 项目定位

面向非遗文化数字化传承场景，融合计算机视觉（CV）、大语言模型（NLP）、AIGC图像生成多模态AI技术，打造集"识别—学习—创作—对话—浏览—收藏"于一体的完整Web交互系统。不满足于API套壳Demo，追求**技术后处理深度**与**文化传播价值**并重。

### 1.2 核心价值

- **技术维度**：同时覆盖CV、NLP、AIGC三大AI方向，含特征可视化、可控生成、时空联动交互等技术亮点
- **文化维度**：落地非遗传承实际场景，解决"体验门槛高、传播形式单一"痛点
- **工程维度**：前后端分离、数据库设计、云端部署、Mock兜底，完整工程规范

---

## 二、功能架构

### 2.1 模块总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                   非遗数字交互与文创生成系统                           │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────┤
│ ①智能识别讲解 │ ②文创生成工作室│ ③传承人对话  │ ④数字展厅    │ ⑤文化图谱│
│   P0 必做    │   P0 必做     │  P1 进阶     │  P0 必做     │ P1 进阶  │
├──────────────┴──────────────┴──────────────┴──────────────┴──────────┤
│                      ⑥ 个人中心  P0 必做 (精简版)                     │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块① — 非遗智能识别与讲解 (P0)

用户上传非遗手工艺品图片 → 多模态模型识别品类及细粒度特征 → 生成4段深度讲解 → 语音播报 → 关联推荐。

| 功能点 | 描述 |
|---|---|
| 图片上传 | 拖拽/粘贴上传，上传前裁剪预览 |
| 多模态识别 | Qwen-VL-Max 识别品类、纹样、技法、年代推测 |
| **特征热力图** | OpenCV叠加半透明蒙版标注AI判别的关键纹样/技法区域，鼠标悬停显示说明 |
| 置信度展示 | 品类置信度 + Top-3候选，用户可纠正反馈 |
| AI深度讲解 | 历史渊源 / 制作工艺 / 传承人故事 / 文化寓意，react-markdown渲染 |
| 语音播报 | CosyVoice 3合成，播放/暂停/语速调节 |
| 关联推荐 | 同品类文创模板 + 展厅对应藏品链接 |
| 识别历史 | 个人记录留存、回顾 |

### 2.3 模块② — AI非遗文创生成工作室 (P0)

结构化Prompt工程驱动的文创图像生成，支持文生图和图生图两种模式，用户可精细控制风格元素。

| 功能点 | 描述 |
|---|---|
| 文生图 | 结构化参数输入：风格+元素勾选+配色方案+构图+强度 → 后端Prompt Builder组装 |
| 图生图 | 上传参考图 → 风格迁移 → 保留构图/轮廓 |
| **可控元素生成** | 勾选具体纹样元素（祥云/牡丹/回纹/龙纹/青花配色等），精细控制生成内容 |
| 风格库 | 剪纸、苏绣、皮影、蓝印花布、年画、唐三彩、青花瓷、脸谱、敦煌、苗银 共10种 |
| 风格强度 | 0-100滑杆控制国风融合程度 |
| 批量生成 | 一次2-4张不同种子 |
| 创作画廊 | 公开作品展示 + 个人作品管理 + 下载 + 收藏 |

### 2.4 模块③ — 非遗虚拟传承人对话 (P1)

沉浸式角色对话，5种传承人人格，SSE流式输出，支持图片追问。

| 功能点 | 描述 |
|---|---|
| 角色选择 | 剪纸匠人 / 苏绣娘 / 青瓷大师 / 皮影艺人 / 综合文化向导 |
| 角色沉浸 | 不同说话风格、口头禅、擅长知识领域 |
| 流式对话 | SSE流式输出，打字机效果 |
| 图片追问 | 用户发送图片给传承人分析 |
| 对话管理 | 创建/重命名/删除会话 |
| 快捷追问 | AI回答后自动生成3个"你可能还想问"快捷按钮 |

### 2.5 模块④ — 非遗数字展厅 (P0)

分栏浏览20+项国家级非遗图文资料，支持搜索筛选、详情查看、用户作品展示。

| 功能点 | 描述 |
|---|---|
| 分栏展示 | 刺绣、陶瓷、剪纸、雕塑、织锦、绘画、金属、漆器等分栏 |
| 视图切换 | 网格/瀑布流 |
| 藏品详情 | 高清图轮播 + 工艺解读 + 地域标注 + 传承人信息 |
| 搜索筛选 | 按品类/地区/年代 |
| 用户作品馆 | 上传即展示（简化流程，不做审核） |
| 收藏 | 收藏展品到个人中心 |

### 2.6 模块⑤ — 非遗文化图谱 (P1)

ECharts驱动的可视化知识图谱，呈现非遗品类关联、地域分布、历史演变、传承谱系。

| 功能点 | 描述 |
|---|---|
| 关系图谱 | 力导向图展示非遗品类间技法/地域/历史关联 |
| 地域分布 | 中国地图热力图，按省标注非遗密度 |
| **时空联动** | 拖动时间轴，地图和关系图同步切换到对应朝代，三视图联动 |
| 传承谱系 | 树状图展示传承人代际关系 |
| 点击钻取 | 节点点击 → 详情卡片 → 跳转展厅详情页 |

### 2.7 模块⑥ — 个人中心 (P0精简版)

| 功能点 |
|---|
| 识别记录 / 生成作品集 / 对话历史 / 收藏夹 / 基本设置 |

---

## 三、技术栈

### 3.1 后端

| 层 | 选型 | 理由 |
|---|---|---|
| Web框架 | FastAPI + Uvicorn | 异步高性能，Swagger文档自动生成，SSE原生支持 |
| ORM | SQLAlchemy (同步) + SQLite | 同步够用，避免异步并发坑，SQLite零配置 |
| 数据校验 | Pydantic v2 | FastAPI原生集成 |
| 文件处理 | Pillow + OpenCV | 缩略图、热力图叠加 |
| 长任务 | FastAPI BackgroundTasks | 替代Celery+Redis，少部署组件 |
| 鉴权 | JWT (python-jose) | 轻量鉴权，数据隔离 |
| 图片裁剪 | react-easy-crop (前端) | 上传前预处理 |

### 3.2 AI服务层

| 能力 | 模型/服务 | 平台 | 预估费用 |
|---|---|---|---|
| 图像识别 | Qwen-VL-Max | 阿里DashScope | ~¥0.02/次 |
| 大语言模型 | DeepSeek-V3 | DeepSeek API | ~¥0.001/1K tokens |
| 文生图 | 通义万相2.1 | 阿里DashScope | ~¥0.15/张 |
| 图生图 | 通义万相2.1 | 阿里DashScope | ~¥0.15/张 |
| 语音合成 | CosyVoice 3 | 阿里ModelScope | 免费 |
| 备选生图 | Seedream 4.0 | 字节即梦 | ~¥0.10/张 |

### 3.3 前端

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | React 18 + TypeScript | 生态最丰富，适合复杂交互 |
| 构建 | Vite 5 | 极快HMR |
| UI组件库 | Ant Design 5 | 中文友好，组件齐全 |
| 动画 | Framer Motion | 页面过渡、图谱动效 |
| 样式 | TailwindCSS 3 | 原子化样式，国风定制 |
| 路由 | React Router v6 | SPA路由标准方案 |
| 状态管理 | React Context + useReducer | 轻量，本项目规模完全够用 |
| 请求 | Axios | 手动管理，学习成本零 |
| 图表 | ECharts (react-echarts) | 地图+力导向图+时间轴，一库全覆盖 |
| Markdown | react-markdown | 讲解内容格式化 |

### 3.4 部署

| 环境 | 方案 |
|---|---|
| 本地开发 | `docker-compose up` 一键启动 |
| 云端生产 | 阿里云ECS + Docker + Nginx反向代理 + HTTPS (Let's Encrypt) |
| 环境切换 | `DEPLOY_ENV` 环境变量，前端API地址自动切换 |

---

## 四、技术亮点设计

### 4.1 特征区域热力图可视化

```
流程: 图片上传 → Qwen-VL-Max 识别(返回品类+特征描述) 
→ NLP提取特征关键词(纹样名/技法术语) 
→ OpenCV生成半透明热力图蒙版叠加原图 
→ 前端展示对比视图(原图 | 热力标注图) 
→ 鼠标悬停热力区域显示"此处为[xx技法]特征区域"
```

### 4.2 可控元素级文创生成

```
请求结构:
{
  "base_style": "苏绣",
  "elements": ["祥云纹", "牡丹花", "回纹边框"],
  "color_palette": "青花瓷蓝白",
  "composition": "中心对称",
  "intensity": 0.7
}
→ 后端 Prompt Engineering 层 → 结构化大模型Prompt 
→ 通义万相API调用 → 返回图片+完整参数(可复现)
```

### 4.3 时空联动交互

```
ECharts三实例联动: 中国地图 + 关系图谱 + 时间轴
→ 用户拖动时间轴到"宋代" 
→ 地图热力图切换到宋代非遗分布 
→ 关系图谱筛选出宋代活跃品类节点 
→ 一次拖拽，三视图同步响应
```

---

## 五、风险兜底：Mock模式

所有AI能力依赖外网API，答辩现场网络异常则全面崩盘。设计Mock模式：

```
backend/data/mock/
├── recognition_results.json    # 预存10组识别结果+热力图
├── generated_images/          # 预生成20张不同风格文创图
├── chat_demo.json             # 2段完整对话
└── tts_samples/               # 预合成语音文件

启用: 环境变量 MOCK_MODE=true
→ 所有AI API返回预存数据，前端无感知，演示流程不受影响
→ 答辩前提前准备好mock数据并测试通过
```

---

## 六、数据库设计

### 6.1 核心表

```
users                   -- 用户
recognition_records     -- 识别记录 (含explanation JSON、voice_path)
generated_works         -- AI生成作品 (含prompt参数、seed、style配置)
chat_sessions           -- 对话会话 (含persona角色)
chat_messages           -- 对话消息 (含role、content、image_path)
heritage_items          -- 非遗知识库藏品 (含techniques/inheritors/images JSON)
user_uploads            -- 用户上传作品
favorites               -- 多态收藏 (item_type: heritage|generated|user_upload)
user_settings           -- 用户设置
```

### 6.2 知识库数据策略

用DeepSeek-V3批量生成20+项非遗结构化JSON数据，脚本直接导入SQLite，避免手动整理耗时。

---

## 七、API路由设计

```
# 鉴权
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

# 模块① 识别讲解
POST   /api/recognition/upload
GET    /api/recognition/history
GET    /api/recognition/{id}

# 模块② 文创生成
POST   /api/generation/text-to-image
POST   /api/generation/image-to-image
GET    /api/generation/history
GET    /api/generation/gallery
POST   /api/generation/{id}/publish
DELETE /api/generation/{id}

# 模块③ 对话 (SSE)
GET    /api/chat/sessions
POST   /api/chat/sessions
GET    /api/chat/sessions/{id}
POST   /api/chat/sessions/{id}/send     → SSE流式返回
DELETE /api/chat/sessions/{id}

# 模块④ 展厅
GET    /api/exhibition/items
GET    /api/exhibition/items/{id}
GET    /api/exhibition/categories
POST   /api/exhibition/uploads

# 模块⑤ 图谱
GET    /api/knowledge-graph/relations
GET    /api/knowledge-graph/regions
GET    /api/knowledge-graph/timeline

# 模块⑥ 个人中心
GET    /api/user/profile
PUT    /api/user/profile
GET    /api/user/favorites
POST   /api/user/favorites
DELETE /api/user/favorites/{id}

# 系统
GET    /api/system/health               # 健康检查+AI API连通性
POST   /api/system/mock-mode            # Mock模式切换
```

---

## 八、项目目录结构

```
project/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/           # 路由层 (deps/auth/recognition/generation/chat/exhibition/knowledge_graph/user/upload)
│   │   ├── models/        # SQLAlchemy模型 (database/user/recognition/generation/chat/exhibition/favorite)
│   │   ├── schemas/       # Pydantic校验 (auth/recognition/generation/chat/exhibition/common)
│   │   ├── services/
│   │   │   ├── ai/        # AI服务封装 (base/recognition/llm/image_gen/tts/post_process/prompt_builder)
│   │   │   ├── knowledge_service.py
│   │   │   └── file_service.py
│   │   └── utils/         # exceptions/middleware/security
│   ├── data/
│   │   ├── database.sqlite
│   │   ├── knowledge/     # 种子数据JSON
│   │   ├── uploads/       # images/voices/exports
│   │   └── mock/          # 离线演示数据
│   ├── scripts/           # seed_knowledge.py / generate_knowledge.py / migrate.py
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx / App.tsx / routes.tsx
│   │   ├── pages/         # Home/Recognition/CreativeStudio/VirtualInheritor/ExhibitionHall/KnowledgeGraph/UserCenter/Login/Register
│   │   ├── components/    # layout(MainLayout/Sidebar/Header) / common / recognition / generation / chat / exhibition / knowledge-graph
│   │   ├── contexts/      # AuthContext / AppContext
│   │   ├── hooks/         # useAuth / useSSE / useImageUpload
│   │   ├── services/      # api.ts / recognition / generation / chat / exhibition / user
│   │   ├── types/ / styles/ / utils/
│   ├── package.json / vite.config.ts / tailwind.config.js / tsconfig.json / Dockerfile
├── deploy/
│   ├── docker-compose.yml / docker-compose.cloud.yml / nginx.conf / deploy.sh
├── docs/
│   ├── superpowers/specs/   # 设计文档
│   ├── superpowers/plans/   # 实施计划
│   └── api-spec.md / database-schema.md
├── .gitignore / .env.example / README.md
```

---

## 九、开发排期（21天）

| 阶段 | 天数 | 内容 |
|---|---|---|
| 骨架搭建 | D1 | FastAPI空项目 + Vite+React空项目 + Docker Compose + Git |
| 基础设施 | D2-4 | 数据库模型 + JWT鉴权 + AI服务层封装 + 知识库批量生成导入 |
| 模块① | D5-7 | 识别讲解后端API + 前端页面 + 热力图后处理 |
| 模块② | D8-10 | 文创生成后端API + Prompt Builder + 前端工作室页面 |
| 模块④ | D11-12 | 展厅后端CRUD + 前端展厅页面 |
| 模块⑥ | D13 | 个人中心5个子页面（精简版） |
| Mock准备 | D14 | Mock数据生成 + 前后端Mock模式联调 |
| 模块③ | D15-16 | 对话SSE API + 对话前端页面 |
| 模块⑤ | D17 | 图谱数据API + ECharts三图联动前端 |
| 整合上线 | D18-20 | 全链路联调 + 云端部署 + 异常处理 + 界面美化 |
| 文档 | D21 | README + 架构图 + 答辩脚本 + PPT素材 |

---

## 十、前期准备清单

- [ ] Python 3.11+ / Node.js 20+ / Docker Desktop 安装
- [ ] DeepSeek API Key (充值50元)
- [ ] 阿里云 DashScope API Key (充值30元)
- [ ] 阿里云ECS学生机 (约10元/月，公网IP)
- [ ] 用DeepSeek批量生成20项非遗JSON数据
- [ ] 收集非遗风格参考图 (每种风格3-5张)
- [ ] VS Code插件: Python / ESLint / Prettier / Tailwind CSS IntelliSense
