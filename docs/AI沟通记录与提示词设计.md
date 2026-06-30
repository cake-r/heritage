# AI 沟通记录与提示词设计报告

**项目：** 文博灵境 — 非物质文化遗产 AI 交互系统  
**周期：** 第 1 周（2026-06-09 ~ 2026-06-13）  
**内容：** 8 个关键开发会话 + 改进后提示词 + AI 输出 + 评分

---

## 评分维度说明

| 维度 | 权重 | 标准 |
|------|------|------|
| 会话拆分管理 | 20% | 任务独立建会话；会话命名规范；Bug 三次未解则重开会话 |
| 指令具体化 | 20% | 量化指标、明确标准、禁用模糊词（"优化""美化"） |
| 角色边界 | 15% | 产品/架构师/前端/DBA 权责隔离 |
| 结果导向 | 15% | 验证运行效果优先，不逐行审代码 |
| 维护机制 | 15% | 初始化章程；重复错误补入章程；相对路径引用 |
| 标准流程 | 15% | 需求收集→PRD→评审→落地；流程图/架构图 |

---

## 对话一：项目初始化与架构设计

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 文博灵境-项目架构设计 |
| 会话目的 | 确定技术栈、项目结构、前后端分离架构 |
| 对应周次 | 第 1 周 Day 1 |

### 改进后提示词

```
【会话名称】文博灵境-项目架构设计

【角色设定】
你是系统架构师，负责技术选型和项目骨架搭建。

【项目背景】
开发"文博灵境"——非物质文化遗产 AI 交互系统，面向非遗数字化传承场景，
目标用户为非遗爱好者、传承人和普通文化爱好者。

【技术栈要求】
- 后端：Python 3.12 + FastAPI（同步模式） + SQLAlchemy + SQLite
- 前端：React 19 + TypeScript + Vite + Ant Design 6 + TailwindCSS
- AI 平台：阿里云 DashScope（视觉+图像+语音）、DeepSeek（对话+向量）
- 部署：Docker + Nginx
- 依赖管理：pip requirements.txt / npm package.json

【产出要求】
1. 画出系统架构图（Mermaid 语法），标注前端→Nginx→FastAPI→SQLite 链路
2. 画出 AI 服务调用拓扑图：4 个模型 → 5 个功能域的映射关系
3. 给出完整目录结构（backend/frontend/deploy），每个目录标注职责
4. 定义跨模块通信规则：同步 ORM、SSE 流式、fire-and-forget 线程模式
5. 输出环境变量清单（DASHSCOPE_API_KEY / DEEPSEEK_API_KEY 等）

【约束条件】
- 禁止使用 async ORM、Celery、Redis —— 保持架构简单
- SQLite 必须开启外键约束
- 前端全局状态只用 React Context，禁用 Zustand/Redux
- ECharts Canvas 不解析 CSS 变量，须硬编码色值

【验收标准】
- 架构图能清楚表达数据流和调用关系
- 目录结构能直接作为项目脚手架
- 环境变量 .env.example 可直接复制使用
- 启动命令能跑通（后端 8000 / 前端 5173）
```

### AI 输出

#### 1. 系统架构图（Mermaid）

```
┌─────────────────────────────────────────────────────────┐
│                      客户端层                            │
│  Browser (React SPA)                                    │
│  localhost:5173 (dev) / :80 (prod)                      │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/SSE
                     ▼
┌─────────────────────────────────────────────────────────┐
│                     Nginx :80                            │
│  /          → 静态文件 (React build)                     │
│  /api/*     → proxy_pass http://backend:8000             │
│  /static/*  → proxy_pass http://backend:8000             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                FastAPI :8000                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │
│  │ api/     │  │ models/  │  │ services/ai/     │      │
│  │ 17路由模块 │  │ 17张表   │  │ 5个AI服务        │      │
│  └──────────┘  └──────────┘  └──────────────────┘      │
│       │              │                 │                 │
│       ▼              ▼                 ▼                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐      │
│  │ schemas/ │  │ SQLite   │  │ 阿里云DashScope   │      │
│  │ Pydantic │  │ 本地文件  │  │ DeepSeek API     │      │
│  └──────────┘  └──────────┘  └──────────────────┘      │
└─────────────────────────────────────────────────────────┘
```

#### 2. AI 服务调用拓扑

```
                    ┌──────────────┐
                    │   FastAPI    │
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ DashScope   │ │ DashScope   │ │ DashScope   │
    │ Qwen-VL-Max │ │ Wanx T2I/I2I│ │ CosyVoice   │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           ▼               ▼               ▼
     ① 视觉识别      ② 图像生成      ③ 语音合成
     纹样提取        文创创作         TTS 播报
     损伤分析        数字修复
     工具 inspect   工具 create
     工具 pattern

           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ DeepSeek    │ │ DeepSeek    │ │ DeepSeek    │
    │ deepseek    │ │ deepseek    │ │ deepseek    │
    │ -chat       │ │ -chat       │ │ -embedding  │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           ▼               ▼               ▼
     ④ 对话/生成      ⑤ 伴游/推荐      ⑥ 语义检索
     技艺工坊聊天    AI 伴游对话     知识图谱向量搜索
     工具 connect    个性化推荐       遗产相似度匹配
     工具 story      用户画像
     工具 teach
     工具 compare
```

#### 3. 完整目录结构

```
project/
├── backend/
│   ├── app/
│   │   ├── api/                    # 路由模块 (17个)
│   │   │   ├── auth.py             # 注册/登录/获取当前用户
│   │   │   ├── recognition.py      # 非遗识别
│   │   │   ├── generation.py       # 文创生成
│   │   │   ├── chat.py             # 技艺工坊 SSE 聊天
│   │   │   ├── inheritor.py        # 定制传承人 CRUD
│   │   │   ├── exhibition.py       # 非遗展馆
│   │   │   ├── knowledge_graph.py  # 知识图谱
│   │   │   ├── restoration.py      # 数字修复
│   │   │   ├── passport.py         # 数字护照
│   │   │   ├── expansion.py        # 知识拓展
│   │   │   ├── recommendation.py   # 个性推荐 (Phase 2)
│   │   │   ├── cultivation.py      # 修习之路 (Phase 2)
│   │   │   ├── companion.py        # AI 伴游 (Phase 2)
│   │   │   ├── user.py             # 用户中心
│   │   │   ├── tools.py            # 工具相关
│   │   │   └── deps.py             # 依赖注入 (get_current_user)
│   │   ├── models/                 # 数据库模型 (17张表)
│   │   ├── schemas/                # Pydantic 请求/响应模型
│   │   ├── services/               # 业务逻辑
│   │   │   ├── ai/                 # AI 服务层
│   │   │   │   ├── base.py         # Mock 模式 + 异常基类
│   │   │   │   ├── llm.py          # DeepSeek 对话
│   │   │   │   ├── recognition.py  # Qwen-VL 识别
│   │   │   │   ├── image_gen.py    # Wanx 图像生成
│   │   │   │   ├── tts.py          # CosyVoice 语音
│   │   │   │   ├── embedding.py    # 语义向量
│   │   │   │   ├── companion.py    # AI 伴游对话
│   │   │   │   ├── recommendation.py # 推荐引擎
│   │   │   │   ├── restoration_pipeline.py # 修复流水线
│   │   │   │   ├── workshop_tool_dispatcher.py # 工具调度
│   │   │   │   ├── curriculum_builder.py # 课程生成
│   │   │   │   ├── prompt_builder.py # Prompt 构建
│   │   │   │   └── post_process.py # 后处理
│   │   │   └── cultivation_service.py # 修习逻辑
│   │   ├── config/
│   │   │   └── config.py           # 环境变量配置
│   │   └── main.py                 # FastAPI 入口 + load_dotenv
│   ├── config/                     # 参考数据文件
│   │   ├── characters.json         # 传承人角色定义
│   │   ├── quests.json             # 日常任务模板
│   │   ├── stamps.json             # 印章定义
│   │   └── headers.json            # HTTP 请求头
│   ├── data/
│   │   ├── mock/                   # Mock 数据 (开发模式)
│   │   ├── uploads/images/         # 用户上传图片
│   │   ├── uploads/heatmaps/       # 识别热力图
│   │   ├── knowledge/              # 种子数据
│   │   └── *.sqlite                # SQLite 数据库文件
│   ├── scripts/
│   │   └── seed_knowledge.py       # 种子数据脚本
│   ├── tests/                      # pytest 测试 (~103个)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                  # 15个页面组件
│   │   ├── components/             # 通用组件
│   │   │   ├── common/             # ErrorBoundary, ProtectedRoute
│   │   │   ├── layout/             # Header, Sidebar, MainLayout
│   │   │   ├── companion/          # CompanionDrawer, FloatButton
│   │   │   ├── cultivation/        # RankBadge, XpGainAnimation
│   │   │   ├── recognition/        # AudioPlayer
│   │   │   └── recommendation/     # RecommendationCard
│   │   ├── contexts/               # React Context (5个)
│   │   ├── services/               # API 调用封装 (13个)
│   │   └── styles/
│   │       └── tokens.css          # 设计 Token (CSS 变量)
│   ├── vite.config.ts              # Vite + /api 代理
│   └── package.json
├── deploy/
│   ├── docker-compose.yml          # 开发环境
│   ├── docker-compose.cloud.yml    # 生产环境
│   ├── nginx.conf                  # Nginx 配置
│   └── deploy.sh                   # 一键部署脚本
├── docs/                           # 项目文档
├── CLAUDE.md                       # AI 开发章程
└── README.md
```

