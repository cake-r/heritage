# 非遗数字交互与文创生成系统 — 实施计划

> 14天弹性排期 | 单人开发 | 按模块拆分，完成一个取下一个

---

## 一、开发节奏总览

不按天死板分配，按模块链式推进。每条任务完成后标记，从依赖已满足的待办中取下一个。

```
阶段A: 骨架    阶段B: 核心P0                      阶段C: 进阶P1      阶段D: 收尾
[1]────────→  [2][3][4][5][6][7][8][9]────────→  [10][11][12]──→  [13][14]
  1天            约8天                               约3天             约2天
```

实际天数只是参考。某天状态好就多做，某天卡住了就少做，14天是弹性总长度。

---

## 二、任务清单

每个任务格式: `[编号] [依赖] 任务名 — 预计耗时 — 产出物`

---

### 阶段A：项目骨架 (任务1)

```
┌─────────────────────────────────────────────────────────┐
│ 任务1  无依赖                                              │
│ 项目骨架搭建  · 1天                                        │
│                                                          │
│ 后端:                                                     │
│ □ FastAPI空项目 + main.py + config.py                    │
│ □ requirements.txt (fastapi/uvicorn/sqlalchemy/pydantic/ │
│   python-jose/pillow/openai httpx/python-multipart)       │
│ □ .env.example (DASHSCOPE_KEY/DEEPSEEK_KEY/SECRET_KEY等) │
│ □ Dockerfile                                             │
│                                                          │
│ 前端:                                                     │
│ □ Vite + React + TypeScript 项目初始化                    │
│ □ 安装: antd/tailwindcss/framer-motion/react-router-dom  │
│   axios/echarts/react-echarts/react-markdown/react-easy-crop│
│ □ tailwind.config.js + Ant Design主题定制(国风配色)       │
│ □ Dockerfile                                             │
│                                                          │
│ 基础设施:                                                  │
│ □ docker-compose.yml (nginx:前端 + uvicorn:后端)         │
│ □ .gitignore + Git init                                  │
│ □ 前端路由骨架: MainLayout + 6个空页面 + React Router     │
│ □ 跑通"前端请求 → Nginx代理 → 后端响应"链路                │
└─────────────────────────────────────────────────────────┘
```

---

### 阶段B：核心P0模块 (任务2-9)

---

