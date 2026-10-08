import type { ImageMetadata } from 'astro';
import type { T } from './i18n';

import engReach from '../assets/img/eng-reach.webp';
import engField from '../assets/img/eng-phtot2.jpg';
import engField2 from '../assets/img/eng-photo1.jpg';
import engStats from '../assets/img/eng-mvp.webp';
import engAllstar from '../assets/img/eng-allstar.webp';
import armOverview from '../assets/img/eng-arm-overview.png';
import armRig from '../assets/img/eng-arm.webp';
import armL3 from '../assets/img/arm-l3.webp';
import armL4 from '../assets/img/arm-l4.webp';
import pump from '../assets/img/air-pump.webp';
import engWheel from '../assets/img/eng-wheel.webp';
import controller from '../assets/img/controller.webp';
import heroBot from '../assets/img/hero-bot.webp';
import heroChassis from '../assets/img/hero-chassis-adaptive.webp';
import heroLauncher from '../assets/img/hero-launcher-2024.png';
import launcher4 from '../assets/img/launcher-dual-4.png';
import launcher6 from '../assets/img/launcher-dual-6.png';
import feederLarge from '../assets/img/feeder-large.webp';
import feederSmall from '../assets/img/feeder-small.webp';
import heroWheel from '../assets/img/hero-wheel.webp';
import exoPic from '../assets/img/exo-suit.webp';

export type Pic = { src: ImageMetadata; alt: T; /** CAD render on white: show on a light plate */ light?: boolean };
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
  openSource: { zh: '机械开源', en: 'Open-source CAD' },
  enlarge: { zh: '放大查看', en: 'View larger' },
  close: { zh: '关闭', en: 'Close' },
  loading3d: { zh: '模型加载中', en: 'Loading model' },
  footerNote: {
    zh: '比赛画面来自 RoboMaster 机甲大师官方转播。网站代码与机械设计归作者所有。',
    en: 'Match footage from the official RoboMaster broadcast. Site code and mechanical design by the author.',
  },
} satisfies Record<string, T | Record<string, T>>;

/* ---------------------------------------------------------- page and scene copy */

export const pageCopy = {
  heroCta: { zh: '看工程机器人 2025', en: 'See the 2025 Engineer robot' },
  heroModelAlt: { zh: 'RM2024 英雄机器人整车', en: 'RM2024 Hero robot, full assembly' },
  heroModelCaption: { zh: '整车总装：底盘、云台、发射与供弹，来自 SolidWorks 模型。', en: 'Full assembly: chassis, gimbal, launcher and feed, from the SolidWorks model.' },
  bomTitle: { zh: '能力清单', en: 'Bill of skills' },
  bomHead: {
    no: { zh: '序号', en: 'No.' }, item: { zh: '能力', en: 'Skill' },
    spec: { zh: '规格', en: 'Specification' }, used: { zh: '用在哪', en: 'Used on' },
  },
  honoursTitle: { zh: '荣誉', en: 'Honours' },
  aboutTitle: { zh: '关于我', en: 'About' },
  nextSheet: { zh: '下一张图纸', en: 'Next sheet' },
  drawing: { zh: '图号', en: 'Drawing' },
  projectTitle: { zh: '项目图纸', en: 'Project sheets' },
  projectFigures: [
    { value: '5.8 s', label: { zh: '四级矿石最短兑换时长，第一', en: 'Fastest level-4 ore exchange, ranked first' } },
    { value: '±0.1 m/s', label: { zh: '初速波动', en: 'Muzzle velocity spread' } },
    { value: '>25 Hz', label: { zh: '小弹丸中心供弹，已上车', en: '17 mm centre feed, on robots' } },
  ],
  mainNav: { zh: '主导航', en: 'Main' },
  githubLabel: { zh: 'github.com/ccuiab', en: 'github.com/ccuiab' },
  notFoundTitle: { zh: '图纸未找到', en: 'Sheet not found' },
  notFoundBody: { zh: '这个页面不存在，返回首页继续浏览项目图纸。', en: 'This page does not exist. Return home to browse the project sheets.' },
};

