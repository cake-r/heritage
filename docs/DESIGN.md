# DESIGN.md — 东方新古典 · 数字文博风

> 非遗 AI 文化平台设计规范 v2.0
> 与旧系统的关键区别：**旧系统以 `#C41E3A`（朱红）为主唯一强调色，大面积 `#F5F0E8`（米白）背景，色值分散无体系；新系统建立完整 Design Token 层级，以深褐黑/米白双底 + 朱砂红/鎏金双强调色的四色核心理念，字体引入衬线体用于标题。**

---

## 1. 设计理念

**一句话**：仿佛走进一座数字博物馆 — 沉静、雅致、有底蕴。

**核心原则**：
- **内容为王** — UI 装饰服务于文化内容，不喧宾夺主
- **留白即分隔** — 用空间而非线条区分信息层级
- **双底系统** — 浅色底（宣纸米白）用于阅读；深色底（深褐黑）用于导航和沉浸
- **克制用色** — 一个页面不超过 3 种强调色

---

## 2. Design Tokens（CSS 自定义属性）

所有 Token 定义在 `:root` 下，全局可用。**任何硬编码 hex 都是违规。**

### 2.1 品牌色

```css
:root {
  /* === 核心品牌四色 === */
  --color-vermilion:      #B8463A;   /* 朱砂红 — 主强调：按钮、选中态、关键CTA */
  --color-vermilion-hover:#9A2F25;   /* 朱砂红 hover 加深 */
  --color-gold:           #C4A265;   /* 鎏金 — 辅助强调：标签、装饰线、二级按钮 */
  --color-gold-light:     #E8D5B0;   /* 鎏金浅 — 卡片边框、分割线 */
  --color-ink:            #2C241A;   /* 墨色 — 正文文字 */
  --color-ink-secondary:  #6B5F52;   /* 淡墨 — 辅助文字、placeholder */

  /* === 底色系统 === */
  --color-paper:          #F7F4ED;   /* 宣纸米白 — 页面背景（替代旧 #F5F0E8）*/
  --color-paper-white:    #FFFDF9;   /* 纯白偏暖 — 卡片/面板背景 */
  --color-deep:           #1E1B18;   /* 深褐黑 — 侧边栏/页脚/暗底（替代旧 #1A1A2E）*/
  --color-deep-light:     #2A2520;   /* 深褐浅 — hover 态在深色底上 */

  /* === 语义色 === */
  --color-success:        #4A8C5C;   /* 墨绿 — 成功（旧 #2B5F8A 蓝色改为绿色，语义正确）*/
  --color-error:          #C5533B;   /* 暗红 — 错误 */
  --color-info:           #5B7FA0;   /* 青蓝 — 信息、链接 */
  --color-warning:        #C49A3C;   /* 暗金 — 警告 */

  /* === 中性色阶（从深到浅） === */
  --gray-900: #1E1B18;
  --gray-700: #4A4540;
  --gray-500: #8A8378;
  --gray-300: #C4BEB4;
  --gray-200: #DED9D0;
  --gray-100: #EDE9E0;
  --gray-50:  #F7F4ED;
}
```

### 2.2 字体

```css
:root {
  /* === 字体栈 === */
  --font-display:   'Noto Serif SC', 'Source Han Serif SC', 'SimSun', serif;  /* 标题 */
  --font-body:      'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:      'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;  /* 代码/数据 */

  /* === 字体大小模量级（Major Third 1.25） === */
  --text-xs:    0.6875rem;  /* 11px — 标签、徽章 */
  --text-sm:    0.8125rem;  /* 13px — 辅助文字 */
  --text-base:  1rem;       /* 16px — 正文（提升默认值，旧 14px 过小）*/
  --text-md:    1.25rem;    /* 20px — 小标题 */
  --text-lg:    1.5rem;     /* 24px — 卡片标题 */
  --text-xl:    2rem;       /* 32px — 页面标题 */
  --text-2xl:   2.5rem;     /* 40px — Hero 标题 */
  --text-3xl:   3rem;       /* 48px — Landing 大标题 */

  /* === 字重 === */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold:600;
  --font-bold:   700;

  /* === 行高 === */
  --leading-tight:  1.25;   /* 标题 */
  --leading-normal: 1.6;    /* 正文 */
  --leading-relaxed:1.75;   /* 长文本阅读 */
}
```

### 2.3 间距（基于 4px 基线网格）

```css
:root {
  --space-0:  0;
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* 页面内容最大宽度 — 统一所有页面 */
  --container-max: 1320px;
  --container-narrow: 720px;  /* 阅读型页面 */
  --container-wide: 1520px;   /* 图谱/展品网格 */
}
```

### 2.4 圆角

```css
:root {
  --radius-none: 0;
  --radius-sm:   4px;   /* 标签、徽章 */
  --radius-md:   8px;   /* 卡片、输入框（替代旧 6px） */
  --radius-lg:   14px;  /* 大卡片、面板 */
  --radius-xl:   20px;  /* Modal、Drawer */
  --radius-full: 9999px;/* 药丸形状 */
}
```

### 2.5 阴影（东方感：低对比、暖色调阴影）