```
┌─────────────────────────────────────────────────────────┐
│ 任务2  依赖: 任务1                                        │
│ 数据库 + 鉴权  · 1天                                      │
│                                                          │
│ 数据库 (SQLAlchemy 同步 + SQLite):                        │
│ 建9张表，具体定义见附录A                                   │
│ □ User / RecognitionRecord / GeneratedWork              │
│ □ ChatSession / ChatMessage / HeritageItem              │
│ □ UserUpload / Favorite / UserSettings                  │
│ □ database.py (engine + session工厂 + Base)             │
│ □ 启动时自动建表 (Base.metadata.create_all)              │
│                                                          │
│ 鉴权:                                                     │
│ □ POST /api/auth/register  (username+password → token)  │
│ □ POST /api/auth/login     (username+password → token)  │
│ □ GET  /api/auth/me        (Bearer token → user info)   │
│ □ JWT签发/验证 (python-jose, 24h过期)                    │
│ □ get_current_user 依赖注入                               │
│                                                          │
│ 种子脚本:                                                  │
│ □ scripts/generate_knowledge.py                          │
│   (调DeepSeek批量生成20项非遗JSON → 写入heritage_items表) │
│ □ 跑一次，验证数据入库                                    │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务3  依赖: 任务2                                        │
│ AI服务层封装  · 1天                                       │
│                                                          │
│ services/ai/base.py — AI服务基类                          │
│ □ 统一重试 (最多3次，指数退避)                              │
│ □ 统一超时 (默认30s，生图120s)                             │
│ □ 统一日志 (请求参数/耗时/响应状态码)                       │
│ □ Mock模式支持 (MOCK_MODE=true时读本地JSON)                │
│                                                          │
│ services/ai/recognition.py — Qwen-VL-Max                 │
│ □ recognize(image_path) → {category, confidence,          │
│    top3, features[], raw_description}                     │
│                                                          │
│ services/ai/llm.py — DeepSeek-V3                          │
│ □ chat(messages, stream=False) → str                     │
│ □ chat_stream(messages) → Generator[str]                  │
│ □ generate_explanation(category, features) →             │
│    {history, technique, inheritor, meaning}              │
│                                                          │
│ services/ai/image_gen.py — 通义万相2.1                     │
│ □ text_to_image(params) → [image_urls]                   │
│ □ image_to_image(ref_image, params) → [image_urls]       │
│                                                          │
│ services/ai/tts.py — CosyVoice 3                          │
│ □ synthesize(text, speed) → audio_file_path              │
│                                                          │
│ services/ai/prompt_builder.py                             │
│ □ build_creation_prompt(style, elements, palette,         │
│    composition, intensity) → full_prompt                 │
│ □ 风格映射表: 剪纸/苏绣/皮影/... → 视觉描述词               │
│ □ 元素映射表: 祥云/牡丹/回纹/... → 视觉描述词               │
│                                                          │
│ 每个服务写一个简单的 pytest 单测 (Mock模式)                 │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务4  依赖: 任务3                                        │
│ 模块①后端: 识别+讲解API  · 0.5天                           │
│                                                          │
│ POST /api/recognition/upload                              │
│   请求: multipart/form-data, file: image_file             │
│   响应: {                                                 │
│     "id": 1,                                              │
│     "image_url": "/static/uploads/images/xxx.jpg",        │
│     "category": "苏绣",                                   │
│     "confidence": 0.94,                                   │
│     "top3": [{"category":"苏绣","confidence":0.94},...],  │
│     "features": ["平针绣","套针","抢针"],                  │
│     "explanation": {                                      │
│       "history": "苏绣起源于...",                          │
│       "technique": "苏绣技法以平绣、乱针绣...",             │
│       "inheritor": "当代苏绣代表性传承人...",               │
│       "meaning": "苏绣承载了江南水乡..."                    │
│     },                                                    │
│     "heatmap_url": "/static/heatmap/xxx.png",             │
│     "voice_url": "/static/voices/xxx.mp3",                │
│     "related": {                                          │
│       "creations": [{"style":"苏绣","label":"试试苏绣风格..."}],│
│       "exhibits": [{"id":3,"name":"苏绣双面绣"}]           │
│     }                                                     │
│   }                                                       │
│                                                           │
│ 处理流程:                                                  │
│   上传 → 保存原图 → Qwen-VL识别 → 热力图后处理(任务7做)     │
│   → DeepSeek生成讲解 → CosyVoice合成语音                   │
│   → 查关联推荐 → 存recognition_records → 返回              │
│                                                           │
│ GET /api/recognition/history?page=1&page_size=10          │
│ GET /api/recognition/{id}                                 │
│   (同上响应结构，单条)                                      │
│                                                           │
│ 文件规格限制:                                               │
│   MAX_SIZE=10MB, FORMATS=["jpg","jpeg","png","webp"]      │
│   PIL校验: 宽度≥200px, 高度≥200px                          │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务5  依赖: 任务4                                        │
│ 模块①前端: 识别页面  · 1天                                 │
│                                                          │
│ 路由: /recognition                                        │
│                                                          │
│ 页面状态:                                                  │
│   step: 'upload' | 'loading' | 'result'                  │
│                                                          │
│ 上传区 (step=upload):                                     │
│ □ Ant Design Upload.Dragger                              │
│ □ 拖拽/点击上传, beforeUpload校验格式+尺寸                 │
│ □ react-easy-crop 裁剪 (可选,上传后弹出模态框)              │
│ □ 上传按钮 → POST recognition/upload → setStep('loading') │
│                                                          │
│ 加载态 (step=loading):                                     │
│ □ 骨架屏 + "AI正在识别中..." 进度文案                        │
│ □ 流程文案轮播: "分析纹样特征→匹配非遗品类→生成文化讲解"      │
│                                                          │
│ 结果页 (step=result):                                     │
│ □ 上半部分: 原图 + 热力图 (Tab切换) + 置信度Tag             │
│ □ 中部: Tab切换4段讲解(react-markdown) + 语音播放器         │
│   AudioPlayer: 播放/暂停/进度/语速(0.5x/1x/1.5x)           │
│ □ 下半部分: Top3候选 + 关联推荐(跳转文创/展厅)               │
│ □ 底部: "重新识别"按钮                                      │
│                                                          │
│ 热力图交互 (task7做完后补):                                 │
│ □ 图片上叠加透明热力区域, hover显示特征名称tooltip           │
│ □ 用图片热点区域定位实现 (纯CSS+JS, 不需要额外库)            │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务6  依赖: 任务3                                        │
│ 模块②后端: 文创生成API  · 0.5天                            │
│                                                          │
│ POST /api/generation/text-to-image                        │
│   请求: {                                                 │
│     "base_style": "苏绣",                                 │
│     "elements": ["祥云纹", "牡丹花"],                      │
│     "color_palette": "青花瓷蓝白",                         │
│     "composition": "中心对称",                             │
│     "intensity": 0.7,                                     │
│     "negative_prompt": "低质量,模糊",  (可选)              │
│     "count": 4                                            │
│   }                                                       │
│   后端: prompt_builder.build() → 完整prompt → 通义万相     │
│   响应: {                                                 │
│     "id": 5,                                              │
│     "images": ["/static/generated/xxx_1.png", ...],       │
│     "params": { (完整参数,用于复现) },                     │
│     "seed": 123456789,                                    │
│     "prompt_used": "生成一幅苏绣风格的..."                  │
│   }                                                       │
│                                                           │
│ POST /api/generation/image-to-image                        │
│   同上 + ref_image (multipart)                             │
│                                                           │
│ GET /api/generation/history?page=1&page_size=12           │
│ GET /api/generation/gallery?page=1&page_size=12           │
│   (公开画廊, is_public=true)                               │
│ POST /api/generation/{id}/publish                          │
│   (发布到公开画廊)                                          │
│ DELETE /api/generation/{id}                                │
│   (软删除 + 文件清理)                                      │
│                                                           │
│ 生图用 BackgroundTasks: 后端收到请求 → 返回task_id          │
│ → BackgroundTasks调API → 完成后更新状态                     │
│ 前端轮询 GET /api/generation/{id}/status 直到done          │
│                                                           │
│ 后端 schema 定义见附录B                                     │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务7  依赖: 任务6                                        │
│ 模块②前端: 文创工作室页面  · 1.5天                          │
│                                                          │
│ 路由: /creative-studio                                    │
│                                                          │
│ 左侧面板 — 创作参数:                                        │
│ □ 模式切换: Tabs [文生图 | 图生图]                          │
│ □ 风格选择器: 10个风格卡片 + hover预览图                    │
│   选中态金色边框, Ant Design Card.Grid                     │
│ □ 元素勾选: Checkbox.Group, 4列网格                        │
│   祥云纹 | 牡丹花 | 回纹边框 | 龙纹 | 凤纹                  │
│   青花配色 | 敦煌配色 | 景泰蓝配色 | 水墨风                 │
│ □ 配色方案: Radio.Group 色块预览                           │
│ □ 风格强度: Slider 0-100, 标注"轻融合"~"强融合"            │
│ □ 生成数量: Radio 2/4张                                    │
│ □ 负向提示词: Input.TextArea (可选)                         │
│ □ "生成"按钮 (loading态+进度)                               │
│                                                          │
│ 右侧面板 — 生成结果:                                        │
│ □ 图片网格 2×2 / 1×2 展示                                  │
│ □ 每张图: hover显示"下载"/"收藏"/"发布"                     │
│ □ 点击放大预览 (Ant Design Image.PreviewGroup)             │
│ □ 参数面板: 可折叠, 显示本次prompt/seed/参数 (复制按钮)     │
│                                                          │
│ 画廊模式 (顶部切换Tab "创作"|"画廊"):                        │
│ □ 公开作品画廊: 分页 + 瀑布流/网格切换                      │
│ □ 个人作品: 仅自己的 + 删除按钮                             │
│ □ 每张卡片: 作者/风格/时间/点赞数                           │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务8  依赖: 任务2                                        │
│ 模块④后端: 展厅API + 模块⑥后端: 个人中心API  · 1天         │
│                                                          │
│ ===== 展厅API =====                                       │
│                                                          │
│ GET /api/exhibition/items?category=&region=&era=&page=1  │
│   响应: { items: [...], total: 45, page: 1, pages: 5 }   │
│   单条item: {                                             │
│     "id": 1, "name": "苏绣", "category": "刺绣",          │
│     "region": "江苏苏州", "era": "春秋",                   │
│     "description": "苏绣是苏州地区刺绣产品的总称...",       │
│     "techniques": [{"name":"平绣","desc":"..."}],          │
│     "inheritors": [{"name":"姚建萍","title":"中国工艺美术大师"}],│
│     "images": ["/static/knowledge/suxiu_1.jpg", ...],     │
│     "cultural_meaning": "...",                             │
│     "is_favorited": false                                  │
│   }                                                        │
│                                                           │
│ GET /api/exhibition/items/{id}  (单条详情, 同上结构)        │
│ GET /api/exhibition/categories                            │
│   响应: ["刺绣","陶瓷","剪纸","雕塑","织锦","绘画","金属","漆器"] │
│                                                           │
│ POST /api/exhibition/uploads                               │
│   multipart: images[](最多5张)+title+description+category   │
│   → 写入 user_uploads 表, is_approved默认true              │
│                                                           │
│ ===== 个人中心API =====                                    │
│                                                           │
│ GET /api/user/profile                                     │
│ PUT /api/user/profile  { nickname, avatar }               │
│                                                           │
│ GET /api/user/favorites                                   │
│ POST /api/user/favorites  { item_type, item_id }          │
│ DELETE /api/user/favorites/{id}                            │
│                                                           │
│ 跨模块数据聚合:                                            │
│ GET /api/user/statistics                                  │
│   响应: { recognition_count, generation_count,             │
│           chat_count, favorite_count, upload_count }      │
│                                                           │
│ JWT payload: { sub: user_id, exp: timestamp }             │
│ 所有个人相关API通过 get_current_user 依赖注入获取user_id    │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务9  依赖: 任务8                                        │
│ 模块④+⑥前端: 展厅页面 + 个人中心 + 首页  · 1.5天            │
│                                                          │
│ ===== 展厅页面 /exhibition =====                           │
│ 状态: category, searchKeyword, viewMode('grid'|'waterfall'), page│
│ □ 左侧分类导航 (Ant Design Menu vertical)                  │
│ □ 顶部搜索栏 + 地区/年代筛选                                │
│ □ 网格/瀑布流切换按钮                                       │
│ □ Ant Design Card 网格展示藏品缩略图                        │
│ □ 点击 → Drawer(右侧滑出)展示详情:                          │
│   Image.PreviewGroup 轮播 + 描述 + 技法列表 + 传承人        │
│   + 收藏按钮 + "文创灵感"跳转                               │
│ □ 底部分页                                                  │
│ □ 用户作品上传: Modal + Upload多图 + Form(标题/描述/分类)    │
│                                                           │
│ ===== 个人中心 /user-center =====                          │
│ 左侧菜单 + 右侧内容区 (Ant Design Layout.Sider + Content):   │
│ □ 识别记录: 列表 + 点击回顾详情                              │
│ □ 生成作品集: 图片网格 + 删除/发布                            │
│ □ 对话历史: 列表 + 点击继续对话                               │
│ □ 收藏夹: Tab切换(展品/作品) + 取消收藏                       │
│ □ 设置: Form(昵称/头像)                                     │
│                                                           │
│ ===== 首页 / =====                                         │
│ □ 国风氛围: 背景大图 + 渐变遮罩                              │
│ □ 4个功能入口卡片 (Ant Design Card, hover动效, Framer Motion)│
│   识别 / 文创 / 对话 / 展厅                                   │
│ □ 统计数字滚动: "已收录20+项非遗 / 生成XXX件文创"             │
│ □ 底部: 文化图谱入口 + 项目简介                              │
└─────────────────────────────────────────────────────────┘
```

