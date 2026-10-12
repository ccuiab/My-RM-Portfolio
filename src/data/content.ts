import type { ImageMetadata } from 'astro';
import type { T } from './i18n';

import engReach from '../../materials/images/source/historical/eng-reach.webp';
import engineerFront from '../../materials/images/derived/site/cad-cutouts/engineer-front.png';
import engStats from '../../materials/images/source/historical/eng-mvp.webp';
import engAllstar from '../../materials/images/source/historical/eng-allstar.webp';
import pump from '../../materials/images/derived/site/cad-cutouts/air-pump.png';
import engWheel from '../../materials/images/derived/site/cad-cutouts/eng-wheel.png';
import controller from '../../materials/images/derived/site/cad-cutouts/controller.png';
import heroBot from '../../materials/images/derived/site/cad-cutouts/hero-bot.png';
import heroChassis from '../../materials/images/derived/site/cad-cutouts/hero-chassis-adaptive.png';
import heroLauncher from '../../materials/images/derived/site/cad-cutouts/hero-launcher-2024.png';
import heroLauncherCore from '../../materials/images/derived/site/research-cutouts/hero-launcher-core.png';
import launcher4 from '../../materials/images/derived/site/research-cutouts/launcher-dual-4.png';
import launcher6 from '../../materials/images/derived/site/research-cutouts/launcher-dual-6.png';
import feederLarge from '../../materials/images/derived/site/cad-cutouts/feeder-large.png';
import feederSmall from '../../materials/images/derived/site/research-cutouts/feeder-small.png';
import heroWheel from '../../materials/images/derived/site/research-cutouts/hero-wheel.png';
import exoPic from '../../materials/images/source/historical/exo-suit.webp';

export type Pic = { src: ImageMetadata; alt: T; /** CAD render on white: show on a light plate */ light?: boolean; cutout?: boolean; model?: string; modelNote?: T };
export type Spec = { label: T; value: string; unit?: string; note?: T };
export type Stat = Spec & { rank?: string };
export type Chapter = {
  id: string;
  /** detail-view letter, as on a drawing sheet */
  mark: string;
  title: T;
  lede?: T;
  bullets?: T[];
  specs?: Spec[];
  pics?: Pic[];
  /** special interactive block rendered inside the chapter */
  scene?: 'arm-unfold';
};
export type TitleRow = { label: T; value: T };

export const ui = {
  siteTitle: { zh: '崔楮焓 · 机械作品集', en: 'Chuhan Cui · Mechanical Portfolio' },
  skip: { zh: '跳到正文', en: 'Skip to content' },
  switchLang: { zh: 'EN', en: '中文' },
  switchLangLabel: { zh: 'Switch to English', en: '切换到中文' },
  nav: {
    home: { zh: '首页', en: 'Home' },
    engineer: { zh: '工程 2025', en: 'Engineer 2025' },
    hero: { zh: '英雄 2024', en: 'Hero 2024' },
    research: { zh: '预研', en: 'R&D' },
  },
  backHome: { zh: '回到首页', en: 'Back to home' },
  openProject: { zh: '看完整项目', en: 'Read the full project' },
  watchSource: { zh: '看原视频', en: 'Watch the source video' },
  enlarge: { zh: '放大查看', en: 'View larger' },
  close: { zh: '关闭', en: 'Close' },
  footerNote: {
    zh: '比赛影像来源见各视频标注。网站代码与机械设计归作者所有。',
    en: 'Match footage sources are credited with each video. Site code and mechanical design by the author.',
  },
  classic: { zh: '经典版 / Classic', en: '经典版 / Classic' },
} satisfies Record<string, T | Record<string, T>>;

/* ---------------------------------------------------------- page and scene copy */