#### 4. 跨模块通信规则

| 通信模式 | 场景 | 实现方式 |
|----------|------|----------|
| 同步 ORM | 普通 CRUD API | 请求线程内同步 Session，返回后关闭 |
| SSE 流式 | 聊天/工具执行 | `StreamingResponse` + `asyncio.Queue` + `run_in_executor` |
| Fire-and-Forget | 戳章/画像更新/时间戳 | `threading.Thread(daemon=True)` + 独立 `SessionLocal()` |
| CustomEvent | 前端跨页面通知 | `window.dispatchEvent(new CustomEvent('companion:action', {...}))` |

#### 5. 环境变量清单

```bash
# .env.example
DASHSCOPE_API_KEY=           # 阿里云百炼 (视觉/图像/语音)
DEEPSEEK_API_KEY=             # DeepSeek (对话/向量)
DEEPSEEK_BASE_URL=https://api.deepseek.com
MOCK_MODE=false               # true=本地 mock 数据
DEPLOY_ENV=local              # local|cloud
COSYVOICE_VOICE=longxiaochun  # TTS 音色
SECRET_KEY=change-me          # JWT 签名密钥
DATABASE_URL=sqlite:///./data/app.db
```

### 改进后评分：88/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 18/20 | 会话命名明确；架构设计独立会话 |
| 指令具体化 | 18/20 | 精确到版本号、端口、目录职责、禁止项 |
| 角色边界 | 14/15 | 明确架构师角色，不越界到编码 |
| 结果导向 | 14/15 | 5 项可验收产出全部交付 |
| 维护机制 | 12/15 | 环境变量/约束条件可写入 CLAUDE.md |
| 标准流程 | 12/15 | Mermaid 架构图 + 通信规则表 |

---

## 对话二：数据库设计

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 文博灵境-数据库设计 |
| 会话目的 | 设计 17 张数据表，确定关系、索引、迁移策略 |
| 对应周次 | 第 1 周 Day 1-2 |

### 改进后提示词

```
【会话名称】文博灵境-数据库设计

【角色设定】
你是 DBA（数据库架构师），负责 ER 模型设计、表结构定义、索引策略。

【需求输入】
详见 PRD-001（用户系统）、PRD-002（非遗识别）、PRD-003（文创生成）、
PRD-004（技艺工坊）、PRD-005（数字护照）、PRD-006（数字修复）、
PRD-007（知识图谱）、PRD-008（知识拓展）。

【产出要求】
1. ER 图（PlantUML 语法）—— 标注 1:1、1:N、N:M 关系
2. 每张表的字段清单：
   - 字段名 / 类型 / 长度 / 可空 / 默认值 / 注释
   - 外键约束 & 级联删除策略
   - JSON 列标注序列化方式（json.dumps / json.loads 手动处理）
3. 索引清单 —— 明确哪些字段建索引、理由
4. 迁移策略 —— 使用 `_migrate_add_column()` 兼容旧数据，禁止 DROP COLUMN
5. 数据字典 —— 每张表 1 行中文描述

【约束条件】
- 数据库类型：SQLite（单文件，零配置）
- 外键必须开启：`PRAGMA foreign_keys = ON`
- 不使用 SQLAlchemy JSON 类型 —— JSON 列用 TEXT 手动序列化
- 级联删除：chat_sessions → chat_messages（会话删除时消息级联删除）
- 收藏表用多态设计（item_type + item_id），不建多张关联表

【验收标准】
- ER 图覆盖全部 17 张表
- 每张表至少定义主键 + 外键（如有）
- 索引覆盖高频查询路径
- 数据字典可供前端同学查阅
```

### AI 输出

#### 1. ER 图（PlantUML）

```
@startuml

entity "users" as users {
  * id : INTEGER <<PK>>
  --
  * username : VARCHAR(50) UNIQUE
  * email : VARCHAR(100)
  * password_hash : VARCHAR(255)
  * avatar_url : VARCHAR(500)
  * created_at : DATETIME
}

entity "recognition_records" as rec {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * image_path : VARCHAR(500)
  * category : VARCHAR(64)
  * era : VARCHAR(32)
  * craft : VARCHAR(128)
  * pattern_info : TEXT(JSON)
  * voice_url : VARCHAR(500)
  * created_at : DATETIME
}

entity "generated_works" as gen {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * prompt : TEXT
  * image_url : VARCHAR(500)
  * type : VARCHAR(32)
  * is_published : BOOLEAN
  * created_at : DATETIME
}

entity "chat_sessions" as cs {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * persona : VARCHAR(64)
  * title : VARCHAR(128)
  * created_at : DATETIME
}

entity "chat_messages" as cm {
  * id : INTEGER <<PK>>
  --
  * session_id : INTEGER <<FK→cs ON DELETE CASCADE>>
  * role : VARCHAR(16)
  * content : TEXT
  * tool_id : VARCHAR(32)
  * voice_url : VARCHAR(500)
  * created_at : DATETIME
}

entity "heritage_items" as hi {
  * id : INTEGER <<PK>>
  --
  * name : VARCHAR(128)
  * category : VARCHAR(64)
  * era : VARCHAR(32)
  * region : VARCHAR(32)
  * description : TEXT
  * image_url : VARCHAR(500)
  * embedding_json : TEXT(JSON)
}

entity "favorites" as fav {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * item_type : VARCHAR(32)
  * item_id : INTEGER
  * created_at : DATETIME
}

entity "user_uploads" as up {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * file_path : VARCHAR(500)
  * created_at : DATETIME
}

entity "user_settings" as us {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>> UNIQUE
  * settings_json : TEXT(JSON)
}

entity "restoration_records" as rr {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * original_path : VARCHAR(500)
  * result_path : VARCHAR(500)
  * pipeline_status : VARCHAR(32)
  * damage_analysis : TEXT(JSON)
  * quality_scores : TEXT(JSON)
  * created_at : DATETIME
}

entity "custom_inheritors" as ci {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * name : VARCHAR(64)
  * expertise : TEXT(JSON)
  * system_prompt : TEXT
  * style : VARCHAR(255)
  * avatar_url : VARCHAR(500)
  * tools : TEXT(JSON)
  * is_public : BOOLEAN
  * created_at : DATETIME
}

entity "passport_stamps" as ps {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * stamp_id : VARCHAR(32)
  * earned_at : DATETIME
  * displayed : BOOLEAN
}

entity "expansion_queue" as eq {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * status : VARCHAR(32)
  * result_json : TEXT(JSON)
  * created_at : DATETIME
}

entity "user_interest_profile" as uip {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>> UNIQUE
  * category_scores : TEXT(JSON)
  * interaction_count : INTEGER
  * updated_at : DATETIME
}

entity "user_cultivation" as uc {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>> UNIQUE
  * xp : INTEGER
  * rank : VARCHAR(32)
  * skill_trees : TEXT(JSON)
  * updated_at : DATETIME
}

entity "user_quests" as uq {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * quest_key : VARCHAR(64)
  * status : VARCHAR(16)
  * date : DATE
  * completed_at : DATETIME
}

entity "companion_interactions" as comp {
  * id : INTEGER <<PK>>
  --
  * user_id : INTEGER <<FK→users>>
  * type : VARCHAR(32)
  * suggestion_id : VARCHAR(64)
  * content : TEXT
  * feedback : VARCHAR(16)
  * created_at : DATETIME
}

' 关系定义
users ||--o{ rec
users ||--o{ gen
users ||--o{ cs
cs ||--o{ cm
users ||--o{ fav
users ||--o{ up
users ||--|| us
users ||--o{ rr
users ||--o{ ci
users ||--o{ ps
users ||--o{ eq
users ||--|| uip
users ||--|| uc
users ||--o{ uq
users ||--o{ comp

@enduml
```