export const sceneCopy = {
  homeDescription: {
    zh: '崔楮焓的 RoboMaster 机械作品集：2025 工程机器人（5.8 s 四级矿石兑换，工程全明星）、2024 英雄机器人与技术预研。',
    en: 'Chuhan Cui’s RoboMaster mechanical portfolio: the 2025 Engineer robot (5.8 s level-4 exchange, Engineer All-Star), the 2024 Hero robot and module R&D.',
  },
  engineer: {
    relatedLinks: { zh: '相关链接', en: 'Links' },
    armFeature: {
      label: { zh: '机械臂实车动作', en: 'The arm in motion on the real robot' },
      credit: { zh: '画面：RoboMaster 机甲大师官方技术短片', en: 'Footage: official RoboMaster feature' },
    },
  },
  armUnfold: {
    folded: { zh: '收折', en: 'Folded' },
    extended: { zh: '展开', en: 'Extended' },
    height: { zh: '腕心高度', en: 'Wrist height' },
    reach: { zh: '腕心前伸', en: 'Wrist reach' },
    envelope: { zh: '整车最大展开', en: 'Whole-robot max envelope' },
    note: {
      zh: '读数为腕心相对肩关节轴的实时位置，来自真实 CAD 模型的关节运动。整车最大展开尺寸计入云台旋转与底盘。',
      en: 'Readouts track the wrist centre against the shoulder axis, driven by the joints of the real CAD model. The whole-robot envelope adds gimbal rotation and the chassis.',
    },
    sketchAlt: { zh: '机械臂从收折到展开', en: 'Arm unfolding from folded to extended' },
  },
  wristExplode: {
    title: { zh: '腕部拆解', en: 'Wrist exploded view' },
    hint: { zh: '向下滚动，腕部按装配顺序拆开', en: 'Scroll to take the wrist apart in assembly order' },
    alt: { zh: 'L4 段与腕部结构 CAD 渲染', en: 'CAD render of the L4 segment and wrist' },
  },
  modelTurntable: {
    hint: { zh: '拖动旋转', en: 'Drag to turn' },
  },
};

/* ------------------------------------------------------------------ person */

export const person = {
  nameZh: '崔楮焓',
  nameEn: 'Chuhan Cui',
  role: 'MECHANICAL LEAD // HKUST ENTERPRIZE',
  badge: 'RM2025 ENGINEER ALL-STAR',
  tagline: { zh: '我设计上赛场的机器人。', en: 'I design robots built for the arena.' },
  subline: { zh: '长臂展，快拆，零重大结构损伤。', en: 'Long reach. Quick release. Zero major structural damage.' },
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
  readouts: [
    { value: '5.8', unit: 's', label: { zh: '四级矿石兑换', en: 'Level-4 ore exchange' } },
    { value: '38', unit: 'kg', label: { zh: '整机质量', en: 'All-up mass' } },
    { value: '1400', unit: 'mm', label: { zh: '最大工作空间', en: 'Max workspace' } },
  ] as Spec[],
};

/* ------------------------------------------------------------- the record */