---

### 阶段C：进阶P1 + 技术亮点 (任务10-12)

```
┌─────────────────────────────────────────────────────────┐
│ 任务10  依赖: 任务4,5                                      │
│ 技术亮点: 热力图后处理  · 1天                               │
│                                                          │
│ 后端 services/ai/post_process.py:                         │
│ □ 从Qwen-VL响应中提取特征关键词                             │
│ □ 基于特征描述, 用OpenCV在图上生成伪热力图:                 │
│   (实际没有ground truth bbox, 策略: 整图区域热力 +         │
│    特征关键词标注在固定位置, 如四角/中心)                    │
│ □ 或者升级方案: 用Grad-CAM风格处理                           │
│   (至少要做到"半透明蒙版+文字标注", 看起来像是AI分析的结果)   │
│ □ save heatmap → /static/heatmaps/                         │
│                                                           │
│ 前端 Recognition.tsx 补热力图交互:                          │
│ □ 结果页上半部分: Tabs切换[原图|热力分析图]                   │
│ □ 热力图上有可hover的标记点 → tooltip显示特征名              │
│ □ 用绝对定位的div + CSS transition实现                      │
│                                                           │
│ 这里的关键不是技术复杂度, 而是视觉效果:                      │
│ "AI的分析过程可视化" → 答辩时这个是核心记忆点                 │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务11  依赖: 任务3,8                                      │
│ 模块③: 虚拟传承人对话 (全栈)  · 1.5天                      │
│                                                          │
│ ===== 后端 SSE API =====                                  │
│                                                          │
│ POST /api/chat/sessions                                   │
│   请求: { persona: "剪纸匠人" }                            │
│   响应: { id: 1, persona, title, created_at }             │
│                                                          │
│ GET /api/chat/sessions                                    │
│   响应: [{ id, persona, title, updated_at, preview },...]│
│                                                          │
│ GET /api/chat/sessions/{id}                               │
│   响应: { 同上 + messages: [{role,content,image_url,created_at}] }│
│                                                          │
│ POST /api/chat/sessions/{id}/send                          │
│   请求: { content: "苏绣的针法有哪些?", image: (可选) }     │
│   响应: text/event-stream (SSE)                            │
│   SSE消息格式:                                             │
│     event: message                                        │
│     data: {"token": "苏绣"}                               │
│                                                          │
│     event: message                                        │
│     data: {"token": "的"}                                 │
│                                                          │
│     ... (逐token流式)                                      │
│                                                          │
│     event: done                                           │
│     data: {"message_id": 42, "quick_questions": [...]}    │
│                                                          │
│     event: error                                          │
│     data: {"error": "API调用超时"}                         │
│   SSE实现: StreamingResponse + asyncio.Queue               │
│                                                          │
│ 角色系统:                                                  │
│   每个角色定义在 config/characters.json:                    │
│   {                                                       │
│     "id": "paper_cutter",                                  │
│     "name": "剪纸匠人·老张",                                │
│     "avatar": "/static/avatars/paper_cutter.png",          │
│     "system_prompt": "你是一位从事剪纸50年的老匠人...",       │
│     "style": "说话朴素直率, 带北方口音特征...",               │
│     "expertise": ["剪纸","窗花","民间工艺"]                  │
│   }                                                       │
│   DeepSeek调用时: system_prompt + messages → stream        │
│                                                           │
│ ===== 前端 /virtual-inheritor =====                        │
│                                                           │
│ 页面布局: 左侧角色选择 + 中间对话区 + 右侧空(移动端响应式折叠)│
│                                                           │
│ 左侧 — 角色面板:                                            │
│ □ 5个角色卡片 + 头像 + 口头禅预览                            │
│ □ 点击切换 → 创建新session (保留旧session可回)               │
│ □ 当前角色高亮                                              │
│                                                           │
│ 中间 — 对话窗口:                                            │
│ □ 消息列表 (Ant Design List / 自定义)                       │
│   - 用户消息: 右侧气泡, 白色                                │
│   - AI消息: 左侧气泡 + 头像, 金色边框(国风)                  │
│   - 打字机效果 (SSE token逐字追加)                           │
│ □ 底部输入区:                                               │
│   - Input.TextArea + 发送按钮                              │
│   - 图片追问: Upload按钮 (可选)                             │
│   - 快捷追问: AI回答后下方出现3个按钮                        │
│ □ 会话列表: Drawer/下拉, 切换历史对话                        │
│                                                           │
│ React SSE处理:                                             │
│   custom hook useSSE(url, body):                            │
│   → fetch + ReadableStream → 解析SSE → callback更新state    │
│   注意处理: 断线重连/组件卸载取消/错误状态                    │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务12  依赖: 任务8                                        │
│ 模块⑤: 文化图谱 (全栈)  +  Mock数据准备  · 1.5天            │
│                                                          │
│ ===== 后端 =====                                           │
│                                                          │
│ GET /api/knowledge-graph/relations                        │
│   响应: {                                                 │
│     "nodes": [                                            │
│       {"id":"1","name":"苏绣","category":"刺绣",           │
│        "region":"江苏","symbolSize":40},                  │
│       ...                                                 │
│     ],                                                    │
│     "links": [                                            │
│       {"source":"1","target":"3","relation":"技法相似"},   │
│       {"source":"1","target":"5","relation":"地域接近"},   │
│       ...                                                 │
│     ]                                                     │
│   }                                                       │
│   (数据预处理: 从heritage_items表 + techniques字段推导)     │
│                                                           │
│ GET /api/knowledge-graph/regions                           │
│   响应: [                                                  │
│     {"name":"江苏","value":15,"items":["苏绣","宜兴紫砂"...]},│
│     ...                                                    │
│   ]                                                        │
│                                                           │
│ GET /api/knowledge-graph/timeline                          │
│   响应: [                                                  │
│     {"era":"唐","start":618,"end":907,                     │
│      "items":[{"id":5,"name":"唐三彩","category":"陶瓷"}], │
│      "distribution": {"河南":8,"陕西":5,...}},             │
│     ...                                                    │
│   ]                                                        │
│                                                           │
│ ===== 前端 /knowledge-graph =====                          │
│                                                           │
│ 三图联动布局:                                               │
│ ┌──────────────────────────────────────┐                  │
│ │  关系图谱 (左60%)   │  地域分布(右40%) │                  │
│ ├────────────────────┴─────────────────┤                  │
│ │  时间轴 (底部100%宽度)                 │                  │
│ └──────────────────────────────────────┘                  │
│                                                           │
│ 关系图谱 (ECharts force-directed):                         │
│ □ 节点: 品类名, 大小=关联数量, 颜色=品类                     │
│ □ 边: 技法相似/地域接近/历史同源, 三种线型                    │
│ □ 点击节点 → 弹出详情卡片 (名称/简介/跳转展厅)               │
│ □ 拖拽/缩放                                                │
│                                                           │
│ 地域分布 (ECharts map + scatter):                          │
│ □ 中国地图底图, 散点大小=非遗密度                            │
│ □ hover省份 → tooltip显示该省非遗列表                        │
│ □ 点击省份 → 关系图谱筛选该省节点                            │
│                                                           │
│ 时间轴 (ECharts timeline/custom):                          │
│ □ 横向滚动, 唐/宋/元/明/清/近现代                           │
│ □ 选中朝代 → 地图+关系图联动更新:                            │
│   - 地图: 该朝代有非遗的省份高亮                             │
│   - 关系图: 筛选该朝代活跃的品类                             │
│ □ 时间轴下方: 该朝代新增的非遗列表                            │
│                                                           │
│ 时空联动实现:                                               │
│   selectedEra state → useEffect →                          │
│   同时调用 mapChart.setOption() + graphChart.setOption()   │
│   + echarts dispatchAction 更新选中态                       │
│                                                           │
│ ===== Mock数据准备 =====                                   │
│                                                           │
│ □ backend/data/mock/recognition_results.json (10组)        │
│   不同品类, 含完整explanation字段+热力图路径                  │
│ □ backend/data/mock/generated_images/ (20张预生成图)       │
│   不同风格+不同元素组合的文创图                              │
│   分类命名: suzhou_xiangyun_blue_1.png 等                   │
│ □ backend/data/mock/chat_demo.json (2段完整对话)            │
│   每段10+轮对话, 不同角色                                   │
│ □ backend/data/mock/tts_samples/ (5个预合成语音)            │
│   覆盖主要品类讲解                                          │
│ □ 后端MOCK_MODE=true时: 各AI服务读mock数据, 模拟延迟         │
│ □ 联调测试: MOCK_MODE=true启动 → 走完整用户流程验证          │
└─────────────────────────────────────────────────────────┘
```

