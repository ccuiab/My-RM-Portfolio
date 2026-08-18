# 英文版作品集 (docs/en.html) — 设计文档

日期：2026-08-18
状态：待评审

## 1. 目标与非目标

### 目标

在保留现有中文作品集完全不变的前提下，新增一份英文版页面，面向不熟悉 RoboMaster 的国际读者。翻译要求「信达雅」——按英文工程写作习惯重写，而非逐字对译；专业名词准确。视觉风格与中文版严格统一，但换行、行距等拉丁排版细节按英文习惯合理处理。

### 非目标

- 不翻译 `docs/cv-for-pdf.html`、`docs/CUIChuhanCV.md`、`README.md`。本次范围仅 `docs/index.html`。
- 不重构信息架构。英文版不重排 bullet 顺序、不合并或删减条目。
- 不改动中文版任何文案、样式或结构（唯一例外见 §2.3 的一行语言切换链接）。
- 不新建独立仓库，不复制图片资源。

## 2. 文件架构

### 2.1 新建 `docs/en.html`

从 `docs/index.html` 复制 DOM 骨架，替换全部文本节点。

必须原样保留：

- 全部 `class` 属性
- 全部 `id` 属性（`#about`、`#projects`、`#proj-engineering`、`#proj-controller`、`#proj-hero`、`#proj-exo`、`#research`、`#awards`、`#rd-arm`、`#rd-pump`、`#rd-eng-wheel`、`#rd-feeder`、`#rd-hero-chassis`、`#main`、`#modal`、`#modal-img`、`#bgSlideshow`、`#menuToggle`）
- 全部 `img` 的 `src` / `width` / `height` / `loading` / `decoding`
- 全部 `onclick` 内联处理器与 `data-gallery` 属性
- 全部 emoji 数字实体（`&#128736;` 等）、`·` 分隔符

`id` 保留是硬性要求：`script.js` 的 `sectionIds` 数组硬编码了这些 id，任何改动都会让英文页的 scroll spy 失效。

差异点：

- `<html lang="en">`（中文版为 `zh-CN`）
- `<title>CUI Chuhan — Portfolio</title>`
- `alt` 文本译为英文
- 侧边栏 `.contact` 区内的语言切换链接指向 `index.html`

### 2.2 追加 `docs/style.css`

在文件末尾追加一节 `html[lang="en"]` 作用域的排版覆盖（见 §5）。中文页 `lang="zh-CN"` 不命中任何选择器，渲染结果不变。

### 2.3 修改 `docs/index.html`（一行）

在侧边栏 `.contact` 区现有两个链接之后追加：

```html
<a href="en.html"><span class="icon">&#127760;</span>English</a>
```

复用 `.contact a` 与 `.icon` 现有样式，无需新增 CSS。英文页对应位置为：

```html
<a href="index.html"><span class="icon">&#127760;</span>中文</a>
```

### 2.4 零改动

`docs/script.js` 不改。它按 class 和 id 选择元素，不含任何中文字符串。

图片全部位于 `docs/` 同级目录，相对路径不变，不复制任何二进制文件。

## 3. 术语表

### 3.1 RoboMaster 赛事

首次出现处用极短同位语点明任务本质，后文直接用术语。

| 中文 | 英文 |
|---|---|
| 工程机器人 | Engineer robot |
| 英雄机器人 | Hero robot |
| 兑矿 / 取矿 | ore exchange / ore retrieval |
| 4 级矿石 | level-4 ore |
| 矿槽 | ore slot |
| 云台 | gimbal |
| 底盘 | chassis |
| 裁判系统 | referee system |
| 大弹丸 | 42 mm projectile |
| 小弹丸 | 17 mm projectile |
| 侧供弹 / 中心供弹 | side-feed / centre-feed ammunition system |
| 摩擦轮 | friction wheel |
| 发射机构 | launcher |
| 初速 | muzzle velocity |
| 散布 | dispersion |
| 弹频 | feed rate |
| 图传 | FPV video feed |
| 工程全明星 | Engineer All-Star |
| 小陀螺 | spin mode（首次出现写 `spin mode (continuous chassis rotation)`） |
| 兵种 | robot class |
| 场间排障 | between-match troubleshooting |
| 飞坡 | ramp jump |
| 上台阶 | step climbing |

### 3.2 机械与传动