#### 2. 关键表字段清单（示例：chat_sessions + chat_messages）

**chat_sessions**

| 字段 | 类型 | 可空 | 默认值 | 注释 |
|------|------|------|--------|------|
| id | INTEGER | NOT NULL | AUTO | 主键 |
| user_id | INTEGER | NOT NULL | — | FK→users.id |
| persona | VARCHAR(64) | NOT NULL | — | 传承人 ID |
| title | VARCHAR(128) | NULL | "新对话" | 会话标题 |
| created_at | DATETIME | NOT NULL | NOW | 创建时间 |

**chat_messages**

| 字段 | 类型 | 可空 | 默认值 | 注释 |
|------|------|------|--------|------|
| id | INTEGER | NOT NULL | AUTO | 主键 |
| session_id | INTEGER | NOT NULL | — | FK→chat_sessions **ON DELETE CASCADE** |
| role | VARCHAR(16) | NOT NULL | — | "user"/"assistant"/"tool" |
| content | TEXT | NULL | — | 消息正文 |
| tool_id | VARCHAR(32) | NULL | — | 工具 ID（tool 消息时填充） |
| voice_url | VARCHAR(500) | NULL | — | TTS 音频 URL |
| created_at | DATETIME | NOT NULL | NOW | 创建时间 |

#### 3. 索引清单

| 表 | 索引字段 | 类型 | 理由 |
|----|----------|------|------|
| users | username | UNIQUE | 登录查询 |
| recognition_records | user_id + created_at | 复合 | 用户历史分页 |
| chat_messages | session_id + created_at | 复合 | 会话消息时间线 |
| favorites | user_id + item_type | 复合 | 用户收藏列表 |
| heritage_items | category | 普通 | 品类筛选 |
| heritage_items | region | 普通 | 地域筛选 |
| passport_stamps | user_id + stamp_id | 复合 | 印章幂等检查 |
| user_quests | user_id + date | 复合 | 每日任务查询 |
| companion_interactions | user_id + created_at | 复合 | 伴游交互历史 |

#### 4. 迁移策略

```python
def _migrate_add_column(table_name: str, column: Column):
    """安全添加列：检查列是否存在，不存在则 ALTER TABLE ADD COLUMN"""
    inspector = inspect(engine)
    existing = [c["name"] for c in inspector.get_columns(table_name)]
    if column.name not in existing:
        with engine.connect() as conn:
            conn.execute(text(
                f"ALTER TABLE {table_name} ADD COLUMN {column.name} {column.type}"
            ))
            conn.commit()
```

#### 5. 数据字典

| 表名 | 中文描述 |
|------|----------|
| users | 用户账户 |
| recognition_records | 非遗识别记录 |
| generated_works | AI 生成作品 |
| chat_sessions | 技艺工坊聊天会话 |
| chat_messages | 聊天消息（含工具结果） |
| heritage_items | 非遗遗产条目（知识库） |
| user_uploads | 用户上传文件 |
| favorites | 用户收藏（多态：遗产/作品/上传） |
| user_settings | 用户设置（JSON） |
| restoration_records | 数字修复记录 |
| custom_inheritors | 用户定制的 AI 传承人 |
| passport_stamps | 数字护照印章 |
| expansion_queue | 知识拓展任务队列 |
| user_interest_profile | 用户兴趣画像（19 维偏好向量） |
| user_cultivation | 修习状态（XP/等级/技能树） |
| user_quests | 日常任务记录 |
| companion_interactions | AI 伴游交互日志 |

### 改进后评分：86/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 17/20 | 独立会话；关联上游 PRD 编号 |
| 指令具体化 | 18/20 | 精确到字段级、级联策略、序列化方式 |
| 角色边界 | 13/15 | 明确 DBA 角色 |
| 结果导向 | 14/15 | 5 项可验收产出全部交付 |
| 维护机制 | 13/15 | 数据字典可维护；PRD 编号可追溯 |
| 标准流程 | 11/15 | PlantUML ER 图 + 字段清单模板 |

---

## 对话三：AI 服务抽象层 + Mock 模式设计

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 文博灵境-AI服务层设计 |
| 会话目的 | 设计统一的 AI 服务抽象层，解决 API Key 依赖和多平台接入问题 |
| 对应周次 | 第 1 周 Day 2 |

### 改进后提示词

```
【会话名称】文博灵境-AI服务层设计

【角色设定】
你是系统架构师，负责设计 AI 服务的抽象层和 Mock 开发模式。

【需求背景】
项目依赖 2 个 AI 平台、4 个模型，开发环境中经常因为缺少 API Key
导致后端无法启动。需要一个 Mock 模式让未配置 Key 的开发者也能运行全部功能。

【设计要求】
1. 环境变量控制：
   - MOCK_MODE=true → 所有 AI 调用读本地 mock 数据
   - MOCK_MODE=false → 走真实 API
   - 两种模式切换零代码改动

2. 抽象层设计：
   - 创建 base.py，提供 mock_mode() 方法（读取 MOCK_MODE 环境变量）
   - 定义 MOCK_DATA_DIR = "data/mock/"
   - 所有 AI 服务文件统一 import mock_mode

3. Mock 数据规范：
   - 格式：JSON，每个 AI 端点一个文件
   - 命名规则：{service}_{function}_mock.json（如 recognition_analyze_mock.json）
   - 至少包含：成功响应 + 失败降级 两种数据

4. 平台隔离：
   - 阿里云 DashScope → recognition.py / image_gen.py / tts.py
   - DeepSeek → llm.py / companion.py / recommendation.py / embedding.py
   - 每个服务独立 try-catch，单平台故障不波及其他

【产出要求】
1. base.py 源码骨架（含 mock_mode + 异常基类 AppException）
2. Mock 数据目录结构和示例文件（至少 3 个）
3. 在 CLAUDE.md 中写入以下条目：
   - "Mock 模式使用方法"
   - "模型名称硬编码位置"（注明这不是 bug，是有意设计）
   - "环境变量清单"

【禁止项】
- 不使用工厂模式/策略模式过度设计（保持简单）
- 模型名不做成 .env 可配置（当前阶段固定）

【验收标准】
- MOCK_MODE=true 时后端正常启动，无 API Key 报错
- MOCK_MODE=false 时调用真实 API
- 所有 AI 服务文件都 import 自 base.py
```

### AI 输出

#### 1. base.py 源码骨架

```python
"""AI 服务抽象基类"""
import os
import json
from pathlib import Path
from functools import lru_cache

# ── 环境变量 ──────────────────────────────────
MOCK_DATA_DIR = Path(__file__).parent.parent.parent / "data" / "mock"

@lru_cache()
def mock_mode() -> bool:
    """读取 MOCK_MODE 环境变量（缓存结果，避免重复读取）"""
    return os.getenv("MOCK_MODE", "false").lower() == "true"

# ── 异常基类 ──────────────────────────────────
class AppException(Exception):
    """应用级异常基类"""
    def __init__(self, detail: str, error_code: str = "INTERNAL_ERROR"):
        self.detail = detail
        self.error_code = error_code
        super().__init__(detail)

class AIServiceError(AppException):
    """AI 服务调用异常"""
    def __init__(self, detail: str, platform: str = ""):
        super().__init__(detail, error_code=f"AI_{platform}_ERROR")

# ── Mock 数据加载 ─────────────────────────────
def load_mock(service: str, function: str) -> dict:
    """
    加载 Mock 数据
    Args:
        service: 服务名 (recognition / llm / image_gen / tts)
        function: 函数名 (analyze / chat / text_to_image / synthesize)
    Returns:
        dict: Mock 响应数据
    Raises:
        FileNotFoundError: Mock 文件不存在
    """
    filepath = MOCK_DATA_DIR / f"{service}_{function}_mock.json"
    if not filepath.exists():
        raise FileNotFoundError(f"Mock 数据文件不存在: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def mock_or_real(mock_service: str, mock_func: str, real_callable, *args, **kwargs):
    """统一入口：Mock 模式读本地数据，否则调真实 API"""
    if mock_mode():
        return load_mock(mock_service, mock_func)
    return real_callable(*args, **kwargs)
```