---

### 阶段D：收尾 (任务13-14)

```
┌─────────────────────────────────────────────────────────┐
│ 任务13  依赖: 所有P0+P1任务完成                            │
│ 全链路联调 + 异常处理 + 部署  · 1.5天                      │
│                                                          │
│ 联调:                                                     │
│ □ 端到端走通: 登录→识图→查看讲解→听语音→跳转文创→生成→收藏  │
│ □ 端到端走通: 浏览展厅→搜索→详情→收藏→个人中心查看          │
│ □ 端到端走通: 切换传承人→对话→图片追问→切换历史对话         │
│ □ 端到端走通: 图谱页面三图联动→点击钻取→跳转展厅             │
│ □ Mock模式开关测试 (MOCK_MODE=true/false 各走一遍)          │
│                                                          │
│ 异常处理:                                                  │
│ □ AI API超时 → 友好提示 + 重试按钮 (非白屏/非报错栈)        │
│ □ 文件过大 → 前端拦截(beforeUpload) + 后端校验              │
│ □ 网络断开 → 全局axios interceptor捕获 → message.error      │
│ □ 未登录访问 → 路由守卫 → 重定向/login                      │
│ □ 404/500 → 统一错误页                                     │
│ □ API额度耗尽 → 识别/生图返回特定错误码 → 前端提示充值       │
│                                                          │
│ 界面美化:                                                  │
│ □ 国风配色全局统一 (TailwindCSS 自定义色板 + Ant Design token)│
│   主色: 朱砂红 #C41E3A / 金色 #C9A96E / 青蓝 #2B5F8A       │
│   背景: 米白 #F5F0E8 / 深色 #1A1A2E                        │
│ □ 字体: 标题用思源宋体(Google Fonts), 正文用系统默认          │
│ □ 首页Hero区动画 (Framer Motion)                            │
│ □ 各页面过渡动画                                            │
│ □ 所有loading态统一样式                                      │
│                                                          │
│ 部署:                                                     │
│ □ docker-compose.cloud.yml (nginx:80→前端+ :8000→后端)     │
│ □ nginx.conf (静态资源缓存/API代理/gzip)                    │
│ □ 阿里云ECS: 安装Docker → scp项目 → docker compose up -d   │
│ □ Let's Encrypt HTTPS证书 (certbot)                        │
│ □ 验证公网访问: https://your-domain 完整流程通过             │
│ □ 本地 docker-compose 同步验证                              │
│                                                          │
│ 前置条件: 阿里云ECS已购 + 域名已解析                          │
│ 若尚无域名: 先用 ECS公网IP:端口 方式, 答辩时用ngrok备用       │
└─────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────┐
│ 任务14  依赖: 任务13                                       │
│ 文档整理  · 0.5天                                          │
│                                                          │
│ □ README.md (项目首页文档, GitHub风格)                      │
│   标题 + 一句话简介 + 功能截图(6张) + 技术栈 + 快速开始      │
│   + 项目结构 + API列表 + 团队成员/致谢                       │
│                                                          │
│ □ 答辩PPT素材准备:                                          │
│   截图6个模块关键页面 (Mock模式操作一遍)                     │
│   文化图谱时空联动录屏GIF (关键!)                            │
│   热力图对比截图 (原图 vs 热力标注)                          │
│   架构图 (用draw.io/excalidraw画)                           │
│                                                          │
│ □ 答辩演示脚本 (markdown):                                  │
│   开场30秒: 文化图谱时空联动 → 哇点                          │
│   主体3分钟: 完整用户流程 (识图→讲解→文创→收藏)              │
│   结尾1分钟: 技术亮点 + 成本测算 + 未来展望                   │
│   备用: Mock模式演示 (如果网络出问题)                        │
│                                                          │
│ □ 实验报告 / 开发文档 (按老师要求格式)                       │
│                                                          │
│ □ 代码注释检查: 所有API函数有docstring, 复杂逻辑有注释       │
│   AI服务封装注释清楚: 输入/输出/异常/重试策略                 │
└─────────────────────────────────────────────────────────┘
```

