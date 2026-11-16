/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],
  theme: {
    extend: {
      colors: {
        // 🐰 糰子兔配色
        cream: '#FBF6EE',      // 頁面底色
        sand: '#F4E3CF',       // 品牌頁首、編號圓點
        oat: '#F7EEE3',        // 切換按鈕底、次要底色
        line: '#E2D2BE',       // 輸入框、卡片邊框
        ink: '#3B2A20',        // 主要文字
        bark: '#6B5444',       // 次要文字
        carrot: {
          DEFAULT: '#B9562A',  // 主色按鈕、今日退房
          soft: '#FBEADF',     // 已選取選項底色
          dark: '#7A3A18',     // 已選取選項文字
          link: '#9A4A22',     // 連結、強調文字
        },
        peach: {
          DEFAULT: '#FCEFE4',  // 住宿中籠位
          edge: '#EBCFB8',
        },
        sage: {
          DEFAULT: '#2F5A3C',  // 入住、成功
          soft: '#EEF4EF',
          edge: '#8DB59A',     // 空房虛線框
        },
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', '-apple-system', 'sans-serif'],
        round: ['Huninn', '"Noto Sans TC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