export const record = {
  value: '5.8',
  title: { zh: '两颗矿石，5.8 秒。', en: 'Two ores. 5.8 seconds.' },
  resultLabel: { zh: '四级兑换 · 官方成绩', en: 'Level 4 · Official result' },
  matchLabel: { zh: '场次', en: 'Match' },
  povLabel: { zh: '操作手视角 · 原速', en: 'Operator view · Real time' },
  broadcastLabel: { zh: '官方转播 · WR NEW', en: 'Official broadcast · WR NEW' },
  playLabel: { zh: '播放', en: 'Play' },
  pauseLabel: { zh: '暂停', en: 'Pause' },
  replayLabel: { zh: '重播', en: 'Replay' },
  povSourceLabel: { zh: '操作手视角来源', en: 'Operator-view source' },
  povSource: 'https://www.bilibili.com/video/BV1yk8gz8Eu2/?p=3&t=1975',
  lede: {
    zh: '这是 RMUC 2025 全场四级矿石的最短兑换时长。机械臂、腕部、底盘和控制器，每一处设计最后都落在这几秒里。',
    en: 'The fastest level-4 ore exchange of RMUC 2025. Every decision in the arm, wrist, chassis and controller ends up inside these few seconds.',
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
  broadcast: { src: engStats, alt: { zh: '官方转播数据卡：四级矿石最短兑换时长 5.8 s，排名第一', en: 'Official broadcast stats card: fastest level-4 ore exchange 5.8 s, ranked first' } } as Pic,
  allstar: { src: engAllstar, alt: { zh: 'RoboMaster 2025 全明星海报：香港科技大学 ENTERPRIZE 工程机器人', en: 'RoboMaster 2025 All-Star poster: HKUST ENTERPRIZE Engineer robot' } } as Pic,
};

/* ---------------------------------------------------------------- projects */

export const engineer = {
  slug: 'engineer',
  drawing: 'ENG-25',
  robotNo: '2',
  title: { zh: 'RoboMaster 2025 工程机器人', en: 'RoboMaster 2025 Engineer Robot' },
  short: { zh: '工程机器人 2025', en: 'Engineer 2025' },
  lede: {
    zh: '六轴机械臂、轮式末端的工程机器人。我独立主导整车结构设计，从 PUMA 构型、连杆参数到整车布局，3 个月从零到上赛场。',
    en: 'An Engineer robot with a six-axis arm and a wheeled end effector. I led the whole-robot structural design, from the PUMA configuration and link lengths to the vehicle layout, and took it from nothing to the competition field in three months.',
  },
  cover: { src: engReach, alt: { zh: '工程机器人，机械臂完全伸出', en: 'The Engineer robot with its arm fully extended' } } as Pic,
  field: { src: engField, alt: { zh: '赛场上的工程机器人', en: 'The Engineer robot on the field' } } as Pic,
  cover2: { src: engField2, alt: { zh: '工程机器人在场地上移动', en: 'The Engineer robot driving across the field' } } as Pic,
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
        {
          zh: '收折状态 590×590×540 mm，满足起始尺寸限制；完全展开的工作空间达到 1400×1400×1200 mm。',
          en: 'It folds to 590×590×540 mm to meet the starting-size limit and reaches a 1400×1400×1200 mm workspace fully extended.',
        },
      ],
      scene: 'arm-unfold',
    },
    {
      id: 'arm',
      mark: 'B',
      title: { zh: '六轴机械臂与腕部', en: 'Six-axis arm and wrist' },
      lede: {
        zh: 'L2 上臂 380 mm，L3+L4 前臂 420 mm。臂展、兑矿灵活性和末端刚度在这两个数字里取平衡。',
        en: 'A 380 mm L2 upper arm and a 420 mm L3+L4 forearm. Those two numbers balance reach and exchange dexterity against wrist stiffness.',
      },
      specs: [
        { label: { zh: 'L2 上臂', en: 'L2 upper arm' }, value: '380', unit: 'mm' },
        { label: { zh: 'L3+L4 前臂', en: 'L3+L4 forearm' }, value: '420', unit: 'mm' },
      ],
      bullets: [
        {
          zh: 'J4 用电滑环嵌套中空旋转气动接头，连续旋转时供电和气路照常传输，腕部不用和线缆较劲。',
          en: 'At J4 an electrical slip ring nests inside a hollow rotary air union, so power and air pass through unlimited rotation and the wrist never fights a cable loop.',
        },
        {
          zh: '万向轴传动让电机可以后置在 L4 上，末端体积压到能伸进矿槽。',
          en: 'A universal-joint driveshaft lets the motor sit back on L4, shrinking the wrist enough to reach inside an ore slot.',
        },
        {
          zh: 'J5/J6 组合使用等速同步轮、齿轮组和锥齿轮，实测 J5 接近零背隙。',
          en: 'J5/J6 combine constant-velocity timing pulleys, gear sets and bevel gears; J5 measured close to zero backlash.',
        },
        {
          zh: '腕部集成 HB80 风琴吸盘、驱动轮、J5/J6 两轴传动和稳定气路，抓取和移动在同一个末端完成。',
          en: 'The wrist packages an HB80 bellows suction cup, a drive wheel, the J5/J6 drivetrain and a stable air path, so gripping and driving happen at the same end effector.',
        },
      ],
      pics: [
        { src: armOverview, light: true, alt: { zh: '六轴机械臂 CAD 总览', en: 'Six-axis arm, CAD overview' } },
        { src: armL3, light: true, alt: { zh: 'L3 段：万向轴传动与电机后置', en: 'L3 segment: universal-joint drive with the motor moved back' } },
        { src: armL4, light: true, alt: { zh: 'L4 段与腕部结构', en: 'L4 segment and wrist structure' } },
        { src: armRig, alt: { zh: '机械臂装配实物', en: 'The assembled arm on the bench' } },
      ],
    },
    {
      id: 'chassis',
      mark: 'C',
      title: { zh: '高稳定舵轮底盘', en: 'High-stability swerve chassis' },
      lede: {
        zh: '重机械臂高速动作时，底盘要稳住。操作手可以边移动底盘边操作机械臂。',
        en: 'When a heavy arm moves fast, the chassis has to stay put. The operator can keep driving while working the arm.',
      },
      bullets: [
        {
          zh: '5 寸实心橡胶轮提供抓地力和耐磨性，支撑赛场脱困与快速返回补给。',
          en: 'Five-inch solid rubber tyres provide the grip and wear resistance to break free on the field and get back to supply quickly.',
        },
        {
          zh: '3508 自制减速箱、MGN7 滑轨和气弹簧组成舵下悬挂，扛得住高载荷，小陀螺时也稳。',
          en: 'A custom 3508 gearbox, MGN7 rails and gas springs form an under-module suspension that carries high load and stays stable in spin mode.',
        },
        {
          zh: '单个舵轮模组按快拆设计，场间排障直接换模块。',
          en: 'Each swerve module detaches on its own, so between-match fixes are a module swap.',
        },
      ],
      pics: [{ src: engWheel, light: true, alt: { zh: '工程舵轮模组', en: 'Engineer swerve module' } }],
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
          zh: '用电机电流反馈判断吸附状态，几乎零成本得到类似气压计的检测，掉矿风险可以提前发现。',
          en: 'Motor current feedback reads the suction state, giving barometer-like sensing at almost no cost and early warning of a dropped ore.',
        },
        {
          zh: '整泵不到 300 g，给机械臂末端留出更多质量和惯量余量。',
          en: 'At under 300 g it leaves more mass and inertia budget at the end of the arm.',
        },
      ],
      pics: [{ src: pump, light: true, alt: { zh: '3508 改装真空泵', en: '3508-converted vacuum pump' } }],
    },
    {
      id: 'reliability',
      mark: 'E',
      title: { zh: '赛场可靠性', en: 'Field reliability' },
      lede: {
        zh: '半年高强度调试和实战，零重大结构损伤。',
        en: 'Six months of hard testing and competition with zero major structural failures.',
      },
      bullets: [
        {
          zh: '云台与底盘、云台与机械臂、机械臂整体、单个舵轮模组，四处都按快拆设计，场间排障以模块为单位。',
          en: 'Gimbal to chassis, gimbal to arm, the arm as a unit and each swerve module all detach quickly, so between-match troubleshooting works module by module.',
        },
        {
          zh: '模块化结构也让小幅机构调整可以快速迭代，不用整车返工。',
          en: 'The same modularity made it possible to iterate small mechanism changes quickly without reworking the whole robot.',
        },
      ],
    },
    {
      id: 'controller',
      mark: 'F',
      title: { zh: '自定义控制器', en: 'Custom controller' },
      lede: {
        zh: '工程机器人的输入终端。拓扑和主机械臂近似同构，按 1:2 映射，操作手不用在脑子里换算姿态。',
        en: 'The Engineer robot’s input device. Its topology mirrors the main arm with a 1:2 mapping, so the operator stops translating hand motion into robot pose.',
      },
      bullets: [
        {
          zh: '按操作手的手臂数据调整 L2 位置，操作姿态更自然，长时间操作也稳。',
          en: 'L2 was placed from the operator’s own arm measurements, giving a more natural posture and steadier control over a long match.',
        },
        {
          zh: '四级矿兑换时可以单手、不换姿势完成左右肘位切换，高压下少一次动作重置。',
          en: 'During a level-4 exchange the operator switches between left and right elbow positions one-handed, without resetting posture, which removes a costly motion under pressure.',
        },
        {
          zh: '桌面级尺寸、低运动惯量，手部动作到机械臂响应跟得更紧。',
          en: 'Desk-scale and low in moving inertia, so the arm tracks the operator’s hand closely.',
        },
        {
          zh: '关键受力件用 CNC，外壳和辅助结构 3D 打印，成本低，围绕操作反馈迭代也快。',
          en: 'CNC for the load-bearing parts and 3D printing for the shell and brackets kept cost low and made iterating on operator feedback quick.',
        },
      ],
      pics: [{ src: controller, light: true, alt: { zh: '自定义控制器', en: 'Custom controller' } }],
    },
  ] as Chapter[],
  links: [
    { label: { zh: '机械开源（RoboMaster 论坛）', en: 'Open-source CAD (RoboMaster forum)' }, href: 'https://bbs.robomaster.com/article/803685?source=8' },
    { label: { zh: '官方技术短片（Bilibili）', en: 'Official feature video (Bilibili)' }, href: 'https://www.bilibili.com/video/BV1Y482zjERP/' },
  ],
};