```css
:root {
  /* 不使用纯黑阴影，而是带暖色的微妙阴影 */
  --shadow-sm:   0 1px 3px rgba(46, 40, 30, 0.06);
  --shadow-md:   0 4px 12px rgba(46, 40, 30, 0.08);
  --shadow-lg:   0 8px 24px rgba(46, 40, 30, 0.10);
  --shadow-xl:   0 16px 48px rgba(46, 40, 30, 0.12);
  --shadow-card-hover: 0 6px 20px rgba(46, 40, 30, 0.12);
}
```

### 2.6 动效

```css
:root {
  --ease-out:     cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:  cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);

  --duration-fast:    150ms;
  --duration-normal:  250ms;
  --duration-slow:    400ms;
  --duration-page:    300ms;

  /* 减少动效用户偏好 */
  @media (prefers-reduced-motion: reduce) {
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
    --duration-page: 0ms;
  }
}
```

---

## 3. 与旧系统的关键区别

| 维度 | 旧 v1 | 新 v2 |
|------|-------|-------|
| 主色 | `#C41E3A`（亮朱红） | `#B8463A`（沉朱砂，降低明度更雅致）|
| 深色底 | `#1A1A2E`（蓝黑） | `#1E1B18`（深褐黑，暖调）|
| 金色 | `#C9A96E`（亮金） | `#C4A265`（沉鎏金，降低饱和度）|
| 字体大小基准 | 14px（Ant Design 默认）| 16px（阅读更舒适）|
| 标题字体 | 系统无衬线体 | Noto Serif SC（衬线体，东方感）|
| Design Token | 无（164+ 硬编码 hex）| CSS 自定义属性，全局可用 |
| 页面最大宽度 | 5 种不同值 | 3 种统一值（1320/720/1520）|
| 圆角 | 6px | 8px（更柔和）|
| 阴影 | Ant Design 默认（纯黑） | 暖色调阴影（`rgba(46,40,30,...)`）|
| 暗色模式 | 无 | 新增（`[data-theme="dark"]`）|

---

## 4. Ant Design 组件定制方案

在 `main.tsx` 的 `ConfigProvider` 中设置：

```tsx
// Ant Design 5 Token 映射 → 我们的 Design Tokens
const theme = {
  token: {
    // 品牌
    colorPrimary: 'var(--color-vermilion)',
    colorInfo: 'var(--color-info)',
    colorSuccess: 'var(--color-success)',
    colorWarning: 'var(--color-warning)',
    colorError: 'var(--color-error)',
    
    // 背景
    colorBgBase: 'var(--color-paper-white)',
    colorBgLayout: 'var(--color-paper)',
    
    // 文字
    colorTextBase: 'var(--color-ink)',
    colorTextSecondary: 'var(--color-ink-secondary)',
    
    // 字体
    fontSize: 16,
    fontFamily: 'var(--font-body)',
    
    // 形状
    borderRadius: 8,
    borderRadiusLG: 14,
    borderRadiusSM: 4,
    
    // 间距
    paddingContentHorizontal: 24,
  },
  components: {
    Menu: {
      darkItemBg: 'var(--color-deep)',
      darkItemSelectedBg: 'var(--color-deep-light)',
      darkItemColor: 'var(--gray-200)',
      darkItemSelectedColor: 'var(--color-gold)',
    },
    Card: {
      colorBgContainer: 'var(--color-paper-white)',
      boxShadow: 'var(--shadow-sm)',
    },
    Button: {
      borderRadius: 8,
      fontWeight: 500,
    },
    Tag: {
      borderRadiusSM: 4,
    },
    Modal: {
      borderRadiusLG: 20,
    },
  },
}
```

---

## 5. 品类色彩（19 品类 — 保留现有 19 色映射）

现有 19 色保留不调整（用户已形成视觉记忆）。仅做微调确保在 `--color-paper` 新底色上对比度达标。

### 微调项（仅涉及 2 个色）：

| 品类 | 旧色 | 新色 | 原因 |
|------|------|------|------|
| 书法 | `#2C2C2C` | `#3A3530` | 旧色在新深底色上不可见 |
| 雕塑 | `#708090` | `#6B7F8E` | 微调饱和度保证对比度 |

---

## 6. 暗色模式（Dark Mode）

```css
[data-theme="dark"] {
  --color-paper:        #161310;
  --color-paper-white:  #201C18;
  --color-deep:         #0F0D0B;
  --color-deep-light:   #2A2520;
  --color-ink:          #E8E2D8;
  --color-ink-secondary:#A09888;
  --color-gold-light:   #3D3528;
  
  --gray-50:  #161310;
  --gray-100: #201C18;
  --gray-200: #3A3530;
  --gray-300: #5A5248;
  --gray-500: #8A8278;
  --gray-700: #B8B0A0;
  --gray-900: #E8E2D8;

  /* 阴影在暗色模式下用亮色微光代替 */
  --shadow-sm:   0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-md:   0 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-lg:   0 8px 24px rgba(0, 0, 0, 0.5);
}
```

暗色模式在 `<html>` 上设置 `data-theme="dark"` 即可全局切换。切换逻辑用 `<ThemeContext>` React Context 管理，localStorage 持久化。

---

## 7. 响应式断点

```
Mobile:    < 640px   (单列、底部导航)
Tablet:    640-1024px (双列、可折叠侧边栏)
Desktop:   > 1024px  (全布局)
Wide:      > 1440px  (宽屏优化)
```