---

## 三、依赖关系图

```
任务1 (骨架)
  │
  ├──→ 任务2 (数据库+鉴权)
  │      │
  │      ├──→ 任务3 (AI服务层)
  │      │      │
  │      │      ├──→ 任务4 (模块①后端) ──→ 任务5 (模块①前端)
  │      │      │                              │
  │      │      │                              └──→ 任务10 (热力图)
  │      │      │
  │      │      ├──→ 任务6 (模块②后端) ──→ 任务7 (模块②前端)
  │      │      │
  │      │      └──→ 任务11 (模块③全栈, 需任务8的用户API)
  │      │
  │      ├──→ 任务8 (模块④⑥后端) ──→ 任务9 (模块④⑥前端+首页)
  │      │                              │
  │      │                              └──→ 任务12 (模块⑤, 需展厅数据)
  │      │
  │      └──→ (任务12的图谱数据API, 依赖heritage_items表)
  │
  └──→ 任务13 (收尾) ←── 所有P0+P1任务
         │
         └──→ 任务14 (文档)
```

---

## 四、前端路由表

| 路径 | 页面 | 权限 | 核心state |
|---|---|---|---|
| `/` | Home | 公开 | — |
| `/login` | Login | 未登录 | form |
| `/register` | Register | 未登录 | form |
| `/recognition` | 模块① 识别讲解 | 需登录 | step, result, loadingText |
| `/creative-studio` | 模块② 文创工作室 | 需登录 | mode, style, elements, intensity, results, tab('create'\|'gallery') |
| `/virtual-inheritor` | 模块③ 传承人对话 | 需登录 | persona, sessions[], currentSessionId, messages[], isStreaming |
| `/exhibition` | 模块④ 数字展厅 | 公开 | category, searchKeyword, viewMode, items[], selectedItem |
| `/knowledge-graph` | 模块⑤ 文化图谱 | 公开 | selectedEra, graphData, mapData, timelineData |
| `/user-center/:tab` | 模块⑥ 个人中心 | 需登录 | tab(records\|works\|chats\|favorites\|settings), data[] |