#### 2. Mock 数据目录结构和示例

```
backend/data/mock/
├── recognition_analyze_mock.json     # 识别成功 / 识别失败
├── llm_chat_mock.json                # 对话回复
├── llm_companion_mock.json           # 伴游建议
├── llm_recommendation_mock.json      # 推荐理由
├── image_gen_text_to_image_mock.json # 文生图结果
├── image_gen_image_to_image_mock.json# 图生图结果
├── image_gen_restoration_mock.json   # 修复结果
├── tts_synthesize_mock.json          # 语音合成结果
└── embedding_vectorize_mock.json     # 向量化结果
```

**示例：recognition_analyze_mock.json**
```json
{
  "success": true,
  "data": {
    "category": "剪纸",
    "era": "清代",
    "craft": "阴刻剪纸",
    "pattern_type": "窗花",
    "cultural_meaning": "蝙蝠纹样寓意'福'，常用于春节装饰，寄托对美好生活的向往",
    "related_items": [
      {"id": 1, "name": "陕西窗花·五福捧寿"},
      {"id": 2, "name": "河北蔚县剪纸·十二生肖"}
    ]
  }
}
```

#### 3. 各 AI 服务 Mock 调用模式（以 recognition.py 为例）

```python
from app.services.ai.base import mock_mode, load_mock, AIServiceError

def analyze_image(image_path: str) -> dict:
    """调用 Qwen-VL 识别图片中的非遗信息"""
    if mock_mode():
        return load_mock("recognition", "analyze")

    try:
        # 真实 API 调用
        import dashscope
        response = dashscope.MultiModalConversation.call(
            model="qwen-vl-max",
            messages=[...],
            api_key=os.getenv("DASHSCOPE_API_KEY"),
        )
        return parse_response(response)
    except Exception as e:
        raise AIServiceError(str(e), platform="DashScope")
```

### 改进后评分：85/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 17/20 | 独立会话，命名清晰 |
| 指令具体化 | 18/20 | 文件名/目录/开关逻辑全部量化 |
| 角色边界 | 13/15 | 明确架构师，给出禁止项防止过度设计 |
| 结果导向 | 13/15 | 3 项产出全部交付 |
| 维护机制 | 14/15 | 要求写入 CLAUDE.md，含维护指引 |
| 标准流程 | 10/15 | 有设计理由和方案讨论 |

---

## 对话四：前端国风主题系统

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 文博灵境-前端主题设计 |
| 会话目的 | 设计国风视觉系统：色板、字体、间距、暗色模式 |
| 对应周次 | 第 1 周 Day 2-3 |

### 改进后提示词

```
【会话名称】文博灵境-前端主题设计

【角色设定】
你是前端工程师，搭配 UI 设计师视角，负责设计系统（Design Token）定义。

【设计参考】
参考故宫博物院官网配色体系，基调为"朱砂 + 鎏金 + 墨色"。
可参考图片（略）或访问 https://www.dpm.org.cn 获取色彩参考。

【量化要求】
1. 色板（6 色）：
   - 主色：Vermilion #B8463A（按钮、链接、强调）
   - 辅色：Gold #C4A265（图标、边框高亮、徽章）
   - 底色：Paper White #FFFDF9（页面背景）
   - 深底：Ink #2C241A（标题、正文）
   - 侧边栏：古籍墨底 #1E1B18
   - 浅金：Gold Light #E8D5B0（分割线、浅色背景）

2. 字体层级（4 档）：
   - --text-xs: 0.8125rem (13px) — 标签、角标、时间戳
   - --text-sm: 0.9375rem (15px) — 辅助文字、描述
   - --text-base: 1rem (16px) — 正文基准
   - --text-lg: 1.125rem (18px) — 页面标题
   - 中文字体栈：Noto Serif SC, STSong, SimSun, serif
   - 代码/数字字体：system-ui monospace

3. 间距收紧（4 档）：
   - Content padding: 16px（原 24px）
   - Hero padding vertical: 60px（原 88px）
   - Card body: 16px 20px（原 20px 28px）
   - Section margin: 24px→32px（原 32px→48px）

4. Layout 尺寸：
   - 侧边栏展开: 240px / 折叠: 64px
   - 内容区最大宽度: 1280px
   - 移动端断点: < 768px 切换为顶部导航

【产出要求】
1. tokens.css — 所有 CSS 变量定义 + 暗色模式覆盖
2. 暗色模式切换逻辑（ThemeContext），存储在 localStorage
3. Ant Design 6 主题覆盖配置（ConfigProvider theme token）
4. 硬编码色值对照表（for ECharts）：tokens.css 变量 ↔ 固定 hex

【验收标准】
- 侧边栏深色底色 #1E1B18，hover 文字金色
- 页面背景宣纸白 #FFFDF9
- 按钮/链接统一朱砂色
- 暗色模式切换无闪烁
- ECharts 图表底色/文字色与主题一致
```

### AI 输出

#### 1. tokens.css

```css
/* ═══════════════════════════════════════════
   文博灵境 — 设计 Token
   国风主题：朱砂 + 鎏金 + 墨色
   注意：ECharts Canvas 不解析 CSS 变量，
   图表组件须使用硬编码对照表（见附录）
   ═══════════════════════════════════════════ */

:root {
  /* ── 色板 ──────────────────────────── */
  --color-vermilion: #B8463A;       /* 朱砂 — 主色：按钮、链接、强调 */
  --color-vermilion-hover: #9A3A2F; /* 朱砂深色 — hover 态 */
  --color-vermilion-light: #F5E6E4; /* 朱砂浅底 — 选中背景 */
  --color-gold: #C4A265;            /* 鎏金 — 辅色：图标高亮、边框、徽章 */
  --color-gold-light: #E8D5B0;      /* 浅金 — 分割线、浅色背景 */
  --color-ink: #2C241A;             /* 墨色 — 标题、正文 */
  --color-paper-white: #FFFDF9;     /* 宣纸白 — 页面背景 */
  --color-sidebar-bg: #1E1B18;      /* 古籍墨底 — 侧边栏 */
  --color-sidebar-text: #C4A265;    /* 侧边栏文字金 */
  --color-sidebar-hover: #2A2622;   /* 侧边栏 hover */

  /* ── 字体 ──────────────────────────── */
  --font-serif: "Noto Serif SC", "STSong", "SimSun", serif;
  --font-mono: "SF Mono", "Cascadia Code", "Consolas", monospace;

  --text-xs: 0.8125rem;   /* 13px — 标签、角标、时间戳 */
  --text-sm: 0.9375rem;   /* 15px — 辅助文字、描述 */
  --text-base: 1rem;      /* 16px — 正文基准 */
  --text-lg: 1.125rem;    /* 18px — 页面标题 */

  /* ── 间距 ──────────────────────────── */
  --spacing-content: 16px;
  --spacing-section: 24px;
  --spacing-card-body: 16px 20px;
  --spacing-hero-y: 60px;

  /* ── Layout ────────────────────────── */
  --sidebar-expanded: 240px;
  --sidebar-collapsed: 64px;
  --content-max-width: 1280px;

  /* ── 圆角 / 阴影 ───────────────────── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-card: 0 2px 8px rgba(44, 36, 26, 0.06);
}

/* ── 暗色模式 ──────────────────────────── */
[data-theme="dark"] {
  --color-paper-white: #1A1815;     /* 暗色背景 */
  --color-ink: #E8D5B0;             /* 浅金文字 */
  --color-sidebar-bg: #141210;      /* 更深侧边栏 */
  --color-sidebar-hover: #1E1B18;
  --color-gold-light: #3A3228;      /* 暗色分割线 */
  --shadow-card: 0 2px 8px rgba(0, 0, 0, 0.3);
}
```

#### 2. ThemeContext.tsx

