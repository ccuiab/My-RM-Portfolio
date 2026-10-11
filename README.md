# My-RM-Portfolio

崔楮焓 / Chuhan Cui 的 RoboMaster 机械作品集。当前 Astro 网站通过 `main` 分支的 GitHub Actions 手动发布至 https://ccuiab.github.io/My-RM-Portfolio/ 。

## 目录

```text
materials/                    素材总目录
  images/
    site/                     网页图片与 CAD 配图
    generated/                生成的线稿
    video-posters/            视频封面
    web/                      分享图与网站图标
    archive/                  历史图片、原生截图和审阅预览（本地）
  models/
    web/                      网页 GLB、JSON 与 Draco 解码器
    source/                   原始导出、Blender、URDF 与网格（本地）
  videos/
    web/                      网页视频与来源说明
    source/                   视频原片和素材片段（本地）
  fonts/
    source/                   源字体
    subsets/                  网页使用的字体子集
  documents/
    CUIChuhanCV.md             网站事实来源
    pdf/                      已生成的作品集 PDF（本地）
    audits/                   素材来源、技术报告和迁移清单（本地）
publish/                      发布总目录
  current/                    当前完整网页（本地构建或 CI 生成）
  history/                    按版本保存的完整旧网页（本地）
  VERSIONS.md                 版本索引（自动生成）
  versions.json               时间、Git 提交和保存方式（自动生成）
src/                          Astro 页面、组件、文案与交互代码
scripts/                      构建、素材处理与版本归档脚本
AGENTS.md                     中文项目指引
CLAUDE.md                     指向 AGENTS.md 的相对软链接
```

`.astro-public/` 为构建时生成的静态资源缓存，素材源文件只维护在 `materials/`。已移除不参与当前网站的旧 PDF 工具、浏览器日志和临时缓存；已生成的 PDF、CAD 来源及历史网页仍有归档。

## 开发与发布

```powershell
npm ci
npm run dev
npm run build
npm run preview
```

`npm run build` 会准备静态资源、生成得意黑字体子集，输出到 `publish/current/`，并自动保存到 `publish/history/<时间与提交>/`。部署工作流只上传 `publish/current/`，历史网页不会混入线上站点。模型与视频的网址仍分别为 `models/`、`video/`，站点 base 为 `/My-RM-Portfolio`。

`materials/models/web/` 或 `materials/videos/web/` 修改后，重新执行开发或构建命令即可刷新临时静态目录。全部网站文案位于 `src/data/content.ts`。

## 历史版本

```powershell
npm run archive:history
```

此命令使用 `gh` 的现有 GitHub 登录和 Git，恢复仓库的 GitHub Pages 发布记录：仍可下载的原始包直接解包；已过期的 Astro 包从对应 Git 提交和相同依赖版本重建；旧版手写网站保存为静态源码快照。每个目录的 `version.json` 标明保存方式，重复提交的发布记录合并到同一版本。

预览指定旧版 Astro 网站时执行：

```powershell
npm run preview -- --outDir publish/history/<版本目录>
```

历史网页和大型原始素材只保存在本地，不重复提交进 Git。源码历史保留在 Git 中；自动归档不会覆盖之前的版本。目录整理的文件去向、大小及 SHA-256 位于 `materials/documents/audits/reorganization/migration.json`。

Windows 克隆时启用 `git -c core.symlinks=true clone ...`，并确保系统支持符号链接。项目规则以中文 `AGENTS.md` 为准。
