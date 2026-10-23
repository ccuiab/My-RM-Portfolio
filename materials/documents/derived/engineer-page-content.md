# 工程页展示内容底稿

2026-10-23 · 工程页视觉重构。中文与英文页面同步。

## 已确认的设计方向

以视觉观感为首要目标。产品发布式大画面为主，机械图纸标注为辅，比赛视频负责开场与片尾。整车、任务动画、机械臂为重点；舵轮、气泵和控制器缩短篇幅。默认只留标题、设计结论、关键参数；技术细节按需展开。保留现有机械动作、来源、示意边界和四段彩蛋。

色彩沿用 #070d17 深蓝底、#0c1626 面板、#e7eef6 正文、#9fb0c6 次级文字、#f2b53a 琥珀强调、#aebcca CAD 底板。标题沿用 Smiley Sans / Chakra Petch，正文沿用系统字体。左对齐；通过媒体尺度和留白区分主次，不增加装饰标签。

页面节奏：整车大画面与短标题 → 单一成绩重点与项目资料展开 → 官方纪录片 → A 任务动画 → B 全臂交互 → C 舵轮 → D 气泵 / E 控制器 → 四段赛场彩蛋。

## 展示内容与素材映射

| 模块 | 默认展示 | 深入内容 | 对应素材 / 事实依据 |
| --- | --- | --- | --- |
| 整车 | 工程机器人、2025、整车结构设计负责人；整车 3D | 周期、成本、质量及其他比赛统计 | engineer.glb；原有 engineer.titleBlock / stats；官方复活赛转播数据卡 |
| 成绩 | 5.8 s 四级矿石最短兑换时长，只出现一次 | 其余四项比赛统计与排名 | engineer.stats；原有 statsSource，不能外推为所有赛事纪录 |
| 开场 | 官方纪录片 | B 站原片与署名 | video/official-film.mp4；BV1Y482zjERP |
| A 整机架构 | 任务决定构型与工作空间 | 视野、UWB、操作链路等布局约束 | engineer-mission-zh/en.mp4；原 A 章；动作和场地为示意 |
| B 六轴机械臂 | 装配与传动；380 / 420 mm 连杆 | 中空电滑环、旋转气接头、J5/J6 传动 | arm-parts.glb/json；原 B 章；近零背隙属于原有实测陈述，未在本轮复测 |
| C 舵轮 | 转向、悬挂与轮驱的结构展示 | 结构说明、滑环与光电检测 | engineer-swerve.glb；悬挂幅度为示意，电机侧齿轮装配待确认 |
| D 真空泵 | 3508 无刷驱动；−85 kPa、>40 L/min（5000 rpm）、<300 g | 活塞原理与电流反馈 | engineer-pump.glb；原 D 章，参数未在本轮复测；动画转速与气流为示意 |
| E 控制器 | 与主臂同构、1:2 映射 | 操作手适配与肘位切换 | 原控制器 CAD 图；原 E 章 |
| 彩蛋 | 上台阶、偷银矿、抢矿、扶正英雄；视频与来源链接 | 场次、对手、动作 | egg-*.mp4 / jpg；保留原片链接、作者和官方转播署名 |

## 文字处理原则

- 删除重复图注、重复身份介绍及页面上的动画编排说明（秒数、镜头推拉、淡入淡出）。
- 技术说明收进原生 details；关键限制与示意说明仍保持可见。
- 原始内容完整附于下方；它是改版前数据快照，其中部分字段原本默认隐藏，不等同于旧页面所有可见文字。
- 动画内部字幕、按钮及模型运动本轮不重做。备份包括这些原始文案，可供后续继续整理。
- 事实来源沿用仓库原有记录与 materials/documents/source/CUIChuhanCV.md；不新增未经确认的性能结论。

## 改版前原文附录

源提交：`4d4ffa865ad6ebc35544074fbec24b5b01f24c6b`。以下为修改前 content.ts 中的原始中英文内容。

### 工程页主体