| 中文 | 英文 |
|---|---|
| 六轴机械臂 | 6-DOF manipulator |
| PUMA 构型 | PUMA configuration |
| 连杆参数 | link parameters |
| 工作空间 | workspace |
| 末端 / Wrist 末端 | wrist / end effector |
| 舵轮模组 | swerve module |
| 舵下悬挂 / 舵上悬挂 | under-module / over-module suspension |
| 自适应悬挂 | adaptive suspension |
| 麦克纳姆轮 | Mecanum wheel |
| 电滑环 | electrical slip ring |
| 中空旋转气动接头 | hollow rotary union |
| 万向轴传动 | U-joint driveshaft |
| 锥齿轮 | bevel gear |
| 等速同步轮 | constant-velocity timing pulleys |
| 减速箱 | gearbox |
| 风琴吸盘 HB80 | HB80 bellows suction cup |
| 气弹簧 | gas spring |
| 预紧压簧 | preloaded compression spring |
| MGN7 滑轨 | MGN7 linear rail |
| 光电门校准 | photoelectric homing sensor |
| 聚氨酯轮 | polyurethane wheel |
| 实心橡胶轮 | solid rubber tyre |
| 快拆 | quick-release |
| 防卡滞 | anti-jam |
| 背隙 | backlash |
| 真空度 | vacuum level |
| DH 参数法 | Denavit–Hartenberg (DH) parameters |
| 运动学建模 | kinematic modelling |
| 公差修正 | tolerance correction |
| 钣金 | sheet metal |

### 3.3 已裁决的三处

**对轴摩擦轮** — 指摩擦轮轴两端均由轴承支撑以提升结构刚度，非两组轮对置。译 `double-supported friction wheels`。首次出现处补破折号说明：`bearings at both ends rather than a single overhung mount`。

与预研节的「双级四/六摩擦轮」不冲突：后者指加速级数，译 `dual-stage four-/six-wheel launcher`。两词各自成立。

**小陀螺** — 官方英文规则无对应词。首次出现写 `spin mode (continuous chassis rotation)`，后文用 `spin mode`。

**WR** — 保留原字母 `WR`，不展开为 `world record`，不改写为 `record`。用户确认这是官方用词。涉及 `index.html` 行 49、123、156 三处。

### 3.4 其他判断

- `CPEG` 展开为 `Computer Engineering (CPEG)`（HKUST 官方项目名）
- 「四轴手臂外骨骼（课设）」译 `4-DOF Arm Exoskeleton (Course Project)`
- 姓名统一写 `CUI Chuhan`（姓氏全大写前置），与现有文件名 `CUIChuhanCV.md` 一致

## 4. 翻译风格准则

**准则 1：主语落在物件上。** 中文惯用「采用 X，实现 Y」，英文照搬会变成无主语的动名词堆。让结构本身做主语。

> `采用 5 寸实心轮、3508 减速箱、MGN7 滑轨与气弹簧舵下悬挂，提升抓地、脱困与兑矿时底盘稳定性`
> → `Five-inch solid tyres, a custom 3508 gearbox, MGN7 rails and gas-spring under-module suspension together give the chassis the grip to break free of obstacles and the stability to hold position during an exchange.`

**准则 2：虚动词换具体动词。** `实现末端电/气一体传输` → `carry both power and air through`；`兼顾长臂展与末端刚度` → `balances reach against wrist stiffness`。避免 `realise` / `achieve` / `adopt` 的机翻质感。

**准则 3：数字与单位绑定。** 单位前用 `&nbsp;` 防止孤字换行，格式统一：

- `5.8s` → `5.8&nbsp;s`
- `40 L/min` → `40&nbsp;L/min`
- `-85 kPa` → `−85&nbsp;kPa`（真减号 U+2212）
- `25×25cm` → `25×25&nbsp;cm`
- `38 kg` → `38&nbsp;kg`
- `590×590×540 mm` → `590×590×540&nbsp;mm`
- `2Hz` / `20 Hz` / `30 Hz` → `2&nbsp;Hz` / `20&nbsp;Hz` / `30&nbsp;Hz`
- `5000 rpm` → `5000&nbsp;rpm`
- `±0.1m/s` → `±0.1&nbsp;m/s`
- `30cm` / `15cm` / `8cm` → `30&nbsp;cm` / `15&nbsp;cm` / `8&nbsp;cm`
- `<300 g` → `&lt;300&nbsp;g`
- `380 mm` / `420 mm` → 加 nbsp

原有 `<strong>` 加粗位置全部对应保留。

**准则 4：因果显式化。** 中文靠并置暗示因果，英文需连接词。

> `悬挂结构削弱重机械臂高速动作对底盘姿态的扰动，支持边移动底盘边操作机械臂`
> → 用 `so that` 把后半句挂成结果

**准则 5：每条 bullet 一句话，不超过约 28 词。** 超长则拆句，但不合并、不删减 bullet。条数与中文版严格 1:1，便于 diff 校验。

**准则 6：视觉语言原样沿用。** emoji、`·` 分隔符、`▹`/`▸` 列表符号与语言无关，全部保留。

