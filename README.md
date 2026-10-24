# My-RM-Portfolio

崔楮焓 / Chuhan Cui 的 RoboMaster 机械作品集。当前 Astro 网站通过 `main` 分支的 GitHub Actions 手动发布至 https://ccuiab.github.io/My-RM-Portfolio/ 。

## 目录

```text
materials/                    素材总目录
  images/
    source/                   收到的历史图片、官方原图与投稿封面
    derived/                  网页抠图、线稿、封面与处理输入
  models/
    source/README.md           外部只读 CAD 原件说明
    derived/web/              网页 GLB、JSON 与 Draco 解码器
    derived/inputs/           当前处理输入、Blender、URDF 与网格（本地）
  videos/
    source/bilibili/           完整下载原片与公开投稿（本地）
    derived/web/              当前网页剪辑与来源说明
    derived/inputs/           当前剪辑输入（本地）
  fonts/
    source/                   源字体
    derived/subsets/          网页使用的字体子集
  documents/
    source/                   原始事实资料、归档与来源页面
    derived/                  视频索引与来源、工程审计（审计在本地）
  README.md                   素材分层、来源和维护方式
  INVENTORY.md                素材总清单
  inventory.csv               完整文件清单与 SHA-256
  cleanup.json                本轮迁移和删除记录
publish/                      发布总目录
  current/                    当前完整网页（本地构建或 CI 生成）
  history/                    按版本保存的完整旧网页（本地）
  VERSIONS.md                 版本索引（自动生成）
  versions.json               时间、Git 提交和保存方式（自动生成）
src/                          网站源码
  pages/                      中英文路由，仅选择页面与语言
  components/                 页面组合、展示组件与交互入口
  layouts/                    全站布局、导航与元信息
  data/                       唯一中英文文案来源与语言工具
  scripts/                    浏览器控制器、模型变换与运行时共享模块
  scripts/lib/mechanism-timeline.ts  舵轮与气泵的纯数值时间轴
scripts/                      工具与验证
  build/                      运行资源暂存、字体子集
  archive/                    发布快照、历史恢复与索引
  materials/                  素材清单
  authoring/                  离线工程视频与场地预览源码
  lib/                       共享仓库路径与发布元数据逻辑
  tests/                      无浏览器的归档与动画回归测试
AGENTS.md                     中文项目指引
CLAUDE.md                     指向 AGENTS.md 的相对软链接
```

`.astro-public/` 为构建时生成的静态资源缓存，素材只维护在 `materials/`。分层说明见 [素材库](materials/README.md)：原始输入按收到的内容保存；二级材料保留当前展示、复现和溯源所需部分。

## 开发与发布

```powershell
npm ci
npm run dev
npm run check
npm run build
npm run preview
```

本地开发启动后，打开终端显示的地址，通常为 `http://localhost:4321/My-RM-Portfolio/`，并保持终端运行；按 `Ctrl+C` 停止。若提示已有开发服务运行，先在原终端停止，或执行 `npm run dev -- --force` 替换旧进程。

开发服务不监听 `publish/`、`tmp/` 和 `.venv/`：这些本地历史网页、临时文件和 Python 环境包含大量文件，监听它们会拖慢启动和页面响应。源码与网页使用的素材仍正常监听。

`npm run build` 会准备静态资源、生成得意黑字体子集，输出到 `publish/current/`，并自动保存到 `publish/history/<时间与提交>/`。部署工作流只上传 `publish/current/`，历史网页不会混入线上站点。模型与视频的网址仍分别为 `models/`、`video/`，站点 base 为 `/My-RM-Portfolio`。

`npm run check` 覆盖网站和离线工具的 TypeScript 类型，以及版本索引、源码状态和动画时间轴测试。开发与检查使用 Node 24 或更新版本（本地已用 Node 26 验证，部署使用 Node 24）。构建与数值检查通过后，页面交互仍需在桌面、手机和减少动态效果模式下检查。

## 代码边界

路由负责选择语言与页面，页面组件组合展示组件，展示组件通过浏览器控制器连接 Three.js 场景。`viewport-scene.ts` 统一管理可见性、异步取消和两个 WebGL 上下文配额；时间轴只计算状态，`module-motion.ts` 将状态应用到模型，场景模块负责加载与渲染。