export const hero = {
  slug: 'hero',
  drawing: 'HERO-24',
  robotNo: '1',
  title: { zh: 'RoboMaster 2024 英雄机器人', en: 'RoboMaster 2024 Hero Robot' },
  short: { zh: '英雄机器人 2024', en: 'Hero 2024' },
  lede: {
    zh: '我独立负责整车机械设计，覆盖云台、发射、42 mm 大弹丸侧供弹和自适应悬挂，补上了队里英雄机器人这一块能力。',
    en: 'I was the sole mechanical designer for the whole robot, covering the gimbal, launcher, 42 mm side feed and adaptive suspension, and filled the gap the team had in its Hero lineup.',
  },
  cover: { src: heroBot, light: true, alt: { zh: 'RM2024 英雄机器人整车', en: 'RM2024 Hero robot' } } as Pic,
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
        zh: '从弹道和俯仰角建模出发，最后靠样机问题闭环收敛。',
        en: 'It started with ballistic and pitch modelling and converged by closing the loop on prototype faults.',
      },
      bullets: [
        {
          zh: '针对摩擦轮振动、掉速和弹丸未共速三个问题逐一迭代结构。',
          en: 'The structure was iterated against three faults one by one: friction-wheel vibration, speed droop and projectiles leaving before matching wheel speed.',
        },
        {
          zh: '摩擦轮改为对轴支撑，两端都有轴承，再加一对预加速小轮。10 m 散布小于 25×25 cm，初速波动约 ±0.1 m/s。',
          en: 'The friction wheels moved onto double-supported shafts, with bearings at both ends, and gained a pre-acceleration wheel pair. Dispersion at 10 m dropped under 25×25 cm with muzzle velocity holding to about ±0.1 m/s.',
        },
      ],
      pics: [
        { src: heroLauncher, light: true, alt: { zh: 'RM2024 英雄发射机构', en: 'RM2024 Hero launcher' } },
        { src: heroBot, light: true, alt: { zh: '英雄机器人整车', en: 'Hero robot, full assembly' } },
      ],
    },
    {
      id: 'feed',
      mark: 'B',
      title: { zh: '42 mm 大弹丸侧供弹', en: '42 mm side feed' },
      lede: {
        zh: '面向类高尔夫球的大弹丸连续供弹，在队内已有的侧供弹方案上优化，先收敛可靠性和卡滞风险。',
        en: 'Built to feed golf-ball-sized 42 mm projectiles continuously. It refines the team’s existing side-feed design and prioritises reliability and jam prevention over novelty.',
      },
      bullets: [
        {
          zh: '针对弹丸尺寸公差优化防卡滞结构，2 Hz 稳定供弹不卡顿。',
          en: 'Anti-jam geometry tuned around projectile size tolerance sustains a steady 2 Hz feed.',
        },
      ],
      pics: [{ src: feederLarge, light: true, alt: { zh: '大弹丸侧供弹', en: '42 mm side feed' } }],
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
          zh: '较大轮距加预紧压簧，抑制大弹丸发射后坐力带来的整车晃动。',
          en: 'A wide track and preloaded compression springs damp the body roll that follows a 42 mm shot.',
        },
        {
          zh: '实测通过飞坡、15 cm 正向下台阶、8 cm 侧向下台阶和 30 cm 垂直跌落。',
          en: 'Tested through ramp jumps, 15 cm forward step descents, 8 cm lateral step descents and a 30 cm vertical drop.',
        },
      ],
      pics: [{ src: heroChassis, light: true, alt: { zh: '自适应悬挂底盘', en: 'Adaptive suspension chassis' } }],
    },
  ] as Chapter[],
};