**准则 7：英式拼写。** 贴合 HKUST 语境。实际影响面：`Honours & Awards`、`optimise`、`optimisation`、`tyre`、`stabilise`、`minimise`、`analyse`、`aluminium`、`modularised`、`centre`。专有名词不受影响（`Dean's List` 保持原样）。

英式拼写仅约束**可见文案**，不约束代码标识符。现有 class 名 `honors-card` / `honors-list` 为美式拼写，必须原样保留——改名会导致 CSS 选择器失配。同理 `alt` 属性内容算可见文案（走英式），`data-gallery` 的值算标识符（原样保留）。

## 5. 排版处理

### 5.1 CSS 追加内容

追加到 `docs/style.css` 末尾：

```css
/* ===== English page: Latin typography tuning ===== */
html[lang="en"] .skill-block ul,
html[lang="en"] .honors-list          { line-height: 1.75; }
html[lang="en"] .project-desc,
html[lang="en"] .research-card ul,
html[lang="en"] .launcher-notes       { line-height: 1.7; }
html[lang="en"] .detail-block ul li,
html[lang="en"] .subsystem-list       { line-height: 1.65; }

html[lang="en"] .sidebar-header .name { letter-spacing: 1px; }

html[lang="en"] .section-title,
html[lang="en"] .project-header h3,
html[lang="en"] .project-subtitle,
html[lang="en"] .detail-block h5,
html[lang="en"] .subsystem-header,
html[lang="en"] .launcher-caption     { text-wrap: balance; }

html[lang="en"] .subsystem-list,
html[lang="en"] .detail-block ul li   { hyphens: auto; }
```

理由：

- 中文靠字身撑开行距，`line-height: 2` 的技能列表换成英文会散架，1.75 是等效视觉密度
- `letter-spacing: 2px` 适合汉字，对 `CUI Chuhan` 偏空
- `text-wrap: balance` 治标题末行掉单词，三栏子系统卡片（约 200px 宽）最易出现
- `hyphens: auto` 只给最窄的两处容器，靠 `lang="en"` 生效

`font-family` 不改。CJK 字体需留在栈里供「中文」切换链接使用。

### 5.2 导航短标签

侧边栏子项可用宽度约 196px，全称会折行。导航用短标签，正文标题用全称：

| 导航（短） | 正文标题（全） |
|---|---|
| `Profile` | `Profile` |
| `Projects` | `Projects` |
| `2025 Engineer Robot` | `RoboMaster 2025 Engineer Robot` |
| `Custom Controller` | `Custom Controller` |
| `2024 Hero Robot` | `RoboMaster 2024 Hero Robot` |
| `4-DOF Exoskeleton` | `4-DOF Arm Exoskeleton (Course Project)` |
| `Pre-Research` | `2024-2025 Technical Pre-Research & Module Development` |
| `Honours & Awards` | `Honours & Awards` |

侧边栏 `.subtitle` 与 `.badge` 保持原内容（已是英文）。

### 5.3 已知的三处需重写以控长

以下位置英文膨胀后可能影响布局，翻译时优先选短表达：

- `.project-subtitle`（三段式，行 97 / 235 / 281 / 354）
- `.launcher-caption`（三图并排，每格约 1/3 宽）
- `.system-group-title`（`text-transform: uppercase` 会进一步增宽）

## 6. 验证方式

### 6.1 结构一致性（机械验证）

写一次性脚本，从 `index.html` 与 `en.html` 抽取骨架序列（标签名 + class + `img src` + `id`），逐行 diff。期望零差异。

同时单独比对每个 `<ul>` 的 `<li>` 条数，验证准则 5 的 1:1 约束。

脚本为临时产物，放 scratchpad，不进仓库。

### 6.2 渲染合理性（视觉验证）

三个断点逐个截图：>1100px、801–1100px、≤800px。重点检查：

- 侧边栏名字与导航标签是否溢出 280px / 240px
- 三栏子系统卡片（约 200px 宽）的标题与 bullet 换行
- `.project-subtitle` 三段式在中等宽度下的折行位置
- `.launcher-caption` 图注换行

同断点下与中文页对照，确认卡片高度、留白节奏无明显失衡。

同时在 ≤800px 下验证汉堡菜单与导航跳转在英文页正常工作（共用 `script.js`，理论上无差异，但需实测确认）。

### 6.3 风格评估

英文页写完且 6.1 / 6.2 通过后，调用 `frontend-design` skill 审视排版判断：行距是否等效、`text-wrap: balance` 是否用在对的位置、有无遗漏的单位 nbsp。

### 6.4 问题处理原则

优先调 `html[lang="en"]` 那节 CSS，其次改英文措辞（缩短词组）。不改 DOM 结构，不动中文版。

## 7. 未决事项

无。§3.3 三处术语已由用户裁决，导航标签与英式拼写已确认。