export const pageCopy = {
  homeProjects: { zh: '浏览项目', en: 'Explore projects' },
  homeEngineer: { zh: '查看工程机器人', en: 'View the Engineer' },
  honoursTitle: { zh: '荣誉', en: 'Honours' },
  aboutTitle: { zh: '关于我', en: 'About' },
  nextSheet: { zh: '下一张图纸', en: 'Next sheet' },
  projectTitle: { zh: '项目图纸', en: 'Project sheets' },
  projectFigures: [
    { value: '1400 mm', label: { zh: '整车最大展开', en: 'Maximum robot envelope' } },
    { value: '42 mm', label: { zh: '大弹丸口径', en: 'Large projectile size' } },
    { value: '3', label: { zh: '采用中心供弹的机器人类型', en: 'Robot classes using the centre feed' } },
  ],
  mainNav: { zh: '主导航', en: 'Main' },
  githubLabel: { zh: 'github.com/ccuiab', en: 'github.com/ccuiab' },
  notFoundTitle: { zh: '图纸未找到', en: 'Sheet not found' },
  notFoundBody: { zh: '这个页面不存在，返回首页继续浏览项目图纸。', en: 'This page does not exist. Return home to browse the project sheets.' },
};

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
    note: { zh: '连杆与活塞保持一体，随曲柄往复并摆动；上管吸气、下管排气，以腔内容积变化切换。气流与阀门标记为示意，转速为演示速度。', en: 'The rod and piston move as one rigid body, reciprocating and rocking with the crank. Chamber-volume change switches the upper inlet and lower outlet. Airflow, valve markers and speed are illustrative.' },
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
    detail: { zh: '转向特写', en: 'Steering detail' },
    amount: { zh: '拆解程度', en: 'Exploded view' },
    play: { zh: '播放循环', en: 'Play cycle' },
    pause: { zh: '暂停循环', en: 'Pause cycle' },
    hint: { zh: '拖动旋转 · 滚轮 / 双指缩放 · 悬停查看零件 · 方向键调整视角', en: 'Drag to orbit · Scroll / pinch to zoom · Hover to inspect · Arrow keys adjust the view' },
    note: { zh: '轮侧展开驱动级，上方分开转向电机小齿轮与大齿轮，电机保持整体。小齿轮复用已有 CAD 齿形，转向装配待确认；转向与滚动为示意。操作后空闲 5 秒续播。', en: 'The wheel-side drive separates below the steering pinion and large gear. Motors stay intact. The pinion reuses an existing CAD profile; its steering placement awaits confirmation. Steering and rolling are illustrative. Playback resumes after 5 seconds idle.' },
    phases: {
      assembled: { zh: '装配态', en: 'ASSEMBLED' },
      opening: { zh: '展开中', en: 'OPENING' },
      exploded: { zh: '爆炸态', en: 'EXPLODED' },
      closing: { zh: '合拢中', en: 'CLOSING' },
    },
    stages: [
      { zh: '驱动 · 输入', en: 'DRIVE · INPUT' },
      { zh: '驱动 · 复合齿轮', en: 'DRIVE · COMPOUND' },
      { zh: '驱动 · 内齿圈', en: 'DRIVE · RING' },
      { zh: '转向 · 电机小齿轮', en: 'STEERING · PINION' },
      { zh: '转向 · 大齿轮', en: 'STEERING · LARGE GEAR' },
      { zh: '悬挂 · 滑轨', en: 'SUSPENSION · RAIL' },
      { zh: '悬挂 · 气弹簧', en: 'SUSPENSION · GAS SPRING' },
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
    caption: { zh: '各组紧凑分离，再展开安装构件。点击一组查看细节；电机保持整体，合拢按相反顺序进行。', en: 'Groups separate compactly before their mounting bodies open. Select a group for detail; motors stay intact and closing reverses the stages.' },
    hint: { zh: '画布内滚轮缩放 · 拖动旋转 · 点击或 Tab 选择组 · Esc 返回 · 空闲 5 秒继续', en: 'Wheel over canvas to zoom · Drag to orbit · Click or Tab to select a group · Esc returns · Resumes after 5 seconds' },
    assemble: { zh: '恢复装配', en: 'Assemble' },
    groups: { zh: '组级展开', en: 'Separate groups' },
    explode: { zh: '爆炸展开', en: 'Explode' },
    rotate: { zh: '播放演示', en: 'Play presentation' },
    pause: { zh: '暂停演示', en: 'Pause presentation' },
    controls: { zh: '全臂爆炸视图操作', en: 'Arm exploded view controls' },
    progress: { zh: '爆炸程度', en: 'Separation' },
    hover: { zh: '悬停高亮 · 点击一组查看细节爆炸', en: 'Hover to highlight · Select a group to inspect its exploded detail' },
    back: { zh: '← 返回整臂', en: '← Back to full arm' },
    detail: { zh: '细节爆炸', en: 'Exploded detail' },
    selectGroup: { zh: '选择部件组查看细节', en: 'Select a component group for detail' },
    groupNames: [
      { zh: 'J0 底座', en: 'J0 base' },
      { zh: 'L1 / J1', en: 'L1 / J1' },
      { zh: 'L2', en: 'L2' },
      { zh: 'L3 / J3', en: 'L3 / J3' },
      { zh: 'L4', en: 'L4' },
      { zh: '腕部', en: 'Wrist' },
      { zh: '末端', en: 'End effector' },
      { zh: 'L1 侧部机构', en: 'L1 side mechanism' },
    ],
    mount: { zh: '固定底座 · link_base', en: 'Fixed mount · link_base' },
    staticNote: { zh: '全臂静态爆炸视图', en: 'Static exploded view of the arm' },
    alt: { zh: '机械臂从底座到末端的零件级爆炸视图', en: 'Part-level exploded view of the arm, from base to end effector' },
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

/* ------------------------------------------------------------- the record */

export const record = {
  value: '5.8',
  title: { zh: '两颗矿石，完成兑换。', en: 'Two ores, one exchange.' },
  resultLabel: { zh: '四级兑换 · 官方成绩', en: 'Level 4 · Official result' },
  timerLabel: { zh: '兑换计时', en: 'Exchange time' },
  matchLabel: { zh: '场次', en: 'Match' },
  povLabel: { zh: '操作手视角 · 原速', en: 'Operator view · Real time' },
  broadcastLabel: { zh: '官方转播 · WR NEW', en: 'Official broadcast · WR NEW' },
  playLabel: { zh: '播放', en: 'Play' },
  pauseLabel: { zh: '暂停', en: 'Pause' },
  replayLabel: { zh: '重播', en: 'Replay' },
  replayTimeLabel: { zh: '回放时间', en: 'Replay time' },
  povSourceLabel: { zh: '操作手视角来源', en: 'Operator-view source' },
  povSource: 'https://www.bilibili.com/video/BV1yk8gz8Eu2/?p=3&t=1975',
  lede: {
    zh: '这是 RMUC 2025 全场四级矿石的最短兑换时长。机械臂、腕部、底盘和控制器共同完成这次兑换。',
    en: 'The fastest level-4 ore exchange of RMUC 2025. The arm, wrist, chassis and controller all contribute to this exchange.',
  },
  match: {
    zh: 'RMUC 2025 复活赛第 30 场 · 第三局，对阵南昌大学 Passion',
    en: 'RMUC 2025 repechage, match 30 · Round 3, against Nanchang University Passion',
  },
  crew: [
    { label: { zh: '操作手', en: 'Operator' }, value: { zh: '黄樂軒', en: '黄樂軒' } },
    { label: { zh: '机械设计', en: 'Mechanical design' }, value: { zh: '崔楮焓', en: 'Chuhan Cui' } },
  ] as TitleRow[],
  source: 'https://www.bilibili.com/video/BV1Py8vzNE74/?t=1918',
  broadcast: { src: engStats, alt: { zh: '官方转播数据卡', en: 'Official broadcast stats card' } } as Pic,
  allstar: { src: engAllstar, alt: { zh: 'RoboMaster 2025 全明星海报：香港科技大学 ENTERPRIZE 工程机器人', en: 'RoboMaster 2025 All-Star poster: HKUST ENTERPRIZE Engineer robot' } } as Pic,
};

/* ---------------------------------------------------------------- projects */

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
        zh: '取矿、兑矿、上台阶、偷取对方矿石、救援，五类任务一起决定了 PUMA 构型、连杆长度和整车布局。',
        en: 'Ore retrieval, exchange, step climbing, stealing the opponent’s ore and rescue together set the PUMA configuration, the link lengths and the vehicle layout.',
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
      title: { zh: '六轴机械臂与腕部', en: 'Six-axis arm and wrist' },
      lede: {
        zh: '在臂展、兑矿灵活性与末端刚度之间取平衡，把传动与气路集成在有限的腕部空间里。',
        en: 'Balance reach and exchange dexterity against stiffness, integrating the drivetrain and air path into the limited wrist space.',
      },
      specs: [
        { label: { zh: 'L2 上臂', en: 'L2 upper arm' }, value: '380', unit: 'mm' },
        { label: { zh: 'L3+L4 前臂', en: 'L3+L4 forearm' }, value: '420', unit: 'mm' },
      ],
      bullets: [
        { zh: 'J4 将电滑环嵌入中空旋转气动接头，连续旋转时维持供电与气路。', en: 'At J4, an electrical slip ring nests inside a hollow rotary air union to carry power and air through continuous rotation.' },
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
          zh: '驱动电机经输入直齿轮、复合齿轮与内齿圈带动车轮，把减速机构收进轮侧；舵下悬挂由滑轨导向、气弹簧提供支撑。',
          en: 'The drive motor powers the wheel through an input spur gear, compound gears and an internal ring, packaging reduction beside the wheel. Rails guide the under-module suspension, with gas-spring support.',
        },
        {
          zh: '转向电机经小齿轮啮合舵组大直齿轮，驱动舵组整体回转；驱动与转向分别布置，便于独立控制。',
          en: 'The steering motor drives a pinion meshing with the large spur gear to turn the complete inner module. Separate drive and steering paths allow independent control.',
        },
      ],
      pics: [{ src: engWheel, model: 'engineer-swerve.glb', cutout: true, alt: { zh: '工程舵轮模组', en: 'Engineer swerve module' } }],
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
        href: 'https://www.bilibili.com/video/BV1Aw8gzoEZd?p=3&t=1089',
        heroHref: 'https://www.bilibili.com/video/BV1Aw8gzoEZd?p=2&t=1085.4',
        file: 'egg-right-hero.mp4',
        poster: 'egg-right-hero.jpg',
        layout: 'landscape',
        alt: { zh: '工程主画面与同步英雄画中画展示扶正过程；菜单打开时，英雄视角保留未遮挡的车体和地面', en: 'Engineer main view and synchronized Hero inset show the righting process; while the menu is open, the Hero inset shows the unobstructed chassis and ground' },
      },
    ],
  },
};