离线工程视频和场地预览使用 [scripts/authoring](scripts/authoring/README.md)。这些工具可复用网站的运动学函数，网站运行时不反向导入离线入口。工程页 A 章播放生成的 MP4 与章节数据，修改离线源码需要单独生成和检查成片，普通网站构建不会重新渲染视频。`ArmExchange.astro` 及其场景保留为早期实时兑矿示意，当前 A 章使用 `EngineerMission.astro`。

工具脚本按职责组织，原有根目录命令保留兼容入口，供历史提交重建和已有操作习惯使用。CAD/Python 脚本仍保留原位置，因为部分脚本依赖固定路径和原始装配读取约定。具体入口与前提见 [scripts/README.md](scripts/README.md)。

`materials/models/derived/web/` 保存机械臂、整臂爆炸、舵轮和气泵模型；`materials/videos/derived/web/` 保存首页 5.8 s 成绩片段与工程页片尾的上台阶、偷银矿、抢矿三段静音循环，封面位于 `materials/images/derived/video-posters/`。片尾视频输入位于 `materials/videos/derived/inputs/`，源视频保留在 `materials/videos/source/bilibili/`，运行 `scripts/cut-eggs.ps1` 可重新剪辑。素材修改后重新执行开发或构建命令刷新临时静态目录。全部网站文案位于 `src/data/content.ts`。`npm run materials:inventory` 扫描完整本地素材库、计算 SHA-256，并更新 Markdown 和 CSV 索引。

## 历史版本

```powershell
npm run archive:history
npm run archive:index
```

`archive:history` 使用 `gh` 的现有 GitHub 登录和 Git，恢复仓库的 GitHub Pages 发布记录：能取得的原始包直接解包；已过期或下载不可用的 Astro 包从对应 Git 提交和相同依赖版本重建；旧版手写网站保存为静态源码快照。每个目录的 `version.json` 标明保存方式，重复提交的发布记录合并到同一版本。

`archive:index` 可独立刷新索引，不复制当前网页或创建新快照；归档元数据会区分干净提交和包含未提交、未跟踪源码的工作区构建。

预览指定旧版 Astro 网站时执行：

```powershell
npm run preview -- --outDir publish/history/<版本目录>
```

历史网页和大型原始素材只保存在本地，不重复提交进 Git。源码历史保留在 Git 中；自动归档不会覆盖之前的版本。早期目录迁移记录位于 `materials/documents/derived/audits/reorganization/migration.json`；本轮分类、去向与删除记录见 [cleanup.json](materials/cleanup.json)。

Windows 克隆时启用 `git -c core.symlinks=true clone ...`，并确保系统支持符号链接。项目规则以中文 `AGENTS.md` 为准。

## 2025 工程视频档案

已核实的视频按官方比赛、全明星、工程及监控视角、实车演示、精彩回顾和花絮分目录保存到 `materials/videos/source/bilibili/`。可读清单在 [Bilibili 视频索引](materials/documents/derived/bilibili-video-catalog.md)，机器可读清单记录原链接、UP 主、分 P、分辨率、时长和 SHA256。

下载工具为 `scripts/download-bilibili.py`，使用 `.venv` 中的 `yt-dlp` 和 `C:/ffmpeg/bin/ffmpeg.exe`；分段下载可断点续传，不需要浏览器 Cookie。下载结束后运行 `scripts/catalog-bilibili.py` 校验文件并刷新索引。原片保留在本地素材库，网站继续使用 Bilibili 介绍视频。

工程页片尾展示上台阶、偷银矿（复活赛对华东理工）和抢矿（全明星）三段静音循环。成片位于 `materials/videos/derived/web/egg-*.mp4`，封面位于 `materials/images/derived/video-posters/egg-*.jpg`；剪辑输入保存在 `materials/videos/derived/inputs/`，源视频位于 `materials/videos/source/bilibili/`。编辑参数和复现脚本分别见成片旁的 `egg-*.source.json` 与 `scripts/cut-eggs.ps1`。