export type Stage = { title: T; body: T; pic?: Pic; verdict?: T };

export const research = {
  slug: 'research',
  drawing: 'RND-2425',
  title: { zh: '2024–2025 技术预研', en: '2024–2025 R&D' },
  short: { zh: '技术预研', en: 'R&D' },
  lede: {
    zh: '比赛之外的模块预研。两条迭代线一路做到能上车，另外两种舵轮按不同兵种的需求分头验证。',
    en: 'Module research outside the match calendar. Two lines iterated until they were ready for a robot, and two swerve designs were tested separately against the needs of different robot classes.',
  },
  cover: { src: launcher6, light: true, alt: { zh: '双级六摩擦轮发射机构', en: 'Dual-stage six-wheel launcher' } } as Pic,
  launcher: {
    title: { zh: '发射机构：从单级到双级六摩擦轮', en: 'Launcher: from single-stage to dual-stage six-wheel' },
    stages: [
      {
        title: { zh: 'RM2024 英雄单级发射', en: 'RM2024 Hero, single stage' },
        body: { zh: '对轴摩擦轮加预加速小轮，是后面所有多级方案的起点。', en: 'Double-supported friction wheels with a pre-acceleration pair: the starting point for every multi-stage design that followed.' },
        pic: { src: heroLauncher, light: true, alt: { zh: 'RM2024 英雄发射机构', en: 'RM2024 Hero launcher' } },
      },
      {
        title: { zh: '双级四摩擦轮样机', en: 'Dual-stage, four wheels' },
        body: { zh: '样机暴露左右散布较大的问题。中间试过三摩擦轮，初射角稳定了，弹速一致性不够。', en: 'The prototype showed wide left-right dispersion. A three-wheel detour stabilised launch angle but could not hold muzzle velocity consistent.' },
        pic: { src: launcher4, light: true, alt: { zh: '双级四摩擦轮样机', en: 'Dual-stage four-wheel prototype' } },
      },
      {
        title: { zh: '双级六摩擦轮', en: 'Dual-stage, six wheels' },
        body: { zh: '列为主要研发方向，同时兼顾弹速一致性和散布控制。', en: 'Designated the main development direction, aiming to hold both velocity consistency and dispersion.' },
        pic: { src: launcher6, light: true, alt: { zh: '双级六摩擦轮方案', en: 'Dual-stage six-wheel design' } },
      },
    ] as Stage[],
  },
  feeder: {
    title: { zh: '小弹丸中心供弹：从初版到上车', en: '17 mm centre feed: from first pass to robots' },
    stages: [
      {
        title: { zh: '初版预研', en: 'First pass' },
        body: { zh: '多层预制、整流罩、防剪切优先的设计思路。', en: 'Multi-layer staging, a fairing, and shear protection as the leading priority.' },
        pic: { src: feederSmall, light: true, alt: { zh: '小弹丸中心供弹', en: '17 mm centre feed' } },
      },
      {
        title: { zh: '迭代上车', en: 'On the robots' },
        body: { zh: '迭代后用于队内步兵、哨兵和无人机，17 mm 弹丸供弹频率 25 Hz 以上，结构小巧轻便。', en: 'The iterated version went onto the team’s infantry, sentry and aerial robots, feeding 17 mm projectiles at over 25 Hz in a small, light package.' },
      },
    ] as Stage[],
    mentor: {
      zh: '另外指导学弟优化小弹丸侧供弹，弹频从 20 Hz 提升到接近 30 Hz。',
      en: 'I also mentored a junior member through the 17 mm side feed, taking it from 20 Hz to close to 30 Hz.',
    },
  },
  swerve: {
    title: { zh: '两种舵轮模组，两种需求', en: 'Two swerve modules for two jobs' },
    lede: {
      zh: '同一个问题，按不同兵种的空间、载荷和机动需求分头验证。',
      en: 'The same problem, tested separately against the space, load and mobility needs of different robot classes.',
    },
    branches: [
      {
        title: { zh: '高负载：工程机器人', en: 'High load: Engineer' },
        body: { zh: '宽橡胶胎提供抓地力和一定减震，四个 MGN7 滑块加气弹簧组成舵下悬挂，扛得住高载荷，底盘姿态稳。', en: 'Wide rubber tyres for grip and some damping; four MGN7 carriages and gas springs form an under-module suspension that carries high load and keeps the chassis level.' },
        pic: { src: engWheel, light: true, alt: { zh: '高负载工程舵轮', en: 'High-load Engineer swerve module' } },
      },
      {
        title: { zh: '轻量化：2025 英雄预研', en: 'Lightweight: 2025 Hero study' },
        body: { zh: '舵上直接用 3508 电机本体，齿轮传动配合光电门做位置校准，聚氨酯轮加舵上悬挂，结构高度尽量压缩。', en: 'The 3508 motor body sits on the steering axis, a gear drive with a photoelectric gate handles homing, and polyurethane wheels with over-module suspension keep the height down.' },
        pic: { src: heroWheel, light: true, alt: { zh: '轻量化英雄舵轮', en: 'Lightweight Hero swerve module' } },
      },
    ] as Stage[],
  },
};

