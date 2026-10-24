# 工具脚本

网页构建、发布归档和素材索引的实现按职责分组。根目录保留同名 CLI 入口，使现有命令、来源记录和历史 Git 提交恢复流程继续可用。

```text
scripts/
  build/          准备静态资源、生成字体子集
  archive/        保存当前版本、恢复历史版本、刷新版本索引
  materials/      扫描素材与生成索引
  authoring/      离线影片、运动编排与场地预览的 TypeScript 源码
  lib/            共享路径、Git 来源状态与版本索引
  tests/          工具链与运行逻辑的 Node 测试
  *.mjs/*.py/...  兼容入口和按领域命名的模型、媒体制作与审计工具
```

## 常用入口

| 目的 | 命令 | 前提与写入范围 |
| --- | --- | --- |
| 本地开发 | `npm run dev` | 刷新 `.astro-public/` 并启动 Astro |
| 完整构建 | `npm run build` | 刷新字体子集、`publish/current/` 并新增独立历史快照 |
| 字体子集 | `npm run fonts` | 从 `src/` 提取字符，更新派生字体 |
| 恢复历史网页 | `npm run archive:history` | 需要 Git、现有 `gh` 登录和匹配依赖；写入 `publish/history/` 并刷新索引 |
| 仅刷新版本索引 | `npm run archive:index` | 只更新 `publish/versions.json` 和 `publish/VERSIONS.md`，不新增网页副本 |
| 素材清单 | `npm run materials:inventory` | 扫描含本地忽略文件的整个 `materials/`；更新 CSV、Markdown 与 SHA-256 |
| 类型与逻辑检查 | `npm run check` | 运行 TypeScript 与 Node 测试；不构建网站或处理素材 |
| 逻辑测试 | `npm test` | 运行 `tests/*.test.mjs`；工具链用临时目录验证来源状态和版本索引 |

`archive-current.mjs` 只在成功构建后调用。单纯刷新列表使用 `archive-index.mjs`。版本索引按版本 id 合并旧索引、恢复记录和各历史目录的 `version.json`；不会按 Git 提交合并不同的本地构建，也不会把源码重建标为原始发布包。

`lib/paths.mjs` 以模块位置解析仓库根，基础工具不依赖启动目录。素材制作与历史审计脚本仍按各自注释从仓库根执行。

## 模型、媒体与审计

这些领域脚本保留既有文件名和相对路径，避免破坏加工依赖与历史来源记录。它们不参与普通网站构建。

| 领域 | 主要入口 | 环境与注意事项 |
| --- | --- | --- |
| 机械臂 / 舵轮 CAD | `build-arm-parts.py`、`build-arm-context.py`、`build-swerve-context.py`、`export-module-parts.py` | Blender 与当前派生 CAD 输入；`build-arm-parts.py` 的 `Cad` 类仍被其他脚本引用 |
| 联动限位 | `build-linked-limit-study.py`、`check-linked-limit*.py` / `.mjs` | Python 依赖见 `arm-study-requirements.txt`；输入与审计位置见脚本 |
| A 章行动短片 | `build-engineer-mission.mjs`、`render-engineer-mission.mjs`、`join-engineer-mission.mjs` | 需要派生场地、模型、浏览器与 FFmpeg；完整流程见 `materials/README.md` |
| B 章与运动校验 | `check-arm-*.mjs`、`check-engineer-mission-*.mjs`、`verify-swerve-explosion.mjs` | 选择与当前版本匹配的检查；数值通过不代替实际渲染审阅 |
| 比赛视频 | `download-bilibili.py`、`catalog-bilibili.py`、`cut-record.ps1`、`cut-eggs.ps1` | `yt-dlp`、FFmpeg 与已确认来源；原片保持只读 |
| 图片派生 | `lineart.mjs`、`og-image.mjs`、`contact-sheet.mjs` | 当前 Node 环境中的 `sharp` |
| 网页视觉检查 | `check-engineer-preview-revision.mjs`、`check-arm-finale-browser.mjs` | 已运行的预览服务、Playwright / Chromium；截图仍需实际查看 |

部分离线脚本当前使用 Astro 间接提供的 `esbuild` / `sharp`，或本机浏览器与 CAD 工具。它们的安装条件不等同于网页构建依赖；迁移环境前应核对对应入口。过往审计脚本可能绑定旧时间轴，不应一概作为当前页面的验收标准。

`materials/*/source/` 和外部 CAD 原件保持原始输入；加工只写 `materials/*/derived/`。共享路径与索引重构不会迁移素材、改动公开 `models/` / `video/` 网址或触发部署。