```typescript
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'dark' ? 'dark' : 'light') as Theme;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

#### 3. Ant Design 6 ConfigProvider 主题覆盖

```typescript
// App.tsx — ConfigProvider 配置
const themeConfig = {
  token: {
    colorPrimary: '#B8463A',         // --color-vermilion
    colorLink: '#B8463A',
    colorLinkHover: '#9A3A2F',
    colorSuccess: '#5B8C5A',
    colorWarning: '#D4A853',
    colorError: '#C43A31',
    fontFamily: '"Noto Serif SC", "STSong", "SimSun", serif',
    fontSize: 16,                     // --text-base
    borderRadius: 8,                  // --radius-md
    colorBgContainer: '#FFFDF9',     // --color-paper-white
    colorText: '#2C241A',            // --color-ink
    colorBorder: '#E8D5B0',          // --color-gold-light
  },
  components: {
    Layout: {
      siderBg: '#1E1B18',
      headerBg: '#FFFDF9',
      bodyBg: '#FFFDF9',
    },
    Menu: {
      darkItemBg: '#1E1B18',
      darkItemSelectedBg: '#2A2622',
      darkItemColor: '#C4A265',
    },
  },
};
```

#### 4. ECharts 硬编码色值对照表

| CSS 变量 | 用途 | 硬编码值（ECharts 使用） |
|----------|------|--------------------------|
| --color-vermilion | 强调色/选中描边 | `#B8463A` |
| --color-gold | 高亮/数据点 | `#C4A265` |
| --color-ink | 标题/坐标轴文字 | `#2C241A` |
| --color-paper-white | 图表背景 | `#FFFDF9` |
| --color-gold-light | 网格线/底纹 | `#E8D5B0` |
| --color-sidebar-bg | 暗色图表背景 | `#1E1B18` |

在 ECharts 组件中统一使用常量声明：
```typescript
// pages/knowledge-graph/TimelineChart.tsx
const INK = '#2C241A';
const PAPER_WHITE = '#FFFDF9';
const GOLD_LIGHT = '#E8D5B0';
const GOLD = '#C4A265';
const VERMILION = '#B8463A';
```

### 改进后评分：90/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 17/20 | 独立会话，命名明确 |
| 指令具体化 | 19/20 | 精确到 hex、rem、px；分层量化 |
| 角色边界 | 13/15 | 前端工程师 + UI 设计视角 |
| 结果导向 | 15/15 | 4 项产出全部交付 |
| 维护机制 | 14/15 | tokens.css 集中管理 + 对照表 |
| 标准流程 | 12/15 | 参考样式来源明确 |

---

## 对话五：非遗识别功能开发

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 文博灵境-非遗识别模块 |
| 会话目的 | 实现拍照识物全链路：上传→AI识别→结果→语音播报 |
| 对应周次 | 第 1 周 Day 3-4 |

### 改进后提示词

```
【会话名称】文博灵境-非遗识别模块

【角色设定】
- 产品经理：定义识别功能的交互流程和字段需求
- 系统架构师：设计文件上传→AI识别→结果存储数据流
- 前端工程师：实现上传组件 + 结果展示组件

【功能需求】PRD-REC-001

1. 用户场景：
   - 用户参观非遗展览，拍一件展品
   - 上传图片后 3 秒内返回识别结果
   - 可查看历史识别记录
   - 支持语音播报识别结果

2. 识别输出字段（5 个）：
   - 非遗品类（19 类之一）
   - 所属年代（具体朝代）
   - 核心工艺（技艺名称）
   - 纹样特征（纹样类型 + 文化寓意）
   - 相关遗产（推荐 1-3 个同类遗产）

3. 文件校验规则：
   - 格式：jpg / png / webp
   - 大小：≤ 10MB
   - 最小尺寸：200 × 200 px（PIL 校验）
   - 不合规返回具体错误提示（非通用"上传失败"）

4. 页面交互要求：
   - 上传区：Ant Design Dragger，支持拖拽和点击，显示格式限制提示
   - 识别中：骨架屏 + 进度文字（"正在识别……"）
   - 结果区：5 字段卡片，非遗品类高亮显示
   - 语音：播放按钮（AudioPlayer 组件），底部浮动
   - 历史：分页列表，时间倒序

5. 后端技术要求：
   - 图片存储：data/uploads/images/，访问路径 /static/images/
   - 识别完成后 fire-and-forget 触发戳章检查
   - TTS 语音在文字结果返回后生成，输出 mp3
   - 所有 AI 调用须支持 mock_mode()

【产出清单】
□ 后端：api/recognition.py（3 个路由）
□ 后端：services/ai/recognition.py（Qwen-VL 调用 + prompt 模板）
□ 后端：models/recognition.py（RecognitionRecord 表）
□ 前端：pages/Recognition.tsx（完整交互页面）
□ 前端：components/recognition/AudioPlayer.tsx（播放控件）
□ Mock 数据：data/mock/recognition_analyze_mock.json

【验收标准】
- 上传合规图片 → 3s 内返回 5 个识别字段
- 上传违规图片 → 返回具体错误提示
- 识别完成后 → passport 触发戳章（异步）
- 语音播报可播放，音质清晰
- MOCK_MODE=true 时使用 mock 数据正常展示
```

### AI 输出

#### 1. 数据流设计

```
POST /api/recognition/upload
  │
  ├─ 1. 文件校验
  │   ├─ check ext ∈ {jpg, png, webp}    → 否则 400 "仅支持 JPG/PNG/WebP 格式"
  │   ├─ check size ≤ 10MB               → 否则 400 "图片大小不能超过 10MB"
  │   └─ check PIL dimensions ≥ 200×200  → 否则 400 "图片尺寸需 ≥ 200×200 px"
  │
  ├─ 2. 保存文件 → data/uploads/images/{uuid}.{ext}
  │                            ↕
  │                    访问路径: /static/images/{uuid}.{ext}
  │
  ├─ 3. AI 识别（mock_mode 走本地数据）
  │   └─ Qwen-VL-Max (services/ai/recognition.py)
  │       → {category, era, craft, pattern_type, cultural_meaning, related_items}
  │
  ├─ 4. 写入 DB → recognition_records
  │
  ├─ 5. fire-and-forget
  │   └─ _trigger_stamp_check(user_id)  # 独立线程 + 独立 SessionLocal
  │
  └─ 6. 返回 JSON
      { id, category, era, craft, pattern_type, cultural_meaning,
        related_items, image_url, voice_url: null }
```

#### 2. 后端 API（api/recognition.py）

```python
# POST /api/recognition/upload
@router.post("/upload", response_model=RecognitionResponse)
def upload_recognition(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. 文件校验
    _validate_image(file)

    # 2. 保存文件
    image_path = _save_upload(file)

    # 3. AI 识别
    result = analyze_image(image_path)

    # 4. 写入 DB
    record = RecognitionRecord(
        user_id=current_user.id,
        image_path=image_path,
        **result,
    )
    db.add(record)
    db.commit()

    # 5. fire-and-forget 触发戳章
    _trigger_stamp_check(current_user.id)

    return record

# GET /api/recognition/history — 分页列表
# GET /api/recognition/{id} — 详情 + TTS
```

#### 3. 前端页面结构（Recognition.tsx）

```
┌─────────────────────────────────────────────┐
│  🏺 非遗识别                                  │
│  上传一张非遗相关图片，AI 为您智能识别           │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐     │
│  │      📤  点击或拖拽上传图片           │     │
│  │      支持 JPG / PNG / WebP           │     │
│  │      大小 ≤ 10MB，尺寸 ≥ 200×200     │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  （识别中 → 骨架屏 + "正在识别……"）             │
│                                               │
│  ┌────────── 识别结果 ──────────┐             │
│  │ 📋 品类：剪纸                 │             │
│  │ 📅 年代：清代                 │             │
│  │ 🔧 工艺：阴刻剪纸             │             │
│  │ 🎨 纹样：窗花·蝙蝠纹 → 寓"福" │             │
│  │ 🔗 相关：【陕西窗花·五福捧寿】 │             │
│  └──────────────────────────────┘             │
│                                               │
│  🔊 语音播报  [▶ 播放]                         │
├─────────────────────────────────────────────┤
│  历史记录                                     │
│  ┌────┬──────┬──────┬────────┐               │
│  │ 图片│ 品类 │ 年代 │ 时间    │               │
│  ├────┼──────┼──────┼────────┤               │
│  │ 🖼 │ 剪纸 │ 清代 │ 06-09  │               │
│  │ 🖼 │ 瓷器 │ 宋代 │ 06-08  │               │
│  └────┴──────┴──────┴────────┘               │
└─────────────────────────────────────────────┘
```

#### 4. AudioPlayer 组件接口

```typescript
interface AudioPlayerProps {
  recordId: number;           // 识别记录 ID
  onVoiceGenerated?: (url: string) => void;
}
// 行为：
// 1. 首次渲染 → GET /api/recognition/{id} 检查 voice_url
// 2. 有 voice_url → 显示播放按钮
// 3. 无 voice_url → 显示"生成语音"按钮 → POST 触发 TTS → 显示播放按钮
```

