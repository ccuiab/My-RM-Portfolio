# 全臂爆炸视图验证

任务：arm-explode；分支：polish-arm-explode。只在本 worktree 写入；主仓库的处理输入与 D:\RM2025、OneDrive CAD 源文件只读，没有写入。

## 模型与来源

- 原 `arm.glb` 只有 8 个合并后的 link 节点，没有零件层级。
- 从主仓库 `materials/models/derived/inputs/codex/arm_tagged.glb`、`base_tagged.glb` 读取零件，按 `materials/documents/derived/audits/codex/arm_source_mapping.json` 保留 387 个来源节点；文件 SHA-256、原节点名与索引保存在 `arm-parts.json`。
- 导出 `arm-parts.glb`：108 个对象，5 个完整电机对象固定在原装配位置；电机内部不爆炸。CAD 分段的同步带按同一 link 与规格保持整体。未退回 link 级。
- Blender 5.1.1 导出，Draco 压缩 1,104,972 bytes。减面后导出 152,356 个三角形，浏览器解码后实际绘制 152,185 个三角形、108 次绘制调用。
- 与原 `arm.glb` 的装配包围盒最大差异 0.0235 mm，保持米制单位与同一 CAD 坐标系。没有修改 A 章或英雄页的模型。
- GLB 节点名与来源名逐项一致，HUD 读取模型中的原节点名，关节归属沿用现有 link 映射；不猜测中文翻译。

## 设计与检查

爆炸按关节轴与正交装配方向做直线外移，距离由零件尺寸和间距约束共同决定。布局求解可复现，最长外移约 0.615 m。全爆炸态的保守包围盒没有交叠；原本互不重叠的包围盒在连续过渡中也没有新增穿越。初始装配的包围盒交叠不等于实体碰撞，因此这不是 CAD 拆装路径仿真或机械碰撞认证。

保留爆炸、恢复、旋转，加入 GSAP 连续滑块、拖拽、有限缩放、键盘旋转与悬停高亮。镜头随当前零件范围调整，保留用户的观察方向与缩放比例。使用现有深蓝底、字体与 `--amber`，没有新增 npm 依赖。

进入视口才加载并绘制，静止时按需渲染；离屏与后台暂停。自动旋转最多 30 次绘制/秒；DPR 上限 1.25、单个 Draco worker，无阴影与后处理。手机端与 reduced-motion 使用透明静态 PNG；动态切换 reduced-motion 后能够恢复 3D。下列浏览器检查已通过：

- 延迟加载、空闲零绘制、离屏零绘制。
- 自由拖拽、键盘视角、滚轮缩放与复位。
- 自动旋转、减少动态效果模式的切换与恢复。
- 390×844 手机视口：不请求全臂模型、显示静态图、控件隐藏、组件没有横向溢出。
- 中英文文案，页面脚本错误为 0。

截图均在 1440×900 视口、3D 加载完成后取得，位于 `C:\Users\cch20\AppData\Local\Temp\rm-shots\arm-explode\`：

1. `01-assembled.png`：装配态。
2. `02-half-exploded.png`：50% 爆炸。
3. `03-exploded-hover.png`：全爆炸，悬停高亮 `6mm_L6_侧板-1`，归属 `J4 · link_4`。
4. `04-reduced-motion.png`：静态降级。

`npm ci`、TypeScript 检查和 `npm run build` 通过。构建仍有 Three.js 相关 chunk 大于 500 kB 的提示；全臂模块按视口动态加载。验证浏览器使用 SwiftShader 软件渲染，没有测得 MX450 的真实帧率。

## 交接与保留资产

EngineerPage 仅改了组件导入这一行，保留现有 JSX 别名以满足单行修改约束。删除已无文件引用的 `WristExplode.astro`、`wrist-scene.ts`、`sceneCopy.wristExplode` 与旧交互文案；更新 AGENTS.md。

以下旧资产均保留，清理由主控决定：

- `materials/models/derived/web/l4.glb`
- `materials/models/derived/web/l4.json`
- `materials/images/derived/site/cad-cutouts/l4-assembled.png`

重建命令：`"D:\Blender Foundation\Blender 5.1\blender.exe" --background --python scripts/build-arm-parts.py -- --source-root D:\AI_playground\My-RM-Portfolio`。`scripts/arm-explosion-layout.py` 使用 Blender 自带 NumPy；网站依赖未变。
