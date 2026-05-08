# MyCV 项目文档

个人主页项目，位于 `D:\MyCV`，部署到 GitHub Pages (`ccuiab/myweb`)。

## 项目信息

- **作者**：崔楮焓 / ccuiab
- **身份**：HKUST CPEG 大三，ENTERPRIZE 战队机械组组长，工程全明星
- **用途**：展示 RoboMaster 参赛经历与机械设计项目
- **线上地址**：https://ccuiab.github.io/myweb/
- **仓库**：https://github.com/ccuiab/myweb.git，分支 `main`
- **电话**：+86 
- **微信**：

## 文件结构

```
MyCV/
├── docs/                  ← GitHub Pages 源
│   ├── index.html         ← 主页入口
│   ├── style.css          ← 样式
│   ├── script.js          ← 交互逻辑
│   ├── CUIChuhanCV.md     ← Markdown 源文件
│   └── *.webp             ← 13 张项目图片
├── README.md
├── .gitignore             ← 忽略 *.7z
└── 崔楮焓CV.7z           ← 压缩备份
```

## 技术栈

- 纯 HTML5 / CSS3 / 原生 JavaScript
- 零外部依赖
- `IntersectionObserver` 滚动动画
- `backdrop-filter` 毛玻璃效果

## 配色方案（HKUST 蓝金校徽风）

2025/05/08 最终确定为"HKUST 蓝金校徽风"：

| 元素 | 色值 | 说明 |
|------|------|------|
| 侧边栏背景 | `#0a1a2f` | 港科深海蓝 |
| 主强调色 | `#c9a227` | 工程金 |
| 辅助强调色 | `#a88a2a`, `#d4b43a`, `#8f7720` | 金系不同明度 |
| 卡片背景 | `rgba(235,240,248,0.72)` | 浅蓝灰玻璃，明亮 |
| 子卡片背景 | `rgba(220,230,245,0.55)` | 更浅蓝灰 |
| 正文色 | `#2c2c2c` | 深灰（适配浅色卡片） |
| 背景滤镜 | `brightness(0.85) saturate(0.9)` | 温和暗化，保留机械图清晰度 |

## 已执行的关键优化

### P0：性能基础
- 删除未引用图片 `机械臂J0.jpg`
- 单图项目（4处）移除冗余 `.gallery-thumbs` DOM
- 所有 `<img>` 添加 `loading="lazy"` `decoding="async"` + 原生 `width/height`
- 首屏首张图设为 `loading="eager"`，消除 CLS

### P1：背景轮播
- 从 13 张缩减至 5 张，减少首屏请求

### P2：交互体验
- Modal 全屏查看添加淡入过渡（`opacity 0.3s`）

### P3：图片现代化
- 全部转换为 WebP，体积从 ~785KB 降至 ~451KB（-42%）
- 文件名英文化，避免 URL 中文编码问题

| 旧文件名 | 新文件名 |
|----------|----------|
| 全明星.jpg | eng-allstar.webp |
| 工程全明星.jpg | eng-mvp.webp |
| 机械臂.jpg | eng-arm.webp |
| 自定义控制器.png | controller.webp |
| 英雄机器人.jpg | hero-bot.webp |
| 外骨骼.jpg | exo-suit.webp |
| 机械臂L3.jpg | arm-l3.webp |
| 机械臂L4.jpg | arm-l4.webp |
| 气泵.jpg | air-pump.webp |
| 工程舵轮组.jpg | eng-wheel.webp |
| 英雄舵轮组.jpg | hero-wheel.webp |
| 大弹丸测供弹.jpg | feeder-large.webp |
| 小弹丸中心供弹.jpg | feeder-small.webp |

## 开发习惯

- Git 提交风格：简洁中文，前缀用 `feat:` / `fix:` / `perf:` / `docs:` / `chore:`
- 推送到 `origin main` 后 GitHub Pages 自动部署（约 1-2 分钟）
- 本地测试：直接浏览器打开 `docs/index.html`

## 注意事项

- 不要恢复 `.jpg` / `.png` 旧图片，所有引用已统一为 `.webp`
- 单图项目的 gallery HTML 已简化，不要为多图项目之外的区块添加 `gallery-thumbs`
- 配色变量集中在 `style.css` 的 `:root`，改版时只改此处即可