```ts
export const engineer = {
  slug: 'engineer',
  drawing: 'ENG-25',
  robotNo: '2',
  title: { zh: 'RoboMaster 2025 工程机器人', en: 'RoboMaster 2025 Engineer Robot' },
  short: { zh: '工程机器人 2025', en: 'Engineer 2025' },
  shortTag: { zh: '六轴机械臂与轮式末端', en: 'Six-axis + wheel' },
  lede: {
    zh: '六轴机械臂、轮式末端的工程机器人。我独立主导整车结构设计，从 PUMA 构型、连杆参数到整车布局。',
    en: 'An Engineer robot with a six-axis arm and a wheeled end effector. I led the whole-robot structural design, from the PUMA configuration and link lengths to the vehicle layout.',
  },
  cover: { src: engineerFront, cutout: true, alt: { zh: '工程机器人整车 CAD 渲染，车头 3/4 视角', en: 'Engineer robot CAD render, front three-quarter view' } } as Pic,
  assembly: { src: engineerFront, cutout: true, alt: { zh: '工程机器人整车 CAD 渲染，车头 3/4 视角', en: 'Engineer robot CAD render, front three-quarter view' } } as Pic,
  titleBlock: [
    { label: { zh: '赛季', en: 'Season' }, value: { zh: 'RMUC 2025', en: 'RMUC 2025' } },
    { label: { zh: '职责', en: 'Role' }, value: { zh: '整车结构设计负责人', en: 'Lead structural designer' } },
    { label: { zh: '周期', en: 'Timeline' }, value: { zh: '3 个月，从零到赛场', en: '3 months, concept to competition' } },
    { label: { zh: '成本', en: 'Cost' }, value: { zh: '8k–12k RMB', en: 'RMB 8k–12k' } },
    { label: { zh: '质量', en: 'Mass' }, value: { zh: '38 kg，含裁判系统', en: '38 kg incl. referee system' } },
  ] as TitleRow[],
  stats: [
    { label: { zh: '四级矿石最短兑换时长', en: 'Fastest level-4 ore exchange' }, value: '5.8', unit: 's', rank: '1st' },
    { label: { zh: '局均兑换经济', en: 'Exchange economy per round' }, value: '2005', rank: '1st' },
    { label: { zh: '局平均兑换难度', en: 'Average exchange difficulty' }, value: '3.9', rank: '1st' },
    { label: { zh: '单局最高兑换经济', en: 'Best single-round economy' }, value: '3250', rank: '2nd' },
    { label: { zh: '局均成功兑换矿石', en: 'Ores successfully exchanged per round' }, value: '5.2', rank: '2nd' },
  ] as Stat[],
  statsSource: {
    zh: '数据来自 RMUC 2025 复活赛官方转播数据卡。',
    en: 'Figures from the official RMUC 2025 repechage broadcast stats card.',
  },
  chapters: [
    {
      id: 'layout',
      mark: 'A',
      title: { zh: '整机架构与工作空间', en: 'Architecture and workspace' },
      lede: {
        zh: '从银矿岛取矿、车后储矿，到带矿越阶、旋转取矿与四级兑换，任务一步步决定 PUMA 构型、连杆长度和整车布局。',
        en: 'Silver retrieval, rear storage, loaded step climbing, spinning operation and level-4 exchange shape the PUMA configuration, link lengths and vehicle layout.',
      },
      bullets: [
        {
          zh: '机械臂工作空间、图传视野、UWB 布局和操作链路一起作为整机约束，先排布再出结构，碰撞风险和联调难度在设计阶段就压下来。',
          en: 'Arm workspace, FPV sight lines, UWB placement and the operator loop were treated as whole-robot constraints and laid out before any structure was drawn, so collision risk and integration effort came down at the design stage.',
        },
      ],
      scene: 'arm-unfold',
    },
    {
      id: 'arm',
      mark: 'B',
      title: { zh: '云台与六轴机械臂', en: 'Gimbal and six-axis arm' },
      lede: {
        zh: '装配层级与传动解析',
        en: 'Assembly hierarchy and transmission study',
      },
      specs: [
        { label: { zh: 'L2 上臂', en: 'L2 upper arm' }, value: '380', unit: 'mm' },
        { label: { zh: 'L3+L4 前臂', en: 'L3+L4 forearm' }, value: '420', unit: 'mm' },
      ],
      bullets: [
        { zh: 'J4 以中空电滑环和独立旋转气动接头过电过气，气管穿过电滑环。', en: 'J4 uses a hollow electrical slip ring and a separate rotary air union, with the air tube passing through the slip ring.' },
        { zh: 'J5/J6 采用等速同步轮、齿轮组与锥齿轮组合传动，J5 实测接近零背隙。', en: 'J5/J6 combine constant-velocity timing pulleys, gear sets and bevel gears; J5 measured close to zero backlash.' },
      ],
    },
    {
      id: 'chassis',
      mark: 'C',
      title: { zh: '高稳定舵轮底盘', en: 'High-stability swerve chassis' },
      lede: {
        zh: '重机械臂高速动作时，底盘要稳住。操作手可以边移动底盘边操作机械臂。',
        en: 'The chassis must remain stable while the heavy arm moves at speed. The operator can drive while working the arm.',
      },
      bullets: [
        {
          zh: '减速箱由太阳轮、行星轮与内齿圈传递驱动力，沿轮轴分层展开；悬挂由滑轨导向、气弹簧支撑，保留原装配关系。',
          en: 'The gearbox carries drive through the sun gear, planet gears and ring gear, with layers separated along the wheel axis. Rails guide the gas-spring-supported suspension, which retains its assembled relationships.',
        },
        {
          zh: '舵组齿轮的电机侧与大齿轮保持啮合、反向联动；转向电机与小齿轮一起上移，电机始终保持整体。',
          en: 'The motor-side and large steering-group gears stay meshed and turn in opposite directions. The intact steering motor rises with its pinion.',
        },
      ],
      pics: [{ src: engWheel, model: 'engineer-swerve.glb', cutout: true, alt: { zh: '工程舵轮模组：舵组齿轮、悬挂与减速箱的太阳轮、行星轮、内齿圈', en: 'Engineer swerve module: steering-group gears, suspension, and gearbox sun gear, planet gears and ring gear' } }],
    },
    {
      id: 'pump',
      mark: 'D',
      title: { zh: '3508 改装真空泵', en: '3508-converted vacuum pump' },
      lede: {
        zh: '原来的有刷气泵换成 3508 无刷电机驱动，避开供电冲击，流量上限也更高。',
        en: 'Swapping the original brushed pump motor for a 3508 brushless drive removed the supply-current spike and raised the flow ceiling.',
      },
      specs: [
        { label: { zh: '真空度', en: 'Vacuum' }, value: '−85', unit: 'kPa' },
        { label: { zh: '流量', en: 'Flow' }, value: '>40', unit: 'L/min', note: { zh: '5000 rpm', en: 'at 5000 rpm' } },
        { label: { zh: '整泵质量', en: 'Pump mass' }, value: '<300', unit: 'g' },
      ],
      bullets: [
        {
          zh: '曲柄带动一体式连杆活塞往复并摆动；泵腔扩大时吸气、缩小时排气，由两个单向阀切换。',
          en: 'The crank drives an integrated rod and piston through reciprocation and rocking. Two check valves switch intake as the chamber expands and exhaust as it contracts.',
        },
        {
          zh: '用电机电流反馈判断吸附状态，几乎零成本得到类似气压计的检测，掉矿风险可以提前发现。',
          en: 'Motor current feedback reads the suction state, giving barometer-like sensing at almost no cost and early warning of a dropped ore.',
        },
      ],
      pics: [{ src: pump, model: 'engineer-pump.glb', cutout: true, alt: { zh: '3508 改装真空泵', en: '3508-converted vacuum pump' } }],
    },
    {
      id: 'controller',
      mark: 'E',
      title: { zh: '自定义控制器', en: 'Custom controller' },
      lede: {
        zh: '工程机器人的输入终端。拓扑和主机械臂近似同构，按 1:2 映射，操作手不用在脑子里换算姿态。',
        en: 'The Engineer robot’s input device. Its topology mirrors the main arm with a 1:2 mapping, so the operator need not mentally convert hand motion into robot pose.',
      },
      bullets: [
        { zh: '按操作手的手臂数据调整 L2 位置，操作姿态更自然。', en: 'L2 was positioned from the operator’s arm measurements for a more natural posture.' },
        { zh: '四级矿兑换时可单手切换左右肘位，不必重置姿势。', en: 'During a level-4 exchange, the operator can switch elbow positions one-handed without resetting posture.' },
      ],
      pics: [{ src: controller, cutout: true, alt: { zh: '自定义控制器', en: 'Custom controller' } }],
    },
  ] as Chapter[],
  links: [
    { label: { zh: '机械开源（RoboMaster 论坛）', en: 'Open-source CAD (RoboMaster forum)' }, href: 'https://bbs.robomaster.com/article/803685?source=8' },
  ],
  eggs: {
    title: { zh: '彩蛋', en: 'Easter eggs' },
    matchLabel: { zh: '场次', en: 'Match' },
    opponentLabel: { zh: '对手', en: 'Opponent' },
    actionLabel: { zh: '动作', en: 'Action' },
    sourceLabel: { zh: '来源', en: 'Source' },
    watch: { zh: '看 B 站原片', en: 'Watch on Bilibili' },
    engineerWatch: { zh: '看工程视角原片', en: 'Watch the Engineer POV' },
    heroWatch: { zh: '看英雄视角原片', en: 'Watch the Hero POV' },
    povWatch: { zh: '看第一视角原片', en: 'Watch the original POV' },
    broadcastWatch: { zh: '看官方转播原片', en: 'Watch the original broadcast' },
    pending: { zh: '影像待补', en: 'Footage pending' },
    play: { zh: '播放', en: 'Play' },
    pause: { zh: '暂停', en: 'Pause' },
    seek: { zh: '定位片段进度', en: 'Seek within the clip' },
    items: [
      {
        index: '01',
        title: { zh: '上台阶', en: 'Climbing the steps' },
        match: { zh: 'RMUC 2025', en: 'RMUC 2025' },
        opponent: null,
        action: { zh: '接近台阶，连续登上两级平台', en: 'Approach the steps and climb onto both platforms' },
        source: { zh: 'UP 主 star_Light星', en: 'Creator star_Light星' },
        href: 'https://www.bilibili.com/video/BV1MV8nzFEcb?t=5',
        file: 'egg-stairs.mp4',
        poster: 'egg-stairs.jpg',
        layout: 'landscape',
        alt: { zh: '工程机器人接近台阶、攀上两级平台并在上层停稳的横屏演示', en: 'Landscape demonstration of the Engineer approaching the steps, climbing both platforms and settling on top' },
      },
      {
        index: '02',
        title: { zh: '偷银矿', en: 'Taking silver ore' },
        match: { zh: 'RMUC 2025 · 复活赛第 26 场', en: 'RMUC 2025 · Repechage match 26' },
        opponent: { zh: '华东理工大学', en: 'East China University of Science and Technology' },
        action: { zh: '第一视角取矿，再从第三视角看撤回我方一侧', en: 'Collect ore in first person, then see the return to our side from the broadcast' },
        source: { zh: '第一视角：翔林魔主 · 第三视角：RoboMaster 官方', en: 'POV: 翔林魔主 · Broadcast: RoboMaster official' },
        href: 'https://www.bilibili.com/video/BV1YN83zCEUy?p=8&t=1310',
        broadcastHref: 'https://www.bilibili.com/video/BV13T8ezrEwC?p=1&t=1023.8',
        file: 'egg-steal.mp4',
        poster: 'egg-steal.jpg',
        layout: 'landscape',
        alt: { zh: '港科大工程第一视角从蓝方银矿石岛取矿，随后官方镜头用琥珀框跟随红方工程撤回我方一侧', en: 'HKUST Engineer POV collecting ore from the blue silver-ore island, followed by an official shot with an amber box tracking its return to the red side' },
      },
      {
        index: '03',
        title: { zh: '抢矿', en: 'Ore interception' },
        match: { zh: 'RMUC 2025 · 全明星赛', en: 'RMUC 2025 · All-Star match' },
        opponent: { zh: '缔造者', en: 'Creators' },
        action: { zh: '从对方工程身上取矿，矿石落地后再次吸起', en: 'Take ore from the opposing Engineer, then pick it up again after it falls' },
        source: { zh: '第一视角：翔林魔主 · 第三视角：RoboMaster 官方', en: 'POV: 翔林魔主 · Broadcast: RoboMaster official' },
        href: 'https://www.bilibili.com/video/BV1YFhLz4Evi?p=10&t=2345',
        file: 'egg-grab.mp4',
        poster: 'egg-grab.jpg',
        layout: 'landscape',
        alt: { zh: '全明星赛第一视角：从蓝方工程携带位置取矿，矿石落地后再次吸起，最后以同期官方全景收尾', en: 'All-Star Engineer POV taking ore from the blue Engineer and retrieving it after it falls, ending with the synchronized official wide shot' },
      },
      {
        index: '04',
        title: { zh: '扶正英雄', en: 'Righting the Hero' },
        match: { zh: 'RMUC 2025 · 复活赛第 33 场', en: 'RMUC 2025 · Repechage match 33' },
        opponent: { zh: '哈尔滨工业大学（深圳）', en: 'Harbin Institute of Technology, Shenzhen' },
        action: { zh: '工程扶正翻倒的英雄', en: 'The Engineer rights the tipped Hero' },
        source: { zh: '工程与英雄第一视角：UP 主 翔林魔主', en: 'Engineer and Hero POVs: creator 翔林魔主' },
        href: 'https://www.bilibili.com/video/BV1Aw8gzoEZd?p=3&t=1092',
        heroHref: 'https://www.bilibili.com/video/BV1Aw8gzoEZd?p=2&t=1104',
        file: 'egg-right-hero.mp4',
        poster: 'egg-right-hero.jpg',
        layout: 'landscape',
        povLabel: { zh: '英雄第一视角', en: 'HERO POV' },
        engineerPovLabel: { zh: '工程第一视角', en: 'ENGINEER POV' },
        alt: { zh: '工程第一视角全程作为主画面；扶起前加入右上角英雄第一视角小窗，完整保留原画面及菜单，同步展示翻正和恢复行驶', en: 'Full-screen Engineer POV with a synchronized Hero POV inset in the upper-right corner before the lift, preserving the original frame and menu through righting and resumed driving' },
      },
    ],
  },
};


```