export const hero = {
  slug: 'hero',
  drawing: 'HERO-24',
  robotNo: '1',
  title: { zh: 'RoboMaster 2024 英雄机器人', en: 'RoboMaster 2024 Hero Robot' },
  short: { zh: '英雄机器人 2024', en: 'Hero 2024' },
  shortTag: { zh: '摩擦轮发射与自适应底盘', en: 'Launcher/chassis' },
  lede: {
    zh: '我独立负责整车机械设计，覆盖云台、发射、大弹丸侧供弹和自适应悬挂，补上了队里英雄机器人这一块能力。',
    en: 'I was the sole mechanical designer for the whole robot, covering the gimbal, launcher, large-projectile side feed and adaptive suspension, and filled the gap the team had in its Hero lineup.',
  },
  cover: { src: heroBot, model: 'hero.glb', cutout: true, alt: { zh: 'RM2024 英雄机器人整车', en: 'RM2024 Hero robot' } } as Pic,
  titleBlock: [
    { label: { zh: '赛季', en: 'Season' }, value: { zh: 'RoboMaster 2024', en: 'RoboMaster 2024' } },
    { label: { zh: '职责', en: 'Role' }, value: { zh: '整车机械设计', en: 'Sole mechanical designer' } },
    { label: { zh: '范围', en: 'Scope' }, value: { zh: '云台、发射、供弹、底盘', en: 'Gimbal, launcher, feed, chassis' } },
  ] as TitleRow[],
  stats: [
    { label: { zh: '10 m 散布', en: 'Dispersion at 10 m' }, value: '<25×25', unit: 'cm' },
    { label: { zh: '初速波动', en: 'Muzzle velocity spread' }, value: '±0.1', unit: 'm/s' },
    { label: { zh: '稳定供弹', en: 'Steady feed rate' }, value: '2', unit: 'Hz' },
    { label: { zh: '垂直跌落测试', en: 'Vertical drop test' }, value: '30', unit: 'cm' },
  ] as Stat[],
  chapters: [
    {
      id: 'launcher',
      mark: 'A',
      title: { zh: '双端支撑摩擦轮发射系统', en: 'Double-supported friction-wheel launcher' },
      lede: {
        zh: '弹道与俯仰角建模为发射方案提供依据。',
        en: 'Ballistic and pitch-angle modelling informed the launcher design.',
      },
      bullets: [
        {
          zh: '针对摩擦轮振动、掉速和弹丸未共速，采用对轴支撑、双端轴承与预加速轮组稳定发射结构。',
          en: 'The launcher uses shaft supports, bearings at both ends and a pre-acceleration wheel pair to address wheel vibration, speed droop and projectile/wheel speed mismatch.',
        },
      ],
      pics: [
        { src: heroLauncher, model: 'hero-launcher.glb', modelNote: { zh: '2024-09 总装中的发射模块，图片与交互模型取自同一 CAD 装配。', en: 'Launcher from the September 2024 assembly; image and interactive model share the same CAD source.' }, cutout: true, alt: { zh: 'RM2024 英雄发射机构', en: 'RM2024 Hero launcher' } },
      ],
    },
    {
      id: 'feed',
      mark: 'B',
      title: { zh: '大弹丸侧供弹', en: 'Large-projectile side feed' },
      lede: {
        zh: '面向类高尔夫球的大弹丸连续供弹，在队内已有的侧供弹方案上优化，优先提高可靠性、降低卡滞风险。',
        en: 'Built to feed golf-ball-sized projectiles continuously, it refines the team’s existing side-feed design with a focus on reliability and jam prevention.',
      },
      bullets: [
        {
          zh: '针对弹丸尺寸公差优化防卡滞结构，保持供弹顺畅。',
          en: 'Anti-jam geometry tuned around projectile size tolerance keeps the feed running smoothly.',
        },
      ],
      pics: [{ src: feederLarge, model: 'hero-side-feed.glb', modelNote: { zh: '独立侧供弹总成：弹仓、拨弹机构与驱动。', en: 'Standalone side-feed assembly: hopper, feeding mechanism and drive.' }, cutout: true, alt: { zh: '大弹丸侧供弹', en: 'Large-projectile side feed' } }],
    },
    {
      id: 'chassis',
      mark: 'C',
      title: { zh: '自适应悬挂底盘', en: 'Adaptive suspension chassis' },
      lede: {
        zh: '四轮联动悬挂，让麦克纳姆轮在起伏路面上的接地压力更均衡。',
        en: 'Four-wheel linked suspension evens out Mecanum wheel contact pressure over uneven ground.',
      },
      bullets: [
        {
          zh: '较大轮距加预紧压簧，抑制发射后坐力带来的整车晃动。',
          en: 'A wide track and preloaded compression springs reduce chassis shake from recoil.',
        },
        {
          zh: '实测通过飞坡、正向与侧向下台阶，以及垂直跌落测试。',
          en: 'Tested through ramp jumps, forward and lateral step descents, and a vertical drop.',
        },
      ],
      pics: [{ src: heroChassis, model: 'hero-adaptive-chassis.glb', modelNote: { zh: '裸车架、四轮与联动悬挂，对照图中的底盘结构。', en: 'Bare frame, four wheels and linked suspension, matching the pictured chassis structure.' }, cutout: true, alt: { zh: '自适应悬挂底盘', en: 'Adaptive suspension chassis' } }],
    },
  ] as Chapter[],
};