**路由守卫**: 需登录页面包裹 `<ProtectedRoute>` 组件，未登录重定向 `/login?redirect=xxx`

**Layout**: `MainLayout` 包含侧边栏导航 + 顶栏用户信息，公开页面也包在Layout内（侧边栏始终可见）

---

## 五、全局状态 (Context)

```
AuthContext:
  user: { id, username, nickname, avatar } | null
  token: string | null
  login(username, password) → void
  logout() → void
  isAuthenticated: boolean

AppContext:
  mockMode: boolean        (从/api/system/health获取, 展示给用户)
  sidebarCollapsed: boolean
  toggleSidebar() → void
```

---

## 附录A：数据库表详细定义

```sql
-- 用户表
CREATE TABLE users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    VARCHAR(50)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nickname    VARCHAR(50)  DEFAULT '',
    avatar_url  VARCHAR(500) DEFAULT '',
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- 识别记录
CREATE TABLE recognition_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    image_path  VARCHAR(500) NOT NULL,
    category    VARCHAR(100) NOT NULL,
    confidence  REAL NOT NULL,
    top3_json   TEXT,          -- JSON: [{"category":"...","confidence":0.xx},...]
    features_json TEXT,        -- JSON: ["平针绣","套针"]
    explanation_json TEXT,     -- JSON: {history, technique, inheritor, meaning}
    heatmap_path VARCHAR(500),
    voice_path  VARCHAR(500),
    raw_response_json TEXT,    -- Qwen-VL原始响应(调试用)
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI生成作品
CREATE TABLE generated_works (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id),
    prompt        TEXT NOT NULL,
    negative_prompt TEXT DEFAULT '',
    base_style    VARCHAR(50) NOT NULL,
    elements_json TEXT,        -- JSON: ["祥云纹","牡丹花"]
    color_palette VARCHAR(50),
    composition   VARCHAR(50),
    intensity     REAL DEFAULT 0.7,
    seed          INTEGER,
    mode          VARCHAR(20) DEFAULT 'text2img',  -- 'text2img' | 'img2img'
    ref_image_path VARCHAR(500),
    images_json   TEXT NOT NULL,  -- JSON: ["path1","path2"]
    params_json   TEXT,           -- 完整请求参数JSON(用于复现)
    is_public     BOOLEAN DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 对话会话
CREATE TABLE chat_sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    persona     VARCHAR(50) NOT NULL,
    title       VARCHAR(200) DEFAULT '新对话',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 对话消息
CREATE TABLE chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL,  -- 'user' | 'assistant'
    content     TEXT NOT NULL,
    image_path  VARCHAR(500),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 非遗藏品(知识库)
CREATE TABLE heritage_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            VARCHAR(200) NOT NULL,
    category        VARCHAR(50) NOT NULL,
    region          VARCHAR(100),
    era             VARCHAR(100),
    description     TEXT,
    techniques_json TEXT,       -- JSON: [{"name":"...","desc":"..."}]
    inheritors_json TEXT,       -- JSON: [{"name":"...","title":"..."}]
    images_json     TEXT,       -- JSON: ["path1","path2"]
    cultural_meaning TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 用户上传作品
CREATE TABLE user_uploads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    images_json TEXT NOT NULL,
    category    VARCHAR(50),
    is_approved BOOLEAN DEFAULT 1,    -- 简化: 直接展示
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 收藏(多态)
CREATE TABLE favorites (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    item_type   VARCHAR(20) NOT NULL,  -- 'heritage' | 'generated' | 'user_upload'
    item_id     INTEGER NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_type, item_id)
);

-- 用户设置
CREATE TABLE user_settings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL UNIQUE REFERENCES users(id),
    voice_speed REAL DEFAULT 1.0,
    theme       VARCHAR(20) DEFAULT 'light'
);
```

