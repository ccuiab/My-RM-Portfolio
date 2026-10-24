# 离线素材制作

本目录保存成片渲染、场地预览和相关运动学工具的 TypeScript 源码。网站运行时代码位于 `src/`，不得反向导入本目录。

- `engineer-mission/`：工程任务成片、轨迹、碰撞与弹丸计算；入口是仓库根目录运行的 `node scripts/build-engineer-mission.mjs`。
- `field/`：RM2025 场地预览；入口是 `node scripts/build-rm2025-field-preview.mjs`。
- 共享的机械臂运动学仍由 `src/scripts/lib/` 提供，离线工具单向引用；中英文文案仍来自 `src/data/content.ts`。

生成的场景、模型和视频归 `materials/`，不得写入本目录。构建入口会更新派生素材；仅验证路径或类型时，在仓库根目录运行 `npx tsc --noEmit -p scripts/authoring/tsconfig.json`，或将 esbuild 输出设为 `tmp/`。

## 旧路径定位

2026-10-24 将离线源码移出 `src/`，保留文件名与运算逻辑。现有成片的 `engineer-mission.source.json` 与历史审计保留制作时的路径和证据；按下表定位当前源码，本次迁移没有重新渲染或重新认证这些历史成片。

| 制作记录中的旧路径 | 当前路径（相对仓库根） |
| --- | --- |
| `src/scripts/engineer-mission-film.ts` | `scripts/authoring/engineer-mission/engineer-mission-film.ts` |
| `src/scripts/lib/engineer-mission-motion.ts` | `scripts/authoring/engineer-mission/engineer-mission-motion.ts` |
| `src/scripts/lib/engineer-mission-empty.ts` | `scripts/authoring/engineer-mission/engineer-mission-empty.ts` |
| `src/scripts/lib/engineer-mission-collision.ts` | `scripts/authoring/engineer-mission/engineer-mission-collision.ts` |
| `src/scripts/lib/engineer-mission-projectiles.ts` | `scripts/authoring/engineer-mission/engineer-mission-projectiles.ts` |
| `src/scripts/lib/engineer-mission-wheel-roll.ts` | `scripts/authoring/engineer-mission/engineer-mission-wheel-roll.ts` |
| `src/scripts/lib/engineer-station-rig.ts` | `scripts/authoring/engineer-mission/engineer-station-rig.ts` |
| `src/scripts/rm2025-field-preview.ts` | `scripts/authoring/field/rm2025-field-preview.ts` |
