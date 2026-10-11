# My-RM-Portfolio 项目指引

这是崔楮焓 / Chuhan Cui（ccuiab）的 RoboMaster 机械作品集。仓库为 `ccuiab/My-RM-Portfolio`，线上地址为 https://ccuiab.github.io/My-RM-Portfolio/ 。

## 修改与部署

- 当前网站是 `main` 分支上的 Astro 版本，通过 `.github/workflows/deploy.yml` 手动部署到 GitHub Pages。
- 执行用户已授权的部署时，先完成构建和页面检查，再提交、推送并触发工作流；以工作流成功和线上页面检查作为完成依据。
- 更改托管平台、Pages 发布源或合并其他分支，需要先获得用户授权。
- 提交信息使用简短中文，前缀为 `feat:`、`fix:`、`perf:`、`docs:` 或 `chore:`。

## 目录与构建

- `materials/` 是唯一素材总目录，各类 `images/`、`models/`、`videos/`、`fonts/`、`documents/` 下统一用 `source/` 保存收到的原始输入、`derived/` 保存提取、剪辑、编辑和生成的二级材料。CAD 原生文件在外部只读目录，本仓库的 CAD 导出与截图均归二级材料。
- 整理素材时先核对页面引用、加工依赖和来源证据，再清理未使用的二级材料；路径、来源与删除记录见 `materials/README.md`、`materials/cleanup.json`。运行 `npm run materials:inventory` 刷新清单。
- `src/` 只放网页源码。全部中英文文案保存在 `src/data/content.ts` 的 `{ zh, en }` 字段中；页面组件从数据文件取文案。
- `npm run dev` 启动开发服务器；`npm run build` 准备静态资源、生成中文字体子集并构建网页；`npm run preview` 预览当前构建。
- 当前网页输出到 `publish/current/`。每次成功构建自动在 `publish/history/` 保存独立版本。历史目录、版本标识和保存方式见 `publish/VERSIONS.md`、`publish/versions.json`。
- `npm run archive:history` 恢复 GitHub 发布记录对应的历史网站。保留“原始发布包”“从源码重建”“旧版静态快照”的区别，不把重建结果称为原始发布包。
- `.astro-public/` 是由素材生成的临时静态目录，直接编辑 `materials/` 中的原文件。生成目录和大型本地档案由 Git 忽略。
- `site`、`base: '/My-RM-Portfolio'` 位于 `astro.config.mjs`；站内地址统一经 `href()` 或 `import.meta.env.BASE_URL` 生成。
- 构建时的文件检查以 `process.cwd()` 为根目录。新中文文案通过重新构建纳入得意黑字体子集。

## 页面与素材约束

- 保持碳色深蓝底与唯一琥珀色强调色 `--amber`，配色定义位于 `src/styles/global.css`。红蓝只用于装甲灯条和实时状态。
- 图号、章节字母、机器人编号和技能 BOM 表都应表达真实信息。白底 CAD 图片沿用 `--plate` 与 `mix-blend-mode: multiply`。
- 工程页顶部保留工程标题和整车 3D；B 站介绍视频位于标题区下方、A/B 章节之前；工程页的 5.8 s 成绩只展示一次。
- A 章为兑矿六轴示意动画，B 章支持全臂爆炸、恢复和旋转；C 章舵轮支持爆炸与转向/滚动演示，D 章气泵有转动演示。电机保持整体与原装配位置。
- 工程页片尾彩蛋区展示上台阶、偷银矿和抢矿三段静音循环；视频在 `materials/videos/derived/web/egg-*.mp4`，封面在 `materials/images/derived/video-posters/egg-*.jpg`，剪辑输入在 `materials/videos/derived/inputs/`，由 `scripts/cut-eggs.ps1` 生成。
- 预研部分统一使用图片。
- 网站事实须能追溯至 `materials/documents/source/CUIChuhanCV.md`、历史网站、官方转播或用户说明。新增且未经确认的事实标明待确认。

## 3D 与原始文件

- 网站模型位于 `materials/models/derived/web/`，包括 `arm.glb`、`arm-parts.glb`、`arm-parts.json`、`engineer-swerve.glb`、`engineer-pump.glb` 和 `engineer-modules.json`；Draco 解码器在 `draco/` 子目录，发布时仍使用 `models/` 网址。
- `arm.glb` 的节点为 `link_base…link_6`，各原点位于关节轴，旋转轴记录在 `extras.web_axis`；单位姿态为 CAD 原始折叠姿态。兑矿示意交互在 `src/scripts/arm-exchange-scene.ts`。
- 全臂爆炸使用 `arm-parts.glb`、`arm-parts.json`、`src/components/ArmExplode.astro` 和 `src/scripts/arm-explode-scene.ts`；手机端与减少动态效果模式使用 `materials/images/derived/site/cad-cutouts/arm-exploded.png`。旧腕部素材的清理位置见 `materials/cleanup.json`。
- 运动学推导、源文件映射和审计报告保存在 `materials/documents/derived/audits/`；当前模型处理需要的 CAD 导出、Blender 工程、URDF 和网格位于 `materials/models/derived/inputs/`。历史报告中的旧路径通过迁移清单和 `materials/cleanup.json` 定位。
- `D:\RM2025` 和 OneDrive 中的源 CAD 对所有工具都只读。只在本仓库的派生文件上加工。
- 视频原片在 `materials/videos/source/`，当前剪辑及其输入在 `materials/videos/derived/`，封面在 `materials/images/derived/video-posters/`；保留素材来源记录，5.8 s 成绩剪辑沿用 `scripts/cut-record.ps1`，片尾彩蛋剪辑使用 `scripts/cut-eggs.ps1`。

`CLAUDE.md` 是指向本文件的相对软链接；项目规则只维护这一份。
~