export const exo = {
  title: { zh: '四自由度手臂外骨骼', en: '4-DOF arm exoskeleton' },
  kind: { zh: '课程项目', en: 'Course project' },
  lede: {
    zh: '面向上肢助力与人机协同的 4 自由度轻量化原型，用运动学建模和基础控制验证可行性。',
    en: 'A lightweight 4-DOF prototype for upper-limb assistance, validated through kinematic modelling and basic closed-loop control.',
  },
  bullets: [
    { zh: '按大臂和肘部的主要自由度布置关节轴线，减少人机运动干涉。', en: 'Joint axes follow the dominant degrees of freedom of the upper arm and elbow to minimise interference with the wearer.' },
    { zh: '基于 DH 参数法建立运动学模型，在仿真中验证工作空间覆盖。', en: 'Built a Denavit–Hartenberg kinematic model and checked workspace coverage in simulation.' },
    { zh: '手背 IMU 预测手臂运动方向，驱动外骨骼跟随；助力模式下闭环保持姿态并输出辅助力。', en: 'An IMU on the back of the hand predicts motion and drives the exoskeleton to follow; in assist mode closed-loop control holds the pose and adds force.' },
  ],
  pic: { src: exoPic, alt: { zh: '四轴手臂外骨骼原型', en: '4-DOF arm exoskeleton prototype' } } as Pic,
};

