/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vermilion: '#C41E3A',   // 朱砂红 — 主色
        gold: '#C9A96E',        // 金色 — 强调
        qinglan: '#2B5F8A',     // 青蓝 — 辅助
        rice: '#F5F0E8',        // 米白 — 背景
        deep: '#1A1A2E',        // 深色 — 暗模式
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'serif'],
      },
    },
  },
  plugins: [],
  // Ant Design 不冲突
  corePlugins: {
    preflight: false,
  },
}