### 改进后评分：91/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 18/20 | 分角色协作，产出清单明确 |
| 指令具体化 | 19/20 | 字段级定义、校验规则量化、交互状态枚举 |
| 角色边界 | 14/15 | 产品/架构师/前端三角色，各司其职 |
| 结果导向 | 15/15 | 6 项产出 + 5 条验收标准，可逐条打勾 |
| 维护机制 | 13/15 | Mock 数据要求 + PRD 编号可追溯 |
| 标准流程 | 12/15 | PRD 命名规范 + 状态覆盖率（加载/空/错误） |

---

## 对话六：Bug 修复 — ORM 跨线程崩溃

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 修复-SSE聊天ORM跨线程报错 |
| 会话目的 | 解决 "Instance is not bound to a Session" 致命错误 |
| 对应周次 | 第 1 周 Day 4-5 |

### 改进后提示词

```
【会话名称】修复-SQLAlchemy-ORM跨线程错误

【问题描述】
- 模块：后端 chat.py SSE event_stream()
- 错误：sqlalchemy.exc.InvalidRequestError: Instance <ChatSession> is not bound to a Session
- 触发条件：SSE 流式聊天中，run_in_executor 子线程访问 ORM 实例
- 出现频次：每次 SSE 聊天请求必现

【复现步骤】
1. 登录 → 进入技艺工坊
2. 选择任一位传承人 → 发送消息
3. SSE 连接后 2-3 秒崩溃，前端无响应
4. 终端输出上述错误

【修复要求】
1. 定位所有跨线程传递 ORM 实例的代码（不限于 chat.py）
2. 统一改为：主线程 commit 前提取所有值为普通 Python 类型
   → run_in_executor 只捕获 str/int/dict
3. 数据库写入操作改为 fire-and-forget 模式：
   - 只传主键 ID
   - 子线程内建独立 SessionLocal()
   - try/except/rollback/finally close
4. 修复后将"ORM 跨线程铁律"约束写入 CLAUDE.md，
   包含错误示例 ❌ 和正确示例 ✅

【止损规则】
- 若本次修改 3 次仍未解决，立即停止，
  梳理完整代码调用链后新开会话重新处理
- 修改前先 git stash 保存当前修改

【验收标准】
- 发送聊天消息 SSE 正常返回
- 识别/伴游/推荐等模块不受影响
- 所有 fire-and-forget 线程正常完成（无僵尸线程）
```

### AI 输出

#### 1. 根因分析

```
调用链追踪：
chat.py: event_stream() [主线程, async]
  └─ loop.run_in_executor(ThreadPoolExecutor, lambda: execute_tool(...))
       └─ [工作线程] execute_tool() 尝试访问 db.query(ChatSession)...
            → ❌ Instance <ChatSession> is not bound to a Session

根因：
  主线程的 db Session 在 run_in_executor 启动时可能已关闭/过期，
  子线程无法使用主线程的 ORM 实例。

影响范围扫描：
  ❌ chat.py: event_stream() — lambda 捕获 db + session
  ❌ recognition.py: _trigger_stamp_check() — 未独立建 Session
  ❌ companion.py: _gather_journey() — 同上
```

#### 2. 修复：chat.py event_stream() 修改

```python
# ❌ 修复前（致命错误）
@router.post("/sessions/{id}/send")
async def send_message(id: int, body: SendMessageRequest, db: Session = Depends(get_db), ...):
    session = db.query(ChatSession).filter_by(id=id).first()
    db.commit()  # session 已过期

    async def event_stream():
        # 错误！session 已过期，db 可能跨线程
        result = await loop.run_in_executor(None, lambda: execute_tool(body.content, session, db))

# ✅ 修复后
@router.post("/sessions/{id}/send")
async def send_message(id: int, body: SendMessageRequest, db: Session = Depends(get_db), ...):
    session = db.query(ChatSession).filter_by(id=id).first()

    # ── commit 前提取所有 ORM 字段为普通 Python 类型 ──
    session_persona: str = session.persona           # ✅ str
    user_id: int = session.user_id                   # ✅ int
    inheritor_info: dict = get_inheritor_config(session_persona)  # ✅ dict
    db.commit()  # 此后不再访问 session 的任何属性

    # ── 时间戳更新 → fire-and-forget（只传主键） ──
    _update_session_timestamp(session_id=id)

    async def event_stream():
        # run_in_executor 只捕获 str/int/dict（线程安全）
        result = await loop.run_in_executor(
            None,
            lambda: execute_tool(body.content, inheritor_info)  # ✅ 只传基础类型
        )
```

#### 3. 通用 fire-and-forget 模板

```python
import threading
from app.models.database import SessionLocal

def _update_session_timestamp(session_id: int):
    """只传主键，独立线程 + 独立 Session"""
    def _run():
        db_local = SessionLocal()
        try:
            db_local.query(ChatSession).filter_by(id=session_id).update(
                {"updated_at": datetime.utcnow()}
            )
            db_local.commit()
        except Exception:
            db_local.rollback()
        finally:
            db_local.close()
    threading.Thread(target=_run, daemon=True).start()
```

#### 4. 写入 CLAUDE.md 的铁律条款

```markdown
### 🔴 ORM 跨线程铁律（最严重）

**绝对禁止跨线程传递 ORM 实例。只传主键 ID（int/str/dict），子线程内建独立 SessionLocal()。**

# ❌ 致命错误：将请求线程的 db/ORM 实例传入 run_in_executor
result = await loop.run_in_executor(None, lambda: execute_tool(payload, db))
# → "Instance <ChatSession> is not bound to a Session"

# ✅ 正确：只传基础类型，子线程内建独立 session
result = await loop.run_in_executor(None, lambda: execute_tool(payload, inheritor_info))
# execute_tool 内部: db = SessionLocal(); try: ... finally: db.close()

# ❌ db.commit() 后访问 ORM 属性 → 隐式 refresh 失败
db.commit()
print(session.persona)  # 致命！

# ✅ commit 前提取到普通变量
session_persona: str = session.persona
db.commit()
# 后续用 session_persona，绝不访问 session
```

### 改进后评分：88/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 18/20 | 独立 Bug 会话 + 自定义名称；止损规则明确 |
| 指令具体化 | 17/20 | 错误日志/复现步骤/触发条件完整 |
| 角色边界 | 12/15 | 后端 bug，范围明确 |
| 结果导向 | 15/15 | 4 条验收标准可逐条验证 |
| 维护机制 | 16/15 | 写入 CLAUDE.md + ❌✅ 示例模板 |
| 标准流程 | 10/15 | 3 次止损规则 + git 前置操作 |

---

## 对话七：前端路由与权限体系

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 文博灵境-前端路由权限设计 |
| 会话目的 | 设计 15 页面路由结构、权限分级守卫、全局状态管理 |
| 对应周次 | 第 1 周 Day 3-4 |

### 改进后提示词

```
【会话名称】文博灵境-前端路由权限设计

【角色设定】
你是前端工程师，负责路由架构和权限守卫实现。

【设计要求】
1. 路由表（15 页面）：

| 路径 | 页面 | 权限 | 说明 |
|------|------|------|------|
| / | Home | Public | 首页推荐流 |
| /login | Login | Public | 登录（已登录自动跳转 /） |
| /register | Register | Public | 注册 |
| /exhibition | ExhibitionHall | Public | 非遗展馆 |
| /knowledge-graph | KnowledgeGraph | Public | 知识图谱 |
| * | NotFound | Public | 404 |
| /recognition | Recognition | Auth | 非遗识别 |
| /creative-studio | CreativeStudio | Auth | 文创生成 |
| /workshop | Workshop | Auth | 技艺工坊 |
| /workshop/wizard | CustomInheritorWizard | Auth | 定制传承人 |
| /restoration | DigitalRestoration | Auth | 数字修复 |
| /passport | Passport | Auth | 数字护照 |
| /cultivation | Cultivation | Auth | 修习之路 |
| /user-center/:tab? | UserCenter | Auth | 个人中心 |

2. 权限守卫：
   - ProtectedRoute 组件：未登录 → Redirect /login?returnUrl=原路径
   - 登录成功后自动跳转 returnUrl（如有）
   - API 响应拦截器 401 → 清空 token + user + 跳转 /login（兜底）

3. 状态管理架构：
   - 全局状态：仅使用 React Context，禁用 Zustand/Redux/React Query
   - Provider 嵌套顺序（严格）：
     ConfigProvider(antd主题) → ThemeProvider(暗色) → AppProvider →
     AuthProvider → CultivationProvider → CompanionProvider →
     ErrorBoundary → 路由
   - 每个 Context 独立文件（contexts/ 目录）

4. 错误处理：
   - 全局 ErrorBoundary 包裹所有路由
   - 页面级 404 → 自定义 SVG 插画 + "返回首页"按钮
   - 路由过渡动画：Framer Motion AnimatePresence

【产出清单】
□ contexts/AuthContext.tsx（登录态 + token 管理）
□ contexts/ThemeContext.tsx（暗色模式 + localStorage）
□ components/common/ProtectedRoute.tsx（权限守卫）
□ components/common/ErrorBoundary.tsx（全局错误捕获）
□ components/layout/MainLayout.tsx（Header + Sidebar + 内容区）
□ pages/NotFound.tsx（自定义 404）
□ App.tsx（路由配置入口）

【验收标准】
- 未登录访问 /recognition → 跳转 /login?returnUrl=/recognition
- 登录成功 → 回到 /recognition
- 已登录访问 /login → 跳转 /
- API 返回 401 → 自动清空状态并跳转 /login
- 页面切换有过渡动画
```