### 场景、交互与图注文案

```ts
export const sceneCopy = {
  armExchange: {
    play: { zh: '播放', en: 'Play' },
    pause: { zh: '暂停', en: 'Pause' },
    reset: { zh: '复位视角', en: 'Reset view' },
    loading: { zh: '正在加载机械臂', en: 'Loading the arm' },
    unavailable: { zh: '3D 暂不可用，显示 CAD 静态图', en: '3D unavailable; showing the CAD still' },
    illustration: { zh: '示意动画，非实测轨迹', en: 'Illustrative motion, not a recorded trajectory' },
    canvasAlt: { zh: '六轴机械臂兑矿示意动画，可拖动旋转与缩放', en: 'Interactive six-axis mineral exchange illustration; drag to orbit and zoom' },
    staticAlt: { zh: '工程机器人整车 CAD 静态图', en: 'Static CAD view of the Engineer robot' },
    staticNote: { zh: '静态 CAD 视图', en: 'Static CAD view' },
    timeline: { zh: '兑矿动画进度', en: 'Exchange animation timeline' },
    stages: { zh: '跳转到动作阶段', en: 'Jump to a motion stage' },
    joints: { zh: '相对 CAD 折叠姿态的关节角度', en: 'Joint angles relative to the folded CAD pose' },
    envelope: { zh: '设计包络示意', en: 'Illustrative design envelope' },
    mineral: { zh: '矿石', en: 'Mineral' },
    storage: { zh: '存矿位 · CAD 定位', en: 'Storage · CAD location' },
    station: { zh: '兑换站示意', en: 'Exchange bay schematic' },
    caption: { zh: '车尾存矿位按 CAD 吸盘定位；槽口朝侧面、略偏车尾。角度相对 CAD 折叠姿态；包络为设计示意；J1–J3 实机限位待确认。', en: 'Rear storage follows the CAD cup; the bay opens sideways and slightly rearward. Angles relative to CAD pose; envelope is illustrative; J1–J3 hardware limits unconfirmed.' },
    hint: { zh: '拖动旋转 · 滚轮 / 双指缩放', en: 'Drag to orbit · Scroll / pinch to zoom' },
    phases: [
      { zh: '折叠', en: 'Folded' },
      { zh: '展开', en: 'Unfold' },
      { zh: '抓矿', en: 'Pick up' },
      { zh: '翻腕对位', en: 'Reorient' },
      { zh: '推入', en: 'Insert' },
      { zh: '释放', en: 'Release' },
      { zh: '收回', en: 'Retract' },
    ],
  },
  pump: {
    badge: { zh: '摆动活塞 / 气流示意', en: 'WOBBLE PISTON / AIRFLOW' },
    play: { zh: '播放运动', en: 'Play motion' },
    pause: { zh: '暂停运动', en: 'Pause motion' },
    hint: { zh: '拖动旋转 · 方向键调整视角 · 空闲后续播', en: 'Drag to rotate · Arrow keys adjust the view · Resumes when idle' },
    note: { zh: '泵头与电机在实体和半透明之间循环渐变，展示完整外观与内部运动。曲柄提速后保持高速 2 秒再减速，进排气注释随提速淡出、高速时隐藏、减速时淡入。连杆与活塞保持一体，随曲柄往复并摆动；上管吸气、下管排气，以腔内容积变化切换。气流与阀门标记为示意，转速为演示速度。', en: 'The pump head and motor cycle between solid and translucent views to reveal the exterior and internal motion. The crank holds its faster speed for two seconds; inlet/outlet annotations fade out during acceleration, stay hidden at speed and fade back in during deceleration. The rod and piston move as one rigid body, reciprocating and rocking with the crank. Chamber-volume change switches the upper inlet and lower outlet. Airflow, valve markers and speed are illustrative.' },
    inletOpen: { zh: '进气 → 阀开', en: 'INLET → OPEN' },
    inletClosed: { zh: '进气 · 阀闭', en: 'INLET · CLOSED' },
    outletOpen: { zh: '排气 → 阀开', en: 'OUTLET → OPEN' },
    outletClosed: { zh: '排气 · 阀闭', en: 'OUTLET · CLOSED' },
    static: { zh: '静态设计视图', en: 'Static design view' },
  },
  swerve: {
    badge: { zh: '装配 / 爆炸视图', en: 'ASSEMBLY / EXPLODED VIEW' },
    assemble: { zh: '恢复装配', en: 'Assemble' },
    explode: { zh: '爆炸展开', en: 'Explode' },
    steeringStep: { zh: '① 转向传动', en: '1 · Steering' },
    driveStep: { zh: '② 轮驱传动', en: '2 · Wheel drive' },
    detail: { zh: '舵组齿轮特写', en: 'Steering-group gears detail' },
    sensorDetail: { zh: '滑环与光电检测', en: 'Slip ring & optical detection' },
    sensorNote: { zh: '中心滑环位于转向轴线上；光电门 PCB 与 CNC 铝合金识别件保留原装配位置，展示光电检测的配合关系。', en: 'The central slip ring sits on the steering axis. The optical-gate PCB and CNC aluminium target remain in their original positions to show their optical-detection relationship.' },
    amount: { zh: '拆解程度', en: 'Exploded view' },
    play: { zh: '播放循环', en: 'Play cycle' },
    pause: { zh: '暂停循环', en: 'Pause cycle' },
    hint: { zh: '拖动旋转 · 滚轮 / 双指缩放 · 悬停查看零件 · 方向键调整视角', en: 'Drag to orbit · Scroll / pinch to zoom · Hover to inspect · Arrow keys adjust the view' },
    note: { zh: '每轮 27 秒：从整车聚焦单轮，其余完全淡出；展开 6 秒、爆炸态 3 秒、还原 6 秒，再拉回整车，透明车体下展示 8 秒四轮同向转向与错峰压缩、回弹，最后恢复实体并连续循环。推近与拉远保持观察方向，转场暂缓自旋。转向电机随小齿轮沿转向轴上移，减速箱与车轮沿真实轮轴分层展开；轮驱电机保持整体并随下架移动。悬挂幅度为示意。电机侧齿轮复用 CAD 齿形，装配待确认。操作后空闲 5 秒平滑续播。', en: 'Each 27-second cycle starts with the whole vehicle, focuses on one module as everything else fades out, then opens for 6 seconds, holds for 3 and reassembles for 6. The view pulls back for 8 seconds of coordinated steering and staggered suspension responses beneath a transparent body, before restoring the solid vehicle and looping continuously. Camera direction is preserved during the approach and pullback, with orbiting eased to a stop. The steering motor lifts with its pinion; the gearbox and wheel separate along the actual wheel axis. The intact drive motor follows its mounting frame. Suspension travel is illustrative. The motor-side gear reuses a CAD profile; its assembly awaits confirmation. Playback resumes smoothly after 5 seconds idle.' },
    layers: { zh: '舵组齿轮、悬挂与减速箱分层标注', en: 'Layered annotations for steering-group gears, suspension and gearbox' },
    phases: {
      overview: { zh: '整车装配', en: 'WHOLE VEHICLE' },
      focus: { zh: '聚焦舵轮', en: 'FOCUS ON MODULE' },
      pullback: { zh: '回到整车', en: 'RETURN TO VEHICLE' },
      returning: { zh: '恢复整车', en: 'RESTORE VEHICLE' },
      assembled: { zh: '装配态', en: 'ASSEMBLED' },
      opening: { zh: '展开中', en: 'OPENING' },
      exploded: { zh: '爆炸态', en: 'EXPLODED' },
      closing: { zh: '合拢中', en: 'CLOSING' },
      articulation: { zh: '悬挂与转向联动示意', en: 'SUSPENSION & STEERING' },
    },
    stages: [
      { zh: '舵组齿轮 · 电机侧', en: 'Steering-group gears · Motor side' },
      { zh: '舵组齿轮 · 大齿轮', en: 'Steering-group gears · Large gear' },
      { zh: '悬挂 · 滑轨', en: 'SUSPENSION · RAIL' },
      { zh: '悬挂 · 气弹簧', en: 'SUSPENSION · GAS SPRING' },
      { zh: '减速箱 · 太阳轮', en: 'Gearbox · Sun gear' },
      { zh: '减速箱 · 行星轮', en: 'Gearbox · Planet gears' },
      { zh: '减速箱 · 内齿圈', en: 'Gearbox · Ring gear' },
      { zh: '中心滑环', en: 'Central slip ring' },
      { zh: '光电门 PCB', en: 'Optical-gate PCB' },
      { zh: 'CNC 铝合金识别件', en: 'CNC aluminium target' },
    ],
    static: { zh: '静态装配视图', en: 'Static assembly view' },
  },
  interaction: {
    reset: { zh: '复位视角', en: 'Reset view' },
  },
  homeDescription: {
    zh: '崔楮焓的 RoboMaster 机械作品集：工程全明星。',
    en: 'Chuhan Cui’s RoboMaster portfolio: Engineer All-Star.',
  },
  engineer: {
    relatedLinks: { zh: '相关链接', en: 'Links' },
    armFeature: {
      label: { zh: '官方纪录片', en: 'Official documentary' },
      credit: { zh: 'RoboMaster 机甲大师出品 · B 站原片', en: 'Produced by RoboMaster · Original video on Bilibili' },
      href: 'https://www.bilibili.com/video/BV1Y482zjERP/',
      file: 'official-film.mp4',
      poster: 'official-film.jpg',
      alt: { zh: 'RoboMaster 机甲大师工程机器人官方纪录片画面', en: 'Footage from RoboMaster’s official Engineer robot documentary' },
      soundOn: { zh: '开启声音', en: 'Turn sound on' },
      soundOff: { zh: '静音', en: 'Mute' },
      play: { zh: '播放纪录片', en: 'Play documentary' },
    },
  },
  armExplode: {
    caption: { zh: '', en: '' },
    overview: { zh: '整机装配', en: 'Complete assembly' },
    play: { zh: '继续演示', en: 'Continue' },
    pause: { zh: '暂停演示', en: 'Pause' },
    replay: { zh: '从头播放', en: 'Replay' },
    assemble: { zh: '恢复装配', en: 'Assemble' },
    reset: { zh: '复位视角', en: 'Reset view' },
    controls: { zh: '装配与传动讲解控制', en: 'Assembly and transmission presentation controls' },
    progress: { zh: '讲解进度', en: 'Presentation progress' },
    hint: { zh: '拖动旋转 · 滚轮 / 双指缩放 · 操作后空闲 5 秒继续 · 可点击下方章节跳转', en: 'Drag to orbit · Wheel / pinch to zoom · Resumes after 5 seconds idle · Select a chapter below to jump' },
    route: { zh: '动力路线与部件图例', en: 'Power path and part key' },
    fallback: { zh: '静态备用视图', en: 'Static fallback view' },
    selectGroup: { zh: '选择静态局部', en: 'Select a static detail' },
    alt: { zh: '云台与六轴机械臂装配及传动结构', en: 'Gimbal and six-axis arm assembly and transmission' },
    climbTitle: {zh:'整车协同 · 一级台阶',en:'Coordinated motion · one step'},
    climbDescription: {zh:'',en:''},
    climbFeatures:[{zh:'双齿条抬升',en:'Twin-rack lift'},{zh:'机械臂后部支撑',en:'Rear arm support'},{zh:'末端轮输出',en:'Wrist wheel drive'}],
    pathNames:[{zh:'J4 · 回转输出',en:'J4 · rotation output'},{zh:'J5 · 同步带',en:'J5 · timing belt'},{zh:'J6 · 分支输出',en:'J6 · branched drive'},{zh:'气路输入 · 走线示意',en:'Air inlet · routing schematic'}],
    workspaceBoundary:{zh:'末端约束边界切片',en:'End-point constraint slices'},
    limitBoundary:{zh:'',en:''},
    finaleTitle: { zh: '七轴联动', en: 'Seven-axis choreography' },
    finaleDescription: { zh: '', en: '' },
    phase: {
      extract:{zh:'总成分离示意',en:'Assembly separation study'},
      climb:{zh:'抬升 · 支撑 · 推进',en:'Lift · support · propel'},
      landed:{zh:'后主轮上阶 · 整车落稳',en:'Rear wheels clear · settle on platform'},
      descent:{zh:'整车停留',en:'Hold the vehicle'},
      assembled: { zh: '整机装配', en: 'Complete assembly' },
      approach: { zh: '镜头到位', en: 'Camera approach' },
      covers: { zh: '盖板与法兰展开', en: 'Covers and flanges open' },
      fasteners: { zh: '螺丝抽出后隐藏', en: 'Fasteners withdraw and fade' },
      level: { zh: '链传动保持水平基准', en: 'Chain-driven level reference' },
      contact: { zh: '真实限位板与滚轮接触', en: 'Actual plate and roller contact' },
      section: { zh: '相似连杆 · 三侧限位映射', en: 'Similar linkages · three-sided stop mapping' },
      mount: { zh: '观察安装关系', en: 'Inspect the mounting' },
      shafts: { zh: '轴系展开', en: 'Open shaft stacks' },
      inspect: { zh: '传动解析', en: 'Transmission study' },
      close: { zh: '当前组复原', en: 'Close current assembly' },
      return: { zh: '回到整机', en: 'Return to the assembly' },
      motion: { zh: '关节运动示意', en: 'Joint motion illustration' },
      finale: { zh: '七轴联动示意', en: 'Coordinated motion illustration' },
    },
    chapters: [
      { zh: 'J0 云台', en: 'J0 gimbal' }, { zh: 'J1 基座', en: 'J1 base' },
      { zh: 'J2 肩部', en: 'J2 shoulder' }, { zh: 'L2 骨架', en: 'L2 skeleton' }, { zh: 'J3 肘部', en: 'J3 elbow' },
      { zh: '联动限位', en: 'Linked stop' }, { zh: 'J4 万向轴', en: 'J4 shaft' },
      { zh: '腕部', en: 'Wrist' }, {zh:'整车协同',en:'Coordinated motion'},
    ],
    groupNames: [
      { zh: 'J0 · 链传动与双滑环', en: 'J0 · Chain and dual slip rings' },
      { zh: 'J1 · 基座转轴与链传动', en: 'J1 · Base yaw and chain drive' },
      { zh: 'J3 · 肘关节输出与支承', en: 'J3 · Elbow output and support' },
      { zh: 'J4 · 万向轴与过电过气', en: 'J4 · Universal shaft, power and air' },
      { zh: 'J5 / J6 · 腕部传动', en: 'J5 / J6 · Wrist transmission' },
      { zh: 'J6 / 轮组 · 共用驱动', en: 'J6 / wheels · Shared drive' },
      { zh: 'J2 / J3 · 联动限位与水平基准', en: 'J2 / J3 · Linked stop and level reference' },
      { zh: '腕部总成 · 双侧展开', en: 'Wrist assembly · Opposed opening' },
      { zh: 'J2 · 肩关节输出与支承', en: 'J2 · Shoulder output and support' },
      { zh: 'L2 · 内部碳板加强骨架', en: 'L2 · Internal carbon reinforcement' },
    ],
    descriptions: [
      { zh: 'MG8016 → 主动链轮 → 04C 链 → 从动链轮。两只滑环与轴承沿云台轴线分层，电机留在安装位置。', en: 'MG8016 → drive sprocket → 04C chain → driven sprocket. Both slip rings and the bearing separate along the gimbal axis; the motor stays mounted.' },
      { zh: '侧置 MG8016 经独立 04C 链驱动 J1 基座转轴。云台侧电机壳保持安装位置，输出侧带动整臂转动；J1 滑动碰撞块提供一圈机械限位。', en: 'The side-mounted MG8016 drives J1 through its own 04C chain. Its housing stays on the gimbal while the output rotates the arm; a sliding stop limits J1 to one turn.' },
      { zh: '从肘部输出轴正面观察 MG8010、输出连接件和支承。轴承与安装件沿横轴分层展开，复原后展示肘关节舒展与收回。', en: 'View the elbow MG8010, output couplings and supports from the output side. The shaft stack opens transversely, then closes before the elbow extends and returns.' },
      { zh: '电机 → 万向轴 → 等速齿轮对 → J4 输出。万向轴输入、输出不平行，整体不是等速传动。气管穿过中空电滑环，气路另经旋转接头。', en: 'Motor → universal shaft → 1:1 gear pair → J4 output. The nonparallel universal-shaft input and output do not form a constant-velocity transmission. An air tube passes through the hollow electrical slip ring, with a separate rotary air union.' },
      { zh: '腕部只展开一次：先看共面的 J5 同步带，再看 J6 输入轴分向两轮、左侧分支驱动 roll，最后看气路输入。左右轮之间不传递动力。', en: 'One wrist opening shows the coplanar J5 belt, the J6 input branching to both wheels with a left-side roll branch, and the air inlet. Neither wheel drives the other.' },
      { zh: '共用电机 → 三组齿轮 → 左右包胶轮 → 左轮锥齿轮 → J6 roll。轮子与 roll 共用驱动，不能分别独立控制；此处不将 CAD 的“差速器”名称解释为双输入差动。', en: 'Shared motor → three gear stages → rubber wheels → left-wheel bevel gears → J6 roll. The wheels and roll share a drive and are not independently controlled; the CAD carrier name does not establish a dual-input differential.' },
      { zh: '按开源报告图 19 描出大小连杆的近似相似关系。04C 链保持水平基准，拱门形碳板从上、前、后三侧限制滚轮轨迹，并映射到大臂末端范围。腕心与吸盘外伸分开表示；此处为设计机构示意。', en: 'Following figure 19 of the open-source report, trace the nearly similar large and small linkages. The 04C chain preserves a level reference; the carbon arch limits the roller from above, front and rear, mapping to the main arm reach. Wrist centre and cup extension are distinguished in this design illustration.' },
      { zh: 'J4 输出、J5 pitch 与 J6 roll 在同一总成中衔接。左右侧框与轮轴组件向各自外侧展开，三个完整电机保留原安装位置。', en: 'J4 output, J5 pitch and J6 roll connect within one assembly. The side frames and transverse shaft stacks open outwards on both sides; all three intact motors retain their mounting positions.' },
      { zh: '从输出轴正面观察 J2。完整 MG8010 电机、输出连接件与支承分层显示，复原后展示肩关节抬臂与回落。', en: 'View J2 from its output side. The intact MG8010, output couplings and supports open in layers; after closing, the shoulder lifts and returns.' },
      { zh: '外部铝通淡出，保留两块竖直碳板与六块交叉碳板，展示 L2 内部骨架及端部连接。随后恢复外壳，继续观察 J3。', en: 'The aluminium shell fades to reveal two vertical and six crosswise carbon plates and their end connections. The shell returns before the J3 study.' },
      { zh: '浅色路径表示气路走向：J4 气管经过中空电滑环；腕部通过旋转接头输入，沿侧孔回到臂内避开同步带。路径为布管示意，接头与结构采用实际模型。', en: 'The pale route shows air passing through the J4 hollow electrical slip ring, then entering the wrist through rotary fittings and returning through a side opening clear of the belt. Tube routing is schematic; fittings and structure use the actual model.' },
    ],
    enlarge: { zh: '查看大图', en: 'View full-size image' },
    routeSteps: [
      [{zh:'MG8016',en:'MG8016'},{zh:'主动链轮',en:'Drive sprocket'},{zh:'04C 链',en:'04C chain'},{zh:'从动链轮',en:'Driven sprocket'}],
      [{zh:'侧置 MG8016',en:'Side-mounted MG8016'},{zh:'主动链轮',en:'Drive sprocket'},{zh:'04C 链',en:'04C chain'},{zh:'J1 从动链轮',en:'J1 driven sprocket'}],
      [{zh:'肘部 MG8010',en:'Elbow MG8010'},{zh:'输出法兰',en:'Output flange'},{zh:'输出轴端',en:'Output shaft end'}],
      [{zh:'MG4010',en:'MG4010'},{zh:'输入万向节',en:'Input universal joint'},{zh:'倾斜传动轴',en:'Angled shaft'},{zh:'输出万向节',en:'Output universal joint'},{zh:'齿轮输入轴',en:'Gear input shaft'},{zh:'主动齿轮',en:'Driving gear'},{zh:'从动齿轮',en:'Driven gear'},{zh:'J4 输出连接',en:'J4 output coupling'}],
      [{zh:'J5 电机',en:'J5 motor'},{zh:'主动带轮',en:'Driving pulley'},{zh:'同步带',en:'Timing belt'},{zh:'从动带轮',en:'Driven pulley'},{zh:'Pitch 载体',en:'Pitch carrier'}],
      [{zh:'共用电机',en:'Shared motor'},{zh:'一级主动齿轮',en:'First driving gear'},{zh:'一级从动齿轮',en:'First driven gear'},{zh:'横向传动轴',en:'Transverse shaft'},{zh:'左侧主动齿轮',en:'Left driving gear'},{zh:'左轮从动齿轮',en:'Left wheel gear'},{zh:'左包胶轮',en:'Left rubber wheel'},{zh:'主动锥齿轮',en:'Driving bevel gear'},{zh:'从动锥齿轮',en:'Driven bevel gear'},{zh:'末端输出轴',en:'End output shaft'},{zh:'吸盘',en:'Suction cup'},{zh:'右侧主动齿轮',en:'Right driving gear'},{zh:'右轮从动齿轮',en:'Right wheel gear'},{zh:'右包胶轮',en:'Right rubber wheel'}],
      [{zh:'22T 主动链轮',en:'22T drive sprocket'},{zh:'04C 链',en:'04C chain'},{zh:'22T 从动链轮',en:'22T driven sprocket'},{zh:'UWB 安装板',en:'UWB mounting plate'}],
      [],
      [{zh:'肩电机 MG8010',en:'Shoulder MG8010'},{zh:'输出连接件',en:'Output coupling'},{zh:'输出轴端',en:'Output shaft end'},{zh:'上臂连接',en:'Upper-arm attachment'}],
      [],
      [{zh:'气路输入',en:'Air inlet'},{zh:'旋转接头',en:'Rotary fitting'},{zh:'避开同步带走线',en:'Route clear of timing belt'}],
    ],
    features: [
      [{ zh: '内滑环 MMC182', en: 'Inner slip ring MMC182' }, { zh: '外滑环 MT1256', en: 'Outer slip ring MT1256' }, { zh: '同轴支承轴承', en: 'Coaxial support bearing' }],
      [{ zh: 'J1 驱动电机', en: 'J1 drive motor' }, { zh: 'J1 输出链轮', en: 'J1 output sprocket' }],
      [{ zh: 'J3 肘电机', en: 'J3 elbow motor' }, { zh: '输出轴正面', en: 'Output-side face' }],
      [{ zh: '非等速万向轴', en: 'Non-CV universal shaft' }, { zh: '中空电滑环', en: 'Hollow electrical slip ring' }, { zh: 'J4 输出', en: 'J4 output' }],
      [{ zh: 'J5 独立电机', en: 'Dedicated J5 motor' }, { zh: '等速同步带', en: '1:1 timing belt' }, { zh: 'J5 从动带轮', en: 'J5 driven pulley' }],
      [{ zh: '共用驱动电机', en: 'Shared drive motor' }, { zh: '输入轴左右分支', en: 'Input shaft branches' }, { zh: '左侧 roll 锥齿轮', en: 'Left-side roll bevel gears' }],
      [{ zh: 'J2 水平基准', en: 'J2 level reference' }, { zh: '真实 J2 联动限位板', en: 'Actual J2 linked-stop plate' }, { zh: '联动限位滚轮', en: 'Linked stop roller' }],
      [{ zh: 'J4 输出', en: 'J4 output' }, { zh: 'J5 pitch', en: 'J5 pitch' }, { zh: 'J6 roll', en: 'J6 roll' }],
      [{zh:'J2 肩电机',en:'J2 shoulder motor'},{zh:'输出轴正面',en:'Output-side face'}],
      [{zh:'竖直加强碳板 × 2',en:'Vertical carbon plates × 2'},{zh:'交叉加强碳板 × 6',en:'Cross carbon plates × 6'},{zh:'铝通外壳',en:'Aluminium shell'}],
      [{zh:'气路输入接头',en:'Air inlet fitting'},{zh:'旋转接头通道',en:'Rotary air passage'},{zh:'臂内回管',en:'Internal return tube'}],
    ],
    designNote: { zh: '', en: '' },
    guideNote: { zh: '', en: '' },
    staticNote: { zh: '静态装配解析：总览与关键局部使用同一 CAD 模型', en: 'Static assembly study: overview and details use the same CAD model' },
  },
  module: {
    photo: { zh: '设计视图', en: 'Design view' },
    rotate: { zh: '播放演示', en: 'Play presentation' },
    pause: { zh: '暂停演示', en: 'Pause presentation' },
    loading: { zh: '正在加载模型…', en: 'Loading model…' },
    failed: { zh: '模型暂时无法加载，已显示设计视图。', en: 'The model could not load. Showing the design view.' },
    hint: { zh: '拖动旋转 · 方向键调整视角', en: 'Drag to rotate · Arrow keys adjust the view' },
  },
};

/* ------------------------------------------------------------------ person */

export const person = {
  nameZh: '崔楮焓',
  nameEn: 'Chuhan Cui',
  role: 'MECHANICAL LEAD // HKUST ENTERPRIZE',
  badge: 'RM2025 ENGINEER ALL-STAR',
  tagline: { zh: '我设计上赛场的机器人。', en: 'I design robots built for the arena.' },
  edu: {
    zh: '香港科技大学 CPEG 本科，AI / Robotics 辅修，2023–2027',
    en: 'BEng Computer Engineering (CPEG), HKUST, minor in AI / Robotics, 2023–2027',
  },
  team: {
    zh: 'HKUST ENTERPRIZE 战队，3 年 RoboMaster 参赛经历，2025 赛季机械组组长',
    en: 'Three years competing in RoboMaster with HKUST ENTERPRIZE, mechanical lead in 2025',
  },
  github: 'https://github.com/ccuiab',
  email: 'ccuiab@connect.ust.hk',
  heroPic: { src: engReach, alt: { zh: '2 号工程机器人，机械臂完全伸出', en: 'Engineer robot No. 2 with its arm fully extended' } } as Pic,
};


```