---

## 附录B：关键Pydantic Schema

```python
# schemas/auth.py
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    nickname: str = Field(default="")

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

class UserPublic(BaseModel):
    id: int
    username: str
    nickname: str
    avatar_url: str

# schemas/recognition.py
class RecognitionResponse(BaseModel):
    id: int
    image_url: str
    category: str
    confidence: float
    top3: list[CategoryCandidate]
    features: list[str]
    explanation: Explanation
    heatmap_url: str | None
    voice_url: str | None
    related: RelatedRecommendations
    created_at: datetime

class CategoryCandidate(BaseModel):
    category: str
    confidence: float

class Explanation(BaseModel):
    history: str
    technique: str
    inheritor: str
    meaning: str

class RelatedRecommendations(BaseModel):
    creations: list[CreationLink]
    exhibits: list[ExhibitLink]

# schemas/generation.py
class TextToImageRequest(BaseModel):
    base_style: str = Field(..., min_length=1)
    elements: list[str] = Field(default_factory=list, max_length=8)
    color_palette: str = Field(default="")
    composition: str = Field(default="")
    intensity: float = Field(default=0.7, ge=0.0, le=1.0)
    negative_prompt: str = Field(default="")
    count: int = Field(default=2, ge=1, le=4)

class GenerationResponse(BaseModel):
    id: int
    images: list[str]
    params: dict
    seed: int | None
    prompt_used: str

# schemas/chat.py
class CreateSessionRequest(BaseModel):
    persona: str

class SendMessageRequest(BaseModel):
    content: str
    image: UploadFile | None = None  # multipart

# SSE事件格式 (非Pydantic, 纯协议)
# event: message
# data: {"token": "苏"}
#
# event: done
# data: {"message_id": 42, "quick_questions": ["那针法有哪些类别?","苏绣和湘绣有什么区别?","初学者怎么入门苏绣?"]}
#
# event: error
# data: {"error": "生成失败,请重试"}

# schemas/exhibition.py
class HeritageItemResponse(BaseModel):
    id: int
    name: str
    category: str
    region: str | None
    era: str | None
    description: str | None
    techniques: list[TechniqueItem]
    inheritors: list[InheritorItem]
    images: list[str]
    cultural_meaning: str | None
    is_favorited: bool

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    pages: int

# schemas/common.py
class MessageResponse(BaseModel):
    message: str

class ErrorResponse(BaseModel):
    detail: str
    error_code: str | None
```