### AI 输出

#### 1. 路由配置（App.tsx）

```typescript
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// 公开页面（无需登录）
const publicRoutes = [
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/exhibition', element: <ExhibitionHall /> },
  { path: '/knowledge-graph', element: <KnowledgeGraph /> },
  { path: '*', element: <NotFound /> },
];

// 需登录页面
const authRoutes = [
  { path: '/recognition', element: <Recognition /> },
  { path: '/creative-studio', element: <CreativeStudio /> },
  { path: '/workshop', element: <Workshop /> },
  { path: '/workshop/wizard', element: <CustomInheritorWizard /> },
  { path: '/restoration', element: <DigitalRestoration /> },
  { path: '/passport', element: <Passport /> },
  { path: '/cultivation', element: <Cultivation /> },
  { path: '/user-center/:tab?', element: <UserCenter /> },
];

function App() {
  return (
    <ConfigProvider theme={themeConfig}>
      <ThemeProvider>
        <AppProvider>
          <AuthProvider>
            <CultivationProvider>
              <CompanionProvider>
                <ErrorBoundary>
                  <BrowserRouter>
                    <AnimatedRoutes />
                  </BrowserRouter>
                </ErrorBoundary>
              </CompanionProvider>
            </CultivationProvider>
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>
    </ConfigProvider>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* 公开路由 */}
        {publicRoutes.map(r => (
          <Route key={r.path} path={r.path} element={
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <MainLayout>{r.element}</MainLayout>
            </motion.div>
          } />
        ))}
        {/* 需登录路由 → ProtectedRoute 包裹 */}
        {authRoutes.map(r => (
          <Route key={r.path} path={r.path} element={
            <ProtectedRoute>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <MainLayout>{r.element}</MainLayout>
              </motion.div>
            </ProtectedRoute>
          } />
        ))}
      </Routes>
    </AnimatePresence>
  );
}
```

#### 2. ProtectedRoute 组件

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // 未登录 → 跳转 /login，带上原始路径
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  return <>{children}</>;
}
```

#### 3. API 响应拦截器（services/api.ts）— 401 兜底

```typescript
import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// 请求拦截器：自动附 token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401 自动清理 + 跳转（兜底）
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';  // 硬跳转，清空所有状态
    }
    return Promise.reject(error);
  }
);
```

#### 4. Provider 嵌套顺序图

```
ConfigProvider          ← Ant Design 6 主题 Token
  └─ ThemeProvider      ← 暗色模式切换 (localStorage)
      └─ AppProvider    ← 全局应用状态
          └─ AuthProvider        ← 登录态 + JWT
              └─ CultivationProvider  ← XP/等级 (Phase 2)
                  └─ CompanionProvider ← AI 伴游 (Phase 2)
                      └─ ErrorBoundary  ← 渲染错误兜底
                          └─ BrowserRouter → 15 页面
```

### 改进后评分：89/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 17/20 | 独立会话 + 规范命名 |
| 指令具体化 | 18/20 | 15 个路由全表列出 + Provider 顺序精确 |
| 角色边界 | 14/15 | 前端工程师边界清晰 |
| 结果导向 | 15/15 | 7 项产出 + 5 条验收标准 |
| 维护机制 | 13/15 | Context 架构文档化，嵌套顺序约束 |
| 标准流程 | 12/15 | 路由表结构规范（路径+页面+权限+说明） |

---

## 对话八：数字护照印章系统设计

### 基本信息

| 项 | 内容 |
|----|------|
| 会话名称 | 文博灵境-数字护照系统 |
| 会话目的 | 设计印章触发→收集→展示的游戏化激励系统 |
| 对应周次 | 第 1 周 Day 5 |

### 改进后提示词

```
【会话名称】文博灵境-数字护照系统

【角色设定】
- 产品经理：定义印章体系、触发规则、用户激励路径
- 系统架构师：设计触发→存储→展示的数据链路
- 前端工程师：实现护照页面交互和动画

【产品需求】
1. 印章体系（首期 12 枚）：
   - 探索者：首次使用非遗识别
   - 创作者：首次生成 AI 作品
   - 修复师：首次完成数字修复
   - 收藏家：收藏满 10 个遗产
   - 传承者：与传承人对话满 5 次
   - 博学者：浏览知识图谱 3 个以上技艺
   - 开拓者：首次创建定制传承人
   - 守护者：连续 3 天登录
   - 匠人：使用 3 种不同技艺工坊工具
   - 鉴赏家：发布 1 个作品到展馆
   - 考据家：提交 1 个知识拓展任务
   - 宗师：累计获得 100 XP

2. 触发机制：
   - 各功能模块完成后 fire-and-forget 调用 `_trigger_stamp_check(user_id)`
   - 独立线程 + 独立 SessionLocal()，不阻塞主请求
   - 重复触发幂等（同印章不重复插入）

3. 数据模型（passport_stamps 表）：
   | 字段 | 类型 | 说明 |
   | user_id | INTEGER FK | 用户外键 |
   | stamp_id | VARCHAR(32) | 印章标识 |
   | earned_at | DATETIME | 获得时间 |
   | displayed | BOOLEAN | 是否已查看（用于红点提示） |

4. 前端交互：
   - 护照封面：暗红皮质纹理背景 + 用户姓名烫金
   - 印章网格：3 列，未获得灰色半透明遮罩
   - 获得动画：印章盖下效果（Framer Motion scale + rotate）
   - 新获得红点：Passport 菜单项 Badge

【产出清单】
□ config/stamps.json（12 枚印章定义：名称、图标、触发条件、描述）
□ models/passport.py（PassportStamp 表）
□ api/passport.py（GET /status + GET /stamps + POST /earn）
□ services/passport_stamp_checker.py（触发检查逻辑）
□ pages/Passport/index.tsx（护照页面 + 印章动画）
□ 各触发点嵌入 _trigger_stamp_check()（识别/生成/修复/收藏…）