export type Stage = { title: T; body: T; pic: Omit<Pic, 'model' | 'modelNote'> };

export const research = {
  slug: 'research',
  drawing: 'RND-2425',
  title: { zh: '2024–2025 技术预研', en: '2024–2025 R&D' },
  short: { zh: '技术预研', en: 'R&D' },
  shortTag: { zh: '发射、供弹与舵轮预研', en: 'Module R&D' },
  cover: { src: launcher6, cutout: true, alt: { zh: '双级六摩擦轮', en: 'Dual-stage six-friction-wheel launcher' } } as Pic,
  launcher: {
    title: { zh: '发射机构：从单级到双级六摩擦轮', en: 'Launcher: from single stage to dual-stage six friction wheels' },
    stages: [
      {
        title: { zh: 'RM2024 英雄单级发射', en: 'RM2024 Hero, single stage' },
        body: { zh: '对轴摩擦轮加预加速小轮，是后面所有多级方案的起点。', en: 'Two double-supported friction wheels plus a small pre-acceleration wheel: the starting point for every multi-stage design that followed.' },
        pic: { src: heroLauncherCore, cutout: true, alt: { zh: 'RM2024 英雄单级发射', en: 'RM2024 Hero single-stage launcher' } },
      },
      {
        title: { zh: '双级四摩擦轮', en: 'Dual-stage four-friction-wheel launcher' },
        body: { zh: '样机暴露左右散布较大的问题。中间试过三摩擦轮，初射角稳定了，弹速一致性不够。', en: 'The prototype showed wide left-right dispersion. An intermediate three-wheel design stabilised the launch angle but did not keep muzzle velocity consistent.' },
        pic: { src: launcher4, cutout: true, alt: { zh: '双级四摩擦轮', en: 'Dual-stage four-friction-wheel launcher' } },
      },
      {
        title: { zh: '双级六摩擦轮', en: 'Dual-stage six-friction-wheel launcher' },
        body: { zh: '目标是兼顾弹速一致性和散布控制。', en: 'The design targets consistent muzzle velocity and controlled dispersion.' },
        pic: { src: launcher6, cutout: true, alt: { zh: '双级六摩擦轮', en: 'Dual-stage six-friction-wheel launcher' } },
      },
    ] as Stage[],
  },
  feeder: {
    title: { zh: '供弹：小弹丸中心供弹与大弹丸侧供弹', en: 'Feeding: 17 mm centre feed and large-projectile side feed' },
    stages: [
      {
        title: { zh: '结构预研与迭代上车', en: 'From feed development to robots' },
        body: { zh: '多层预制、整流罩与防剪切优先，迭代后用于多类队内机器人；供弹频率 >25 Hz。', en: 'Multi-layer staging, a fairing and shear protection guide the design. The iterated version feeds multiple robot classes at over 25 Hz.' },
        pic: { src: feederSmall, cutout: true, alt: { zh: '小弹丸中心供弹', en: '17 mm centre feed' } },
      },
      {
        title: { zh: '大弹丸侧供弹', en: 'Large-projectile side feed' },
        body: { zh: '在队内已有侧供弹方案上优化，针对弹丸尺寸公差做防卡滞结构，用于 RM2024 英雄。', en: 'A refinement of the team’s existing side feed, with anti-jam geometry tuned to projectile size tolerance, used on the RM2024 Hero.' },
        pic: { src: feederLarge, cutout: true, alt: { zh: '大弹丸侧供弹', en: 'Large-projectile side feed' } },
      },
    ] as Stage[],
    mentor: {
      zh: '另外指导学弟优化小弹丸侧供弹，弹频从 20 Hz 提升到接近 30 Hz。',
      en: 'I also mentored a junior teammate on the 17 mm side feed, increasing its rate from 20 Hz to close to 30 Hz.',
    },
  },
  swerve: {
    title: { zh: '两种舵轮模组，两种需求', en: 'Two swerve modules for two jobs' },
    branches: [
      {
        title: { zh: '高负载：工程机器人', en: 'High load: Engineer' },
        body: { zh: '宽橡胶胎提供抓地力和一定减震，四个 MGN7 滑块加气弹簧组成舵下悬挂，扛得住高载荷，底盘姿态稳。', en: 'Wide rubber tyres for grip and some damping; four MGN7 carriages and gas springs form an under-module suspension that carries high load and keeps the chassis level.' },
        pic: { src: engWheel, cutout: true, alt: { zh: '高负载工程舵轮', en: 'High-load Engineer swerve module' } },
      },
      {
        title: { zh: '轻量化：2025 英雄预研', en: 'Lightweight: 2025 Hero study' },
        body: { zh: '舵上直接用 3508 电机本体，齿轮传动配合光电门做位置校准，聚氨酯轮加舵上悬挂，结构高度尽量压缩。', en: 'The 3508 motor body sits on the steering axis, a gear drive with a photoelectric gate handles homing, and polyurethane wheels with over-module suspension keep the height down.' },
        pic: { src: heroWheel, cutout: true, alt: { zh: '轻量化英雄舵轮', en: 'Lightweight Hero swerve module' } },
      },
    ] as Stage[],
  },
};

