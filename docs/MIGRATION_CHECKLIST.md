# 旧页面迁移到新设计系统 Checklist

> 适用：将现有页面从旧 inline style 模式迁移到 v2 Design Tokens 体系

## 快速检查清单（逐页对照）

### 1. 全局替换

- [ ] **`#C41E3A`** → `var(--color-vermilion)` （朱红）
- [ ] **`#C9A96E`** → `var(--color-gold)` （鎏金）
- [ ] **`#F5F0E8`** → `var(--color-paper)` （背景）
- [ ] **`#1A1A2E`** → `var(--color-deep)` （深色底）
- [ ] **`#fff`**（卡片背景）→ `var(--color-paper-white)` （暖白卡片）
- [ ] **`#999`**（辅助文字）→ `var(--color-ink-secondary)` （对比度达标）
- [ ] **`#f0f0f0` / `#f0ece0` / `#f0ebe0`**（边框）→ `var(--gray-200)`

### 2. 字体

- [ ] `fontSize: 14` → `var(--text-base)` 或直接 `fontSize: 16`（新基准）
- [ ] 页面标题 → `fontFamily: 'var(--font-display)'` + `fontSize: 'var(--text-xl)'`
- [ ] 卡片标题 → `fontSize: 'var(--text-md)'`
- [ ] 正文行高 → `lineHeight: 'var(--leading-normal)'`

### 3. 形状

- [ ] `borderRadius: 6` → `var(--radius-md)` 或 `8px`
- [ ] `borderRadius: 12` → `var(--radius-lg)` 或 `14px`
- [ ] `boxShadow` → 使用 `var(--shadow-sm)` / `var(--shadow-md)` / `var(--shadow-card-hover)`

### 4. Ant Design 废弃 API

- [ ] `bodyStyle={{ padding: ... }}` → `styles={{ body: { padding: ... } }}`
- [ ] `bordered={false}` on Cards that need borders → 显式设置 `style={{ border: '1px solid var(--gray-200)' }}`

### 5. 响应式

- [ ] 添加 `const { useBreakpoint } = Grid; const screens = useBreakpoint(); const isMobile = !screens.md`
- [ ] `fontSize: 42` → `fontSize: isMobile ? 28 : 44`
- [ ] `padding: '80px 40px'` → `padding: isMobile ? '60px 20px' : '88px 40px'`
- [ ] 卡片 grid: `xs={24} sm={12} lg={6}`

### 6. 暗色模式

- [ ] 在组件顶部添加 `const { theme } = useTheme()`
- [ ] Hero 渐变根据 theme 切换：`theme === 'dark' ? 'dark-gradient' : 'light-gradient'`
- [ ] 硬编码白色文字 → 自动适配（`--color-ink` 在暗色模式下自动变为浅色）

### 7. 可访问性

- [ ] 交互元素（可点击 div）添加 `role="button"` + `tabIndex={0}`
- [ ] 图标按钮添加 `aria-label`
- [ ] 检查 `--color-ink-secondary` 在 `--color-paper` 上的对比度（≥ 4.5:1）

### 8. 动效

- [ ] `transition={{ duration: 0.2 }}` → `transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}`（引用 `--ease-out`）
- [ ] 确认没有 `whileHover` 等无 reduced-motion fallback 的动画

---

## 逐文件迁移顺序

| # | 文件 | 复杂度 | 预计时间 |
|---|------|--------|----------|
| 1 | ✅ `main.tsx` | 低 | 已完成 |
| 2 | ✅ `globals.css` | 低 | 已完成 |
| 3 | ✅ `MainLayout.tsx` | 中 | 已完成 |
| 4 | ✅ `Header.tsx` | 中 | 已完成 |
| 5 | ✅ `Sidebar.tsx` | 中 | 已完成 |
| 6 | ✅ `Home.tsx` | 中 | 已完成 |
| 7 | `Login.tsx` + `Register.tsx` | 低 | 15 min |
| 8 | `Recognition.tsx` | 中 | 30 min |
| 9 | `CreativeStudio.tsx` | 高 | 45 min |
| 10 | `ExhibitionHall.tsx` | 高 | 60 min |
| 11 | `KnowledgeGraph.tsx` | 低（只需tokens替换）| 20 min |
| 12 | `VirtualInheritor.tsx` | 中 | 30 min |
| 13 | `UserCenter.tsx` | 中 | 30 min |
| 14 | `components/` 子组件 | 低 | 20 min |

---

## 验证方法

每迁移完一个页面后，执行：

```bash
cd frontend && npm run build    # 确保零 TS 错误
```

全量迁移完成后：

```bash
cd backend && MOCK_MODE=true pytest tests/ -v   # 确保 73 测试通过
```

手动检查暗色模式：点击 Header 的 ☀/🌙 按钮，确认所有页面正常。