【验收标准】
- 首次识别后 passport_stamps 表自动插入"探索者"记录
- 重复识别不会插入重复记录
- 护照页面正确展示 12 枚印章的获得/未获得状态
- 获得新印章时菜单有红点提示
```

### AI 输出

#### 1. stamps.json 配置

```json
[
  {
    "id": "explorer",
    "name": "探索者",
    "icon": "🔍",
    "description": "首次使用非遗识别功能，迈出探索第一步",
    "condition": {"type": "first_action", "action": "recognition"},
    "order": 1
  },
  {
    "id": "creator",
    "name": "创作者",
    "icon": "🎨",
    "description": "首次使用 AI 生成非遗风格作品",
    "condition": {"type": "first_action", "action": "generation"},
    "order": 2
  },
  {
    "id": "restorer",
    "name": "修复师",
    "icon": "🔧",
    "description": "首次完成数字修复，让破损文物重获新生",
    "condition": {"type": "first_action", "action": "restoration"},
    "order": 3
  },
  {
    "id": "collector",
    "name": "收藏家",
    "icon": "📚",
    "description": "收藏满 10 个非遗遗产",
    "condition": {"type": "count", "action": "favorite", "threshold": 10},
    "order": 4
  },
  {
    "id": "inheritor",
    "name": "传承者",
    "icon": "🤝",
    "description": "与传承人对话满 5 次",
    "condition": {"type": "count", "action": "chat_session", "threshold": 5},
    "order": 5
  },
  {
    "id": "scholar",
    "name": "博学者",
    "icon": "📖",
    "description": "浏览知识图谱 3 个以上技艺",
    "condition": {"type": "count", "action": "technique_view", "threshold": 3},
    "order": 6
  },
  {
    "id": "pioneer",
    "name": "开拓者",
    "icon": "🛠",
    "description": "创建你的第一位定制传承人",
    "condition": {"type": "first_action", "action": "custom_inheritor"},
    "order": 7
  },
  {
    "id": "guardian",
    "name": "守护者",
    "icon": "🛡",
    "description": "连续 3 天登录系统",
    "condition": {"type": "streak", "action": "login", "days": 3},
    "order": 8
  },
  {
    "id": "craftsman",
    "name": "匠人",
    "icon": "⚒",
    "description": "使用 3 种不同技艺工坊工具",
    "condition": {"type": "count_distinct", "action": "tool_usage", "threshold": 3},
    "order": 9
  },
  {
    "id": "connoisseur",
    "name": "鉴赏家",
    "icon": "🏅",
    "description": "发布 1 个作品到非遗展馆",
    "condition": {"type": "first_action", "action": "publish_to_exhibition"},
    "order": 10
  },
  {
    "id": "researcher",
    "name": "考据家",
    "icon": "📝",
    "description": "提交 1 个知识拓展任务",
    "condition": {"type": "first_action", "action": "expansion_submit"},
    "order": 11
  },
  {
    "id": "grandmaster",
    "name": "宗师",
    "icon": "👑",
    "description": "累计获得 100 XP",
    "condition": {"type": "xp_threshold", "threshold": 100},
    "order": 12
  }
]
```

#### 2. 触发检查逻辑（stamp_checker.py）

```python
import json
import threading
from pathlib import Path
from app.models.database import SessionLocal
from app.models.passport import PassportStamp

STAMPS_CONFIG = json.loads(
    (Path(__file__).parent.parent / "config" / "stamps.json").read_text("utf-8")
)

def _trigger_stamp_check(user_id: int):
    """Fire-and-forget：检查用户是否满足新印章条件"""
    def _run():
        db = SessionLocal()
        try:
            earned_ids = {
                s.stamp_id for s in
                db.query(PassportStamp).filter_by(user_id=user_id).all()
            }
            for stamp in STAMPS_CONFIG:
                if stamp["id"] in earned_ids:
                    continue  # 已获得，跳过
                if _check_condition(db, user_id, stamp["condition"]):
                    db.add(PassportStamp(
                        user_id=user_id,
                        stamp_id=stamp["id"],
                        displayed=False,
                    ))
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()
    threading.Thread(target=_run, daemon=True).start()

def _check_condition(db, user_id: int, condition: dict) -> bool:
    cond_type = condition["type"]
    if cond_type == "first_action":
        return _check_first_action(db, user_id, condition["action"])
    elif cond_type == "count":
        return _check_count(db, user_id, condition["action"], condition["threshold"])
    elif cond_type == "streak":
        return _check_streak(db, user_id, condition["action"], condition["days"])
    # ... 其他条件类型
    return False
```

#### 3. 前端 Passport 页面结构

```
┌─────────────────────────────────────────────────┐
│                                                  │
│    ┌──────────────────────────────┐              │
│    │                              │              │
│    │   文 博 灵 境                │              │
│    │   数 字 护 照                │              │
│    │                              │              │
│    │   持 照 人：张三              │              │
│    │   获得印章：5 / 12            │              │
│    │                              │              │
│    └──────────────────────────────┘              │
│     暗红皮质纹理背景 + 烫金文字                     │
│                                                  │
│   ┌──────┐ ┌──────┐ ┌──────┐                   │
│   │ 🔍  │ │ 🎨  │ │ 🔧  │                    │
│   │探索者│ │创作者│ │修复师│                    │
│   │✅    │ │✅    │ │✅    │                    │
│   └──────┘ └──────┘ └──────┘                   │
│   ┌──────┐ ┌──────┐ ┌──────┐                   │
│   │ 📚  │ │ 🤝  │ │ 📖  │                    │
│   │收藏家│ │传承者│ │博学者│                    │
│   │✅    │ │✅    │ │⬜    │ ← 灰色遮罩+半透明      │
│   └──────┘ └──────┘ └──────┘                   │
│   ┌──────┐ ┌──────┐ ┌──────┐                   │
│   │ 🛠  │ │ 🛡  │ │ ⚒   │                    │
│   │开拓者│ │守护者│ │ 匠人 │                    │
│   │⬜    │ │⬜    │ │⬜    │                    │
│   └──────┘ └──────┘ └──────┘                   │
│   ┌──────┐ ┌──────┐ ┌──────┐                   │
│   │ 🏅  │ │ 📝  │ │ 👑  │                    │
│   │鉴赏家│ │考据家│ │ 宗师 │                    │
│   │⬜    │ │⬜    │ │⬜    │                    │
│   └──────┘ └──────┘ └──────┘                   │
│                                                  │
└─────────────────────────────────────────────────┘
```

#### 4. 印章获得动画（Framer Motion）

```typescript
// 印章盖下效果
const stampVariants = {
  hidden: {
    scale: 3,
    rotate: -30,
    opacity: 0,
  },
  visible: {
    scale: 1,
    rotate: 0,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
      duration: 0.6,
    },
  },
};

// 新获得 → 红点提示
<Badge dot={!stamp.displayed}>
  <motion.div variants={stampVariants} initial="hidden" animate="visible">
    {stamp.icon}
  </motion.div>
</Badge>
```

### 改进后评分：90/100

| 维度 | 得分 | 改进点 |
|------|------|------|
| 会话拆分管理 | 17/20 | 独立会话 + 标准命名 |
| 指令具体化 | 19/20 | 12 枚印章逐一定义 + 数据表字段精确 |
| 角色边界 | 14/15 | 产品/架构师/前端三角色分工 |
| 结果导向 | 15/15 | 6 项产出 + 4 条验收标准 |
| 维护机制 | 13/15 | stamps.json 可扩展，后续加印章只需加配置 |
| 标准流程 | 12/15 | 产品需求→架构设计→实现标准链路 |

---

## 总结：8 个关键对话评分对比

| 序号 | 会话名称 | 改进得分 | 核心提升 |
|------|----------|----------|----------|
| 1 | 项目架构设计 | 88 | 从一句话到 Mermaid 架构图 + 完整目录 + 通信规则 |
| 2 | 数据库设计 | 86 | 从列举表名到 PlantUML ER 图 + 字段清单 + 数据字典 |
| 3 | AI 服务层设计 | 85 | 从"统一一下"到 base.py 骨架 + Mock 规范 + 故障隔离 |
| 4 | 前端主题设计 | 90 | 从"美化一下"到 Design Token 系统 + 硬编码对照表 |
| 5 | 非遗识别模块 | 91 | 从一句话到 PRD + 数据流 + 6 项产出清单 |
| 6 | ORM 跨线程 Bug 修复 | 88 | 从"修一下"到根因分析 + 全局修复 + CLAUDE.md 铁律 |
| 7 | 路由权限体系 | 89 | 从"配好路由"到 15 路由全表 + Provider 嵌套图 |
| 8 | 数字护照系统 | 90 | 从"某些操作"到 12 枚印章精确定义 + 触发逻辑 |

**平均改进得分：88.4**

---

## 提示词改进核心原则

1. **拒绝模糊词**：禁用"优化""美化""加一个"，全部替换为量化指标
2. **角色先声明**：每次会话第一句声明角色（产品/架构师/前端/DBA），角色互不越界
3. **产出清单化**：每份提示词末尾附 □ 清单，可逐条打勾确认完成
4. **验收可测试**：每份提示词附验收标准，从"看着不错"变为"触发 X → 出现 Y"
5. **维护有章程**：关键约束写入 CLAUDE.md（ORM 铁律、硬编码色值、fire-and-forget 模板）
6. **止损有规则**：Bug 修复 3 次未解决 → 停止 → 梳理 → 新开会话

---

*文档日期：2026-06-30*  
*对应项目进度：第 1 周（2026-06-09 ~ 2026-06-13）*