export const exo = {
  title: { zh: '四自由度手臂外骨骼', en: '4-DOF arm exoskeleton' },
  kind: { zh: '课程项目', en: 'Course project' },
  bullets: [
    { zh: '基于 DH 参数法建立运动学模型，在仿真中验证工作空间覆盖。', en: 'Built a Denavit–Hartenberg kinematic model and checked workspace coverage in simulation.' },
    { zh: '手背 IMU 预测手臂运动方向，驱动外骨骼跟随；助力模式下闭环保持姿态并输出辅助力。', en: 'An IMU on the back of the hand predicts motion and drives the exoskeleton to follow; in assist mode, closed-loop control holds the pose and applies assistive force.' },
  ],
  pic: { src: exoPic, alt: { zh: '四轴手臂外骨骼原型', en: '4-DOF arm exoskeleton prototype' } } as Pic,
};

/* ------------------------------------------------------------------ honours */

export const honours = [
  { year: '2025', title: { zh: 'RoboMaster 2025 工程全明星', en: 'RoboMaster 2025 Engineer All-Star' } },
  { year: '2025', title: { zh: 'RMUC 2025 四级矿石最短兑换', en: 'RMUC 2025 Fastest Level-4 Exchange' } },
  { year: '2024, 2025', title: { zh: 'HKSAR Government Scholarship Fund – Talent Development Scholarship', en: 'HKSAR Government Scholarship Fund – Talent Development Scholarship' } },
  { year: '2023', title: { zh: 'HKUST SENG Dean’s List（Fall 2023）', en: 'HKUST SENG Dean’s List, Fall 2023' } },
];