/* ------------------------------------------------------------------ skills */

export const bom = [
  {
    no: 'S-01',
    item: { zh: '结构设计', en: 'Structural design' },
    spec: { zh: 'SolidWorks 建模、装配、工程图与 BOM；AutoCAD、Fusion 360', en: 'SolidWorks modelling, assemblies, drawings and BOMs; AutoCAD, Fusion 360' },
    used: { zh: '全部项目', en: 'Every project' },
  },
  {
    no: 'S-02',
    item: { zh: '制造与装配', en: 'Manufacturing and assembly' },
    spec: { zh: 'CNC 与 3D 打印件设计、加工沟通；两年高精度装配，公差修正、赛前质检、场间维修', en: 'Designing for CNC and 3D printing, briefing machinists; two years of precision assembly, tolerance fixes, pre-match checks and between-match repair' },
    used: { zh: '工程 2025、控制器', en: 'Engineer 2025, controller' },
  },
  {
    no: 'S-03',
    item: { zh: '传动与气动', en: 'Drivetrains and pneumatics' },
    spec: { zh: '电机选型、轴承、齿轮、链条、同步带；气动系统与吸附检测', en: 'Motor selection, bearings, gears, chains and timing belts; pneumatics and suction sensing' },
    used: { zh: '机械臂 J4–J6、改装真空泵', en: 'Arm J4–J6, vacuum pump' },
  },
  {
    no: 'S-04',
    item: { zh: '材料与可靠性', en: 'Materials and reliability' },
    spec: { zh: '常用材料、钣金与板材组合；基础强度仿真，负载与冲击测试', en: 'Common materials, sheet and plate construction; basic strength simulation, load and impact testing' },
    used: { zh: '英雄底盘跌落测试', en: 'Hero chassis drop test' },
  },
  {
    no: 'S-05',
    item: { zh: '软件与嵌入式', en: 'Software and embedded' },
    spec: { zh: 'Python、MATLAB 脚本与数据处理；C/C++、STM32 嵌入式开发基础流程', en: 'Python and MATLAB for scripts and data; basic embedded development with C/C++ and STM32' },
    used: { zh: '外骨骼 IMU 跟随', en: 'Exoskeleton IMU tracking' },
  },
  {
    no: 'S-06',
    item: { zh: '跨组联调', en: 'Cross-team integration' },
    spec: { zh: '和电控、视觉、算法一起对齐联调风险', en: 'Aligning integration risk with the electronics, vision and algorithms teams' },
    used: { zh: '工程 2025 操作链路', en: 'Engineer 2025 operator loop' },
  },
];

/* ------------------------------------------------------------------ honours */

export const honours = [
  { year: '2025', title: { zh: 'RoboMaster 2025 工程全明星', en: 'RoboMaster 2025 Engineer All-Star' } },
  { year: '2025', title: { zh: 'RMUC 2025 四级矿石最短兑换时长 5.8 s，数据卡排名第一', en: 'RMUC 2025 fastest level-4 ore exchange, 5.8 s, ranked first on the stats card' } },
  { year: '2024, 2025', title: { zh: 'HKSAR Government Scholarship Fund – Talent Development Scholarship', en: 'HKSAR Government Scholarship Fund – Talent Development Scholarship' } },
  { year: '2023', title: { zh: 'HKUST SENG Dean’s List（Fall 2023）', en: 'HKUST SENG Dean’s List, Fall 2023' } },
];
