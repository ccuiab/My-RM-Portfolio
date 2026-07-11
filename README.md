# My-RM-Portfolio

香港科技大学 CPEG 大三学生 RoboMaster 机械作品集展示网站。

## 功能特性

- **左侧导航栏** — 深蓝色固定侧边栏，目录树结构，点击平滑跳转
- **滚动监听** — 导航栏自动高亮当前阅读章节
- **图片画廊** — 每个项目多张图片自动轮播（3.5s），支持手动切换与全屏放大
- **子卡片布局** — 项目详情用半透明彩色子卡片分隔，层次清晰
- **背景轮播** — 底层超大图片轮播（10s），覆盖暖色滤镜，透过半透明卡片可见
- **无滚动条设计** — 完全隐藏滚动条，左右区域无缝贴合
- **移动端适配** — 窄屏侧边栏收为顶部精简条 + 汉堡菜单，正文首屏即见；导航跳转、高亮、画廊全部随视口自适应

## 文件结构

```
My-RM-Portfolio/
├── README.md           ← 本文件
├── 崔楮焓CV.7z        ← 压缩备份
├── docs/               ← GitHub Pages 源
│   ├── index.html      ← 主页入口
│   ├── style.css       ← 样式
│   ├── script.js       ← 交互逻辑
│   ├── CUIChuhanCV.md  ← Markdown 源文件
│   └── *.webp          ← 13 张项目图片（WebP 格式）
└── .gitignore          ← 忽略 *.7z 压缩包
```

## 技术栈

- 纯 HTML5 / CSS3 / 原生 JavaScript
- 零外部依赖（除已移除的 Mermaid）
- `IntersectionObserver` 实现滚动动画
- `backdrop-filter` 毛玻璃效果
- CSS `scrollbar-width: none` 隐藏滚动条

## 线上地址

**https://ccuiab.github.io/My-RM-Portfolio/**

## 仓库地址

**https://github.com/ccuiab/My-RM-Portfolio**

## 本地运行

直接在浏览器打开 `docs/index.html` 即可。