---

## 附录C：前端依赖清单

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.26",
    "antd": "^5.21",
    "@ant-design/icons": "^5.4",
    "axios": "^1.7",
    "echarts": "^5.5",
    "echarts-for-react": "^3.0",
    "react-markdown": "^9.0",
    "react-easy-crop": "^5.1",
    "framer-motion": "^11.5"
  },
  "devDependencies": {
    "typescript": "^5.6",
    "vite": "^5.4",
    "@vitejs/plugin-react": "^4.3",
    "tailwindcss": "^3.4",
    "autoprefixer": "^10.4",
    "postcss": "^8.4",
    "@types/react": "^18.3",
    "@types/react-dom": "^18.3"
  }
}
```

---

## 附录D：Python依赖清单

```
fastapi==0.115.*
uvicorn[standard]==0.30.*
sqlalchemy==2.0.*
pydantic==2.9.*
python-jose[cryptography]==3.3.*
passlib[bcrypt]==1.7.*
python-multipart==0.0.*
httpx==0.27.*
Pillow==10.4.*
opencv-python-headless==4.10.*
openai==1.51.*           # DeepSeek兼容OpenAI SDK
dashscope==1.20.*        # 阿里云DashScope SDK (Qwen-VL + 通义万相)
aiofiles==24.1.*
pytest==8.3.*
```

---

## 附录E：环境变量模板 (.env.example)

```bash
# 数据库
DATABASE_URL=sqlite:///./data/database.sqlite

# JWT
SECRET_KEY=change-me-to-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=24

# AI API
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 文件上传
MAX_UPLOAD_SIZE_MB=10
UPLOAD_DIR=./data/uploads

# Mock模式 (答辩备用)
MOCK_MODE=false

# 部署
DEPLOY_ENV=local
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```
