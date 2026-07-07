/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 核心品牌色 — 同步 tokens.css
        vermilion: {
          DEFAULT: '#B8463A',   // 朱砂红 — 主强调
          hover: '#9A2F25',     // 朱砂红 hover 加深
        },
        gold: {
          DEFAULT: '#C4A265',   // 鎏金 — 辅助强调
          light: '#E8D5B0',     // 鎏金浅 — 卡片边框
        },
        ink: {
          DEFAULT: '#2C241A',   // 墨色 — 正文
          secondary: '#6B5F52', // 淡墨 — 辅助文字
          tertiary: '#5A4F42',  // 暖褐 — 描述文字
        },
        paper: {
          DEFAULT: '#F7F4ED',   // 宣纸米白 — 页面背景
          white: '#FFFDF9',     // 纯白偏暖 — 卡片背景
        },
        deep: {
          DEFAULT: '#1E1B18',   // 深褐黑 — 侧边栏
          light: '#2A2520',     // 深褐浅 — hover 态
        },
        // 语义色
        success: '#4A8C5C',
        error: '#C5533B',
        info: '#5B7FA0',
        warning: '#C49A3C',
        // 交互背景
        'bg-active': '#FFF3E0',
        'bg-hover': '#F5F5F0',
        // 边框
        'border-light': '#E8E4D8',
        'border-medium': '#D5CFC0',
        // 中性色阶
        gray: {
          50: '#F7F4ED',
          100: '#EDE9E0',
          200: '#DED9D0',
          300: '#C4BEB4',
          500: '#8A8378',
          700: '#4A4540',
          900: '#1E1B18',
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
        body: ['"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Cascadia Code"', '"Consolas"', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '14px',
        xl: '20px',
        card: '14px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(30, 27, 24, 0.06)',
        md: '0 4px 12px rgba(30, 27, 24, 0.08)',
        lg: '0 8px 24px rgba(30, 27, 24, 0.10)',
        xl: '0 16px 48px rgba(30, 27, 24, 0.12)',
        'card-hover': '0 6px 20px rgba(30, 27, 24, 0.12)',
        'glow-gold': '0 0 20px rgba(196, 162, 101, 0.25)',
        'glow-vermilion': '0 0 20px rgba(184, 70, 58, 0.25)',
      },
      spacing: {
        0: '0',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
      },
      fontSize: {
        xs: '0.875rem',
        sm: '0.9375rem',
        base: '1rem',
        md: '1.25rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '2.5rem',
        '3xl': '3rem',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '250ms',
        slow: '400ms',
        page: '350ms',
      },
      animation: {
        heartbeat: 'heartbeat 0.6s ease-in-out',
        'check-bounce': 'checkBounce 0.4s var(--ease-spring)',
        'stamp-scale': 'stampScale 0.5s var(--ease-spring)',
        'float-pulse': 'floatPulse 2s ease-in-out infinite',
        'glow-scan': 'glowScan 3s ease-in-out infinite',
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.3)' },
          '50%': { transform: 'scale(1)' },
          '75%': { transform: 'scale(1.2)' },
        },
        checkBounce: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        stampScale: {
          '0%': { transform: 'scale(0) rotate(-15deg)', opacity: '0' },
          '60%': { transform: 'scale(1.1) rotate(3deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        floatPulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 20px rgba(196,162,101,0.15)' },
          '50%': { transform: 'scale(1.04)', boxShadow: '0 0 40px rgba(196,162,101,0.3)' },
        },
        glowScan: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
  // Ant Design 不冲突
  corePlugins: {
    preflight: false,
  },
}