### 任务影片文案

```ts
export const missionFilm = {
  title: { zh: '一趟行动，整车协同。', en: 'One mission. One coordinated machine.' },
  alt: { zh: '蓝方工程机器人取银矿、储矿、越阶、小陀螺取金矿并完成四级兑换的静音三维示意短片', en: 'Silent 3D illustration of the blue Engineer collecting and storing silver ores, climbing steps, retrieving gold while spinning, and completing a level-4 exchange' },
  illustration: { zh: '功能情境示意', en: 'Illustrated mission' },
  caption: { zh: '取矿、储矿、越阶、旋转作业与不同位姿的兑换，共同决定整车布局与机械臂工作空间。场地以轮廓示意，动作与等待经过编排。', en: 'Retrieval, storage, step climbing, spinning operation and exchange at different poses shape the vehicle layout and arm workspace. Field props are schematic; actions and waiting are staged.' },
  phases: [
    { zh: '从蓝方基地出发', en: 'Leave the blue base' },
    { zh: '取银矿，转存车后', en: 'Collect silver. Store it behind.' },
    { zh: '带矿越过两级台阶', en: 'Climb both steps with the ores' },
    { zh: '从侧洞取出金矿', en: 'Retrieve gold through the side opening' },
    { zh: '底盘旋转，末端稳定取矿', en: 'Spinning chassis. Steady retrieval.' },
    { zh: '持矿收臂，绕坡返程', en: 'Retract with the ore. Return via the ramp.' },
    { zh: '四级兑换：换姿对准，连续入槽', en: 'Level 4: align to two poses and insert' },
    { zh: '完成兑换，保留一颗银矿', en: 'Exchange complete. One silver ore remains.' },
  ],
  notes: [
    { zh: '前方取矿 → 后置双吸盘储矿', en: 'Front retrieval → two rear storage cups' },
    { zh: '前抬升与后臂协同，两次水平抬升', en: 'Front lifts and rear arm coordinate two level lifts.' },
    { zh: '云台反向补偿，保持末端朝向', en: 'Counter-rotation keeps the end effector steady' },
    { zh: '先金矿，再银矿；每次入槽后翻转回收', en: 'Gold, then silver; the station tips each ore into its collector' },
  ],
  cargo: { zh: '后置储矿 / 手持', en: 'Stored / carried' },
  map: { zh: '行动路径', en: 'Mission route' },
  mapActions: [
    {zh:'前往银矿岛',en:'To silver island'},
    {zh:'双矿转存',en:'Silver transfer'},
    {zh:'两级越阶',en:'Step crossing'},
    {zh:'中央取矿',en:'Gold retrieval'},
    {zh:'旋转撤离',en:'Spinning retreat'},
    {zh:'绕坡返航',en:'Return via ramps'},
    {zh:'蓝方兑换',en:'Blue exchange'},
    {zh:'行动完成',en:'Mission complete'},
  ],
  play: { zh: '播放短片', en: 'Play film' },
  replay: { zh: '重新播放', en: 'Replay' },
};

export const rm2025Field = {
  title: { zh: 'RM2025 场地资产', en: 'RM2025 field assets' },
  subtitle: { zh: '官方场地图纸与比赛手册', en: 'Official field CAD and competition manual' },
  overview: { zh: '资产总览', en: 'Asset overview' },
  drag: { zh: '拖动旋转 · 滚轮缩放 · 右键平移', en: 'Drag to orbit · Scroll to zoom · Right-drag to pan' },
  home: { zh: '适合画面', en: 'Fit view' },
  rotate: { zh: '自动旋转', en: 'Auto-rotate' },
  dimensions: { zh: '外包络 / mm', en: 'Envelope / mm' },
  source: { zh: '官方来源', en: 'Official sources' },
  reference: { zh: '查看尺寸参考图', en: 'View the dimension reference' },
  manual: { zh: '比赛规则 V2.1.0', en: 'Competition rules V2.1.0' },
  cad: { zh: '官方全国赛场地图纸', en: 'Official national-finals field CAD' },
  download: { zh: '下载此模型', en: 'Download model' },
  allFiles: { zh: '资产清单', en: 'Asset manifest' },
  loading: { zh: '正在加载模型…', en: 'Loading models…' },
  failure: { zh: '模型未能加载，请通过本地预览服务打开本页并查看控制台。', en: 'Models could not load. Open this page through the local preview server and inspect the console.' },
  ready: { zh: '模型已加载', en: 'Models loaded' },
  pose: { zh: '兑换槽位姿', en: 'Exchange-slot pose' },
  poseHint: { zh: '以手册兑换站坐标系调整独立槽体。', en: 'Adjust the standalone slot in the manual’s station coordinates.' },
  difficulty: { zh: '示例位姿', en: 'Example poses' },
  levels: [
    { zh: '一级示例', en: 'Level 1 example' },
    { zh: '二级示例', en: 'Level 2 example' },
    { zh: '三级示例', en: 'Level 3 example' },
    { zh: '四级示例', en: 'Level 4 example' },
  ],
  samplesHint: { zh: '示例用于检查姿态，不代表比赛实际随机序列。', en: 'Examples illustrate pose checks, not actual competition sequences.' },
  inserted: { zh: '矿石放入进度', en: 'Ore insertion' },
  insert: { zh: '放入 / 取出', en: 'Insert / withdraw' },
  valid: { zh: '位姿满足手册范围检查', en: 'Pose passes the manual-range checks' },
  invalid: { zh: '当前位姿超出手册范围，请调整参数', en: 'Pose is outside the manual limits; adjust the parameters' },
  clearance: { zh: '对齐后每侧名义间隙 20 mm', en: 'Nominal aligned clearance: 20 mm per side' },
  language: { zh: 'English', en: '中文' },
  names: {
    'gold-island': { zh: '大资源岛', en: 'Gold resource island' },
    'silver-island': { zh: '小资源岛', en: 'Silver resource island' },
    'ore-gold': { zh: '金矿石', en: 'Gold ore' },
    'ore-silver': { zh: '银矿石', en: 'Silver ore' },
    'exchange-station': { zh: '兑换站', en: 'Exchange station' },
    'exchange-slot': { zh: '兑换槽', en: 'Exchange slot' },
    'highland-crossing': { zh: '中央高地翻越结构', en: 'Central-highland crossing' },
  },
} as const;

```
