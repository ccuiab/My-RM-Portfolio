# English Portfolio (docs/en.html) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an English translation of the portfolio at `docs/en.html`, faithful in structure to the Chinese original and idiomatic in its English prose, while leaving the Chinese page's rendering byte-for-byte unchanged.

**Architecture:** `en.html` is a structural clone of `index.html` — same tags, classes, ids, image sources, and inline handlers — with every text node rewritten in English. The shared `style.css` gains a small `html[lang="en"]`-scoped block for Latin typography; the Chinese page carries `lang="zh-CN"` so none of those selectors match it. `script.js` is untouched and shared verbatim. Structural fidelity is enforced mechanically by two diff scripts rather than by eye.

**Tech Stack:** Plain HTML5 / CSS3 / vanilla JavaScript, zero dependencies. Python 3.11 (stdlib `html.parser` + `difflib`) for the verification scripts. Git Bash and PowerShell are both available; **all commands in this plan are PowerShell**, because the Bash tool's `/tmp` does not resolve to the same directory the Write tool uses.

**Spec:** `specs/2026-08-18-english-portfolio.md`

## Global Constraints

These apply to every task. Values are copied verbatim from the spec.

- **Chinese page is immutable** except for exactly one added line (Task 4). No wording, styling, or structural change to `docs/index.html` beyond that line.
- **`docs/script.js` gets zero changes.**
- **All `id` attributes must be preserved exactly.** `script.js` hardcodes `sectionIds = ['about','projects','proj-engineering','proj-controller','proj-hero','proj-exo','research','awards']`; any renamed id silently breaks scroll spy on the English page.
- **All `class` attributes preserved exactly**, including the American spellings `honors-card` and `honors-list`. British spelling governs visible copy only, never code identifiers.
- **All `img` attributes preserved:** `src`, `width`, `height`, `loading`, `decoding`. The first image (`eng-allstar.webp`) keeps `loading="eager"` — it is the CLS fix.
- **All `onclick` handlers and `data-gallery` values preserved verbatim.**
- **Emoji stay as numeric entities** (`&#128736;` etc.), copied unchanged from the Chinese source.
- **Bullet counts 1:1** with the Chinese page. Never merge, split, or drop an `<li>`.
- **British spelling** in visible copy: `Honours`, `optimise`, `optimisation`, `tyre`, `stabilise`, `minimise`, `analyse`, `aluminium`, `modularised`, `centre`. Proper nouns unaffected (`Dean's List`).
- **Units bound with `&nbsp;`**, real minus sign U+2212 for negative values: `5.8&nbsp;s`, `40&nbsp;L/min`, `−85&nbsp;kPa`, `25×25&nbsp;cm`, `38&nbsp;kg`, `2&nbsp;Hz`, `5000&nbsp;rpm`, `±0.1&nbsp;m/s`, `&lt;300&nbsp;g`, `380&nbsp;mm`.
- **`WR` stays as the two letters `WR`** — never expanded to "world record", never softened to "record". Three occurrences.
- **`<strong>` emphasis preserved** at the same semantic positions as the Chinese original.
- **Bullets are one sentence, ≈28 words max.**
- **Verification scripts live in the scratchpad**, never committed: `D:\tmp\claude-1000\D--AI-playground-My-RM-Portfolio/a8f06bf1-96a6-4831-33fd-a58e8d5aaa8e/scratchpad`. Referred to below as `$SP`.

---

## File Structure

| File | Disposition |
|---|---|
| `docs/en.html` | **Create.** ~493 lines, structural clone of `index.html`. |
| `docs/style.css` | **Modify.** Append ~20 lines at end (after line 821). |
| `docs/index.html` | **Modify.** One line added in `.contact` (after line 21). |
| `docs/script.js` | Untouched. |
| `$SP/skeldiff.py` | Already written and verified. Not committed. |
| `$SP/bulletdiff.py` | Already written and verified. Not committed. |

The verification scripts already exist and have been tested — they report `OK` when a file is compared with itself (367 start tags, 24 lists) and correctly flag both a renamed `id` and a dropped `<li>`. Task 1 re-confirms them; it does not write them.

---

### Task 1: Confirm the verification harness

Establishes the mechanical gate everything else leans on. If these scripts don't work, no later task's "verify" step means anything.

**Files:**
- Read only: `$SP/skeldiff.py`, `$SP/bulletdiff.py`, `docs/index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: two working commands used by Tasks 2–4:
  - `python "$SP\skeldiff.py" docs\index.html docs\en.html` → exit 0 when skeletons match
  - `python "$SP\bulletdiff.py" docs\index.html docs\en.html` → exit 0 when bullet counts match

- [ ] **Step 1: Confirm both scripts exist**

```powershell
Set-Location "D:\AI_playground\My-RM-Portfolio"
$SP = "D:\tmp\claude-1000\D--AI-playground-My-RM-Portfolio/a8f06bf1-96a6-4831-33fd-a58e8d5aaa8e/scratchpad"
Get-ChildItem "$SP\*.py" | Select-Object Name, Length
```

Expected: `skeldiff.py` and `bulletdiff.py` both listed.

If they are missing, their full source is in the spec's sibling — recreate from this plan's appendix (§Appendix A) before continuing.

- [ ] **Step 2: Verify they pass on identity**

```powershell
python "$SP\skeldiff.py" docs\index.html docs\index.html
python "$SP\bulletdiff.py" docs\index.html docs\index.html
```

Expected, both exit 0:
```
OK: skeletons identical (367 start tags)
OK: 24 lists, all bullet counts match
```

The number 367 is the pre-link baseline. After Task 4 adds the language anchor to both pages, the budget becomes 369 and Task 5 checks it there.

- [ ] **Step 3: Verify they catch a real defect**

```powershell
$c = Get-Content docs\index.html -Raw -Encoding UTF8
$c = $c -replace 'id="rd-pump"','id="rd-pumpX"'
Set-Content "$SP\broken.html" -Value $c -Encoding UTF8 -NoNewline
python "$SP\skeldiff.py" docs\index.html "$SP\broken.html"
```

Expected: exit 1, diff showing `-div class="subsystem-card" id="rd-pump"` against `+... id="rd-pumpX"`.

A script that passes here is broken and must be fixed before proceeding.

- [ ] **Step 4: Remove the fixture**

```powershell
Remove-Item "$SP\broken.html"
```

No commit — nothing in the repo changed.

---

### Task 2: Append English typography to style.css

Done before the HTML so the page renders correctly the first time it is opened, rather than being judged under Chinese line-heights.

**Files:**
- Modify: `docs/style.css` (append after line 821, end of file)

**Interfaces:**
- Consumes: nothing.
- Produces: the `html[lang="en"]` scope that `en.html` activates via its root element.

- [ ] **Step 1: Record the Chinese page's current rendering**

This is the regression baseline. Capture the exact bytes of the file being modified:

```powershell
Set-Location "D:\AI_playground\My-RM-Portfolio"
(Get-FileHash docs\style.css -Algorithm SHA256).Hash
(Get-Content docs\style.css -Encoding UTF8).Count
```

Expected: 821 lines. Note the hash — Step 4 confirms only additions occurred.

Use `.Count` on the array, not `Measure-Object -Line`: the latter skips blank lines and under-reports this file as 693.

- [ ] **Step 2: Append the block**

Append exactly this to the end of `docs/style.css`, preserving the existing trailing blank line above it:

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

Note `.honors-list` keeps its American spelling — it is a selector, not copy.

- [ ] **Step 3: Verify every new rule is scoped**

```powershell
$new = Get-Content docs\style.css -Encoding UTF8 | Select-Object -Skip 821
$unscoped = $new | Where-Object { $_ -match '^\s*[\.\#a-zA-Z]' -and $_ -notmatch 'html\[lang="en"\]' -and $_ -notmatch '^\s*/\*' }
if ($unscoped) { Write-Output "FAIL — unscoped selector:"; $unscoped } else { Write-Output "OK: all added selectors scoped to lang=en" }
```

Expected: `OK: all added selectors scoped to lang=en`

An unscoped selector here would leak into the Chinese page and violate the top global constraint.

- [ ] **Step 4: Verify the original 821 lines are untouched**

```powershell
git diff --stat docs/style.css
git diff docs/style.css | Select-String '^-[^-]' 
```

Expected: `1 file changed, N insertions(+)` with **zero deletions**, and the second command printing nothing. Any `-` line means an existing rule was modified.

- [ ] **Step 5: Commit**

```powershell
git add docs/style.css
git commit -m @'
feat: 为英文页追加拉丁排版样式

html[lang="en"] 作用域，中文页不命中，渲染不变。
'@
```

---

### Task 3: Create docs/en.html

The bulk of the work. Written as one task because the file is a single artefact — a reviewer cannot meaningfully accept "the first half of an HTML file."

**Files:**
- Create: `docs/en.html`
- Read: `docs/index.html` (the structural source of truth)

**Interfaces:**
- Consumes: `html[lang="en"]` CSS scope from Task 2.
- Produces: a page that Tasks 4–6 verify. Exposes no API.

**Method:** copy `docs/index.html` to `docs/en.html` first, then replace text nodes in place. Do **not** retype the HTML from memory — copying is what guarantees the 367 tags and every attribute survive.

- [ ] **Step 1: Copy the Chinese page verbatim**

```powershell
Set-Location "D:\AI_playground\My-RM-Portfolio"
Copy-Item docs\index.html docs\en.html
python "D:\tmp\claude-1000\D--AI-playground-My-RM-Portfolio/a8f06bf1-96a6-4831-33fd-a58e8d5aaa8e/scratchpad/skeldiff.py" docs\index.html docs\en.html
```

Expected: `OK: skeletons identical (367 start tags)` — trivially true at this point, since the file is a byte-for-byte copy.

Do not re-run this check during Steps 2–3. Step 2 adds the language-switch anchor, taking `en.html` to 369 tags while `index.html` is still at 367; the diff is *supposed* to fail in that window. Task 4 adds the matching anchor to the Chinese page, and Task 5 verifies both at 369.

- [ ] **Step 2: Replace the head and sidebar**

`lang`, `<title>`, nav labels, and the language link. Use the short nav labels — the sidebar sub-items have only ~196 px of usable width.

| Line | Chinese | English |
|---|---|---|
| 2 | `<html lang="zh-CN">` | `<html lang="en">` |
| 6 | `<title>崔楮焓 — Personal Portfolio</title>` | `<title>CUI Chuhan — Portfolio</title>` |
| 14 | `aria-label="菜单"` | `aria-label="Menu"` |
| 16 | `<div class="name">崔楮焓</div>` | `<div class="name">CUI Chuhan</div>` |
| 26 | `<div class="nav-section-title">目录</div>` | `<div class="nav-section-title">Contents</div>` |

Line 17's `.subtitle` and line 18's `.badge` are already English — leave them exactly as they are.

After line 21's mailto link, add the language switch as a third `.contact` anchor:

```html
      <a href="index.html"><span class="icon">&#127760;</span>中文</a>
```

Nav list (lines 28–35), short labels:

```html
      <li><a href="#about" class="active">Profile</a></li>
      <li><a href="#projects">Projects</a></li>
      <li><a href="#proj-engineering" class="sub">2025 Engineer Robot</a></li>
      <li><a href="#proj-controller" class="sub">Custom Controller</a></li>
      <li><a href="#proj-hero" class="sub">2024 Hero Robot</a></li>
      <li><a href="#proj-exo" class="sub">4-DOF Exoskeleton</a></li>
      <li><a href="#research" class="sub">Pre-Research</a></li>
      <li><a href="#awards">Honours &amp; Awards</a></li>
```

Every `href` is unchanged — those anchors are what `script.js` matches against.

- [ ] **Step 3: Replace all body copy**

The complete English text follows, section by section. Structure, emoji entities, and `<strong>` placement come from the Chinese source; only text nodes change.

**§ Profile (lines 44–80)**

```html
    <h2 class="section-title">&#128100; Profile</h2>
```

Intro paragraphs:

```html
        <p>&#127891; <strong>BEng in Computer Engineering (CPEG), HKUST — minor in AI / Robotics, 2023–2027</strong></p>
        <p style="margin-top:4px;">&#129302; <strong>Mechanical Lead, HKUST ENTERPRIZE</strong> — led the structural design of the RM2025 Engineer robot. Named an <strong>Engineer All-Star</strong> for the 2025 season, with a <strong>5.8&nbsp;s</strong> level-4 ore exchange WR set on the competition field.</p>
```

Four skill blocks, headings then bullets:

```html
          <h4><span class="dot"></span>Structural Design</h4>
          <ul>
            <li>SolidWorks modelling, assembly design, drawings, BOMs and assembly documentation</li>
            <li>Modular, quick-release, maintenance-friendly structures and the spatial layout of complex mechanisms</li>
          </ul>
```

```html
          <h4><span class="dot"></span>Manufacturing &amp; Assembly</h4>
          <ul>
            <li>Designing parts for CNC and 3D printing, briefing machinists, and debugging assemblies on the bench</li>
            <li>Tolerance correction, pre-match quality checks, between-match repairs and equipment upkeep</li>
          </ul>
```

```html
          <h4><span class="dot"></span>Mechatronics &amp; Process</h4>
          <ul>
            <li>Pneumatic systems, motor selection, bearings, gears, chain and timing-belt drives</li>
            <li>Common materials, sheet-metal and plate construction, and the trade-off between structural strength and impact reliability</li>
          </ul>
```

```html
          <h4><span class="dot"></span>Simulation &amp; Integration</h4>
          <ul>
            <li>Basic strength simulation, load and impact testing, and closing the loop on prototype faults</li>
            <li>Python / MATLAB / C++ for data processing and debugging, aligning integration risk with the electronics, vision and algorithms teams</li>
          </ul>
```

**§ Projects heading (line 86)**

```html
    <h2 class="section-title">&#9881; Projects</h2>
```

**§ Engineer 2025 system group (lines 91–166)**

```html
      <div class="system-group-title">RM 2025 Engineer Robot</div>
```

Card header:

```html
          <h3><span class="icon">&#9881;</span>RoboMaster 2025 Engineer Robot</h3>
          <div class="project-subtitle">Long-reach 6-DOF arm <span class="sep">·</span> High-stability chassis <span class="sep">·</span> Fast exchange loop</div>
```

Image `alt` text: `alt="全明星"` → `alt="All-Star"`, `alt="工程全明星"` → `alt="Engineer All-Star"`, `alt="工程机器人实物图 1"` → `alt="Engineer robot, competition build 1"`, `alt="工程机器人实物图 2"` → `alt="Engineer robot, competition build 2"`. The thumbnail `<img>` tags carry no `alt` in the original — do not add any.

Highlight:

```html
            <div class="highlight">&#127942; Set a <strong>5.8&nbsp;s</strong> level-4 ore exchange WR on the competition field and was named a RoboMaster Engineer All-Star for the 2025 season.</div>
```

Detail blocks — the Engineer robot is the ore-handling robot of a RoboMaster team, so the first bullet is where that gets established for a reader who has never seen the game:

```html
              <h5>&#128736; Whole-Robot Architecture &amp; Workspace</h5>
              <ul>
                <li>Owned the structural design of this wheeled six-axis Engineer robot — the manipulator platform that retrieves and exchanges ore — settling the PUMA configuration, link parameters and vehicle layout around retrieval, exchange, step climbing, stealing opposing ore and rescue duties</li>
                <li>38&nbsp;kg all-up, folding to 590×590×540&nbsp;mm and reaching a 1400×1400×1200&nbsp;mm workspace fully extended</li>
                <li>Treated arm workspace, FPV sight lines, UWB placement and the operator control loop as whole-robot constraints, which cut both collision risk and integration effort</li>
              </ul>
```

```html
              <h5>&#129521; Six-Axis Arm &amp; Wrist</h5>
              <ul>
                <li>A 380&nbsp;mm L2 upper arm and 420&nbsp;mm L3+L4 forearm balance reach and exchange dexterity against wrist stiffness</li>
                <li>A nested electrical slip ring and hollow rotary union at J4 carry both power and air through unlimited rotation, so the wrist never fights a cable loop</li>
                <li>The wrist packages the suction cup, drive wheel, the J5/J6 drivetrain and a stable air path into one assembly that supports fast pick-and-exchange motions</li>
              </ul>
```

```html
              <h5>&#128664; High-Stability Swerve Chassis</h5>
              <ul>
                <li>Five-inch solid tyres, a custom 3508 gearbox, MGN7 rails and gas-spring under-module suspension together give the chassis grip, the ability to break free of obstacles, and a steady platform during an exchange</li>
                <li>The suspension absorbs the disturbance a heavy arm throws into the chassis at speed, so the driver can keep moving while operating the arm</li>
                <li>A high-flow 3508-converted vacuum pump with suction-state feedback makes ore pickup more repeatable</li>
              </ul>
```

```html
              <h5>&#128295; Field Reliability &amp; Maintenance</h5>
              <ul>
                <li>Gimbal-to-chassis, gimbal-to-arm, the arm as a unit and each individual swerve module all detach quickly, which is what makes between-match troubleshooting possible</li>
                <li>Six months of hard testing and competition with zero major structural failures — the foundation under the 5.8&nbsp;s level-4 ore exchange WR and the Engineer All-Star selection</li>
              </ul>
```

Tags and links:

```html
              <span class="tag">Mechanical Design</span><span class="tag">System Integration</span><span class="tag">Precision</span><span class="tag">Reliability</span>
```

```html
              <a href="https://www.bilibili.com/video/BV1Y482zjERP/?spm_id_from=333.788.videopod.sections&vd_source=a3191892d8abed85f77e649dae496839" target="_blank">&#9654; Demo Video (Bilibili)</a>
              <a href="https://bbs.robomaster.com/article/803685?source=8" target="_blank">&#128214; Open-Source Mechanical Release</a>
```

Both `href` values stay exactly as in the original, ampersands included.

**§ Engineer subsystems (lines 173–225)**

```html
        <div class="subsystem-label">Key Subsystems / Modules</div>
```

Arm card — `alt="机械臂"` → `alt="Six-axis arm"`, `alt="机械臂L3"` → `alt="Arm L3"`, `alt="机械臂L4"` → `alt="Arm L4"`:

```html
            <div class="subsystem-header">Six-Axis Arm Wrist Assembly</div>
            <ul class="subsystem-list">
              <li>The wrist packages an HB80 bellows suction cup, a drive wheel, the J5/J6 drivetrain and a stable air path</li>
              <li>A nested electrical slip ring and hollow rotary union at J4 pass power and air through unlimited rotation</li>
              <li>A U-joint driveshaft with the motor moved back onto L4 shrinks the wrist enough to work inside an ore slot</li>
              <li>Constant-velocity timing pulleys, gear sets and bevel gears drive J5/J6, holding wrist orientation accurate</li>
            </ul>
```

Pump card (`alt="改装气泵"` → `alt="Converted vacuum pump"`):

```html
            <div class="subsystem-header">3508-Converted Vacuum Pump</div>
            <ul class="subsystem-list">
              <li>Replacing the original brushed pump with a 3508 brushless motor removed the supply-current spike and raised the flow ceiling</li>
              <li>Holds <strong>−85&nbsp;kPa</strong> of vacuum and exceeds <strong>40&nbsp;L/min</strong> at 5000&nbsp;rpm</li>
              <li>The complete pump weighs <strong>&lt;300&nbsp;g</strong>, leaving more mass and inertia budget at the end of the arm</li>
              <li>Motor current feedback reads the suction state, giving reliable pickup and early warning of a dropped ore</li>
            </ul>
```

Swerve card (`alt="工程舵轮组"` → `alt="Engineer swerve module"`):

```html
            <div class="subsystem-header">Engineer Swerve Module</div>
            <ul class="subsystem-list">
              <li>Five-inch solid rubber tyres deliver the grip and wear life needed to break free on the field and return to supply quickly</li>
              <li>A custom 3508 gearbox, MGN7 rails and gas-spring under-module suspension carry high load without losing spin-mode stability</li>
              <li>The driver can reposition the chassis while operating the arm, which tightens the level-4 exchange rhythm</li>
              <li>Each module detaches on its own for between-match troubleshooting and swaps</li>
            </ul>
```

**§ Custom controller (lines 231–265)**

```html
        <div class="companion-label">Companion Teleoperation Terminal</div>
```

```html
            <h3><span class="icon">&#127918;</span>Custom Controller</h3>
            <div class="project-subtitle">Fitted to the operator <span class="sep">·</span> Isomorphic 6-axis mapping <span class="sep">·</span> Fast exchange loop</div>
```

`alt="自定义控制器 — 高精度遥操作终端"` → `alt="Custom controller — precision teleoperation terminal"`

```html
              <div class="highlight">&#127919; The Engineer robot's primary input device, with its linkage laid out around the operator's habits and arm measurements to support the 5.8&nbsp;s exchange routine.</div>
```

```html
                <h5>&#128075; Fitted to the Operator</h5>
                <ul>
                  <li>The controller's topology mirrors the main arm closely enough that the operator stops translating hand motion into robot pose</li>
                  <li>L2 was positioned from the operator's own arm measurements, giving a more natural posture and steadier control over a long match</li>
                  <li>During a level-4 exchange the operator switches elbow side one-handed without resetting posture, removing a costly motion under pressure</li>
                </ul>
```

```html
                <h5>&#9889; Structure for Fast Response</h5>
                <ul>
                  <li>Desk-scale and low in moving inertia, so the arm tracks the operator's hand closely</li>
                  <li>CNC for the load-bearing parts, 3D printing for the shell and brackets, which made iterating on operator feedback quick</li>
                  <li>Tuned alongside FPV framing, the wrist and the exchange routine as one continuous operator loop</li>
                </ul>
```

```html
                <span class="tag">Mechanical Design</span><span class="tag">Human-Machine Interaction</span><span class="tag">Teleoperation</span>
```

**§ Hero 2024 (lines 275–310)**

```html
      <div class="system-group-title">RM 2024 Hero Robot System</div>
```

```html
            <h3><span class="icon">&#129302;</span>RoboMaster 2024 Hero Robot</h3>
            <div class="project-subtitle">Double-supported friction wheels <span class="sep">·</span> 42&nbsp;mm side feed <span class="sep">·</span> Adaptive suspension</div>
```

`alt="英雄机器人 — 2024赛季对轴摩擦轮发射系统"` → `alt="Hero robot — 2024 season double-supported friction-wheel launcher"`

```html
              <div class="highlight">&#127919; Sole mechanical designer of the RM2024 Hero robot — gimbal, launcher, 42&nbsp;mm side feed and adaptive suspension — filling a gap in the team's robot lineup.</div>
```

The double-supported explanation lands here, at first substantive mention:

```html
                <h5>&#127919; Consistency-Focused Launcher on Double-Supported Shafts</h5>
                <ul>
                  <li>Shifted from ballistic and pitch-angle modelling to closing the loop on prototype faults, iterating the structure against friction-wheel vibration, speed droop and projectiles leaving before matching wheel speed</li>
                  <li>Moving the friction wheels onto double-supported shafts — bearings at both ends rather than a single overhung mount — and adding a pre-acceleration wheel pair brought 10&nbsp;m dispersion under <strong>25×25&nbsp;cm</strong> with muzzle velocity holding to roughly <strong>±0.1&nbsp;m/s</strong></li>
                </ul>
```

```html
                <h5>&#127939; Adaptive Mecanum Suspension Chassis</h5>
                <ul>
                  <li>Four-wheel linked suspension shares contact pressure across the Mecanum wheels, improving omnidirectional mobility and attitude stability over rough terrain</li>
                  <li>Passed a <strong>30&nbsp;cm vertical drop</strong> impact test, confirming the chassis can take a hit</li>
                </ul>
```

```html
                <span class="tag">Mechanical Design</span><span class="tag">Precision</span>
```

**§ Hero subsystems (lines 318–344)**

```html
        <div class="subsystem-label">Key Subsystems / Modules</div>
```

`alt="大弹丸测供弹"` → `alt="42 mm side-feed ammunition system"`:

```html
            <div class="subsystem-header">42&nbsp;mm Side-Feed Ammunition System</div>
            <ul class="subsystem-list">
              <li>Built for the RM2024 Hero robot to feed golf-ball-sized 42&nbsp;mm projectiles continuously</li>
              <li>Refined from the team's existing side-feed design, prioritising reliability and jam risk over novelty</li>
              <li>Anti-jam geometry tuned around projectile size tolerance sustains a steady <strong>2&nbsp;Hz</strong> feed</li>
            </ul>
```

`alt="RM2024 英雄机器人自适应悬挂底盘"` → `alt="RM2024 Hero robot adaptive suspension chassis"`:

```html
            <div class="subsystem-header">Adaptive Suspension Chassis</div>
            <ul class="subsystem-list">
              <li>Four-wheel linked suspension built around Mecanum omnidirectional travel evens out contact pressure on uneven ground</li>
              <li>A wide track and preloaded compression springs damp the body roll that follows a 42&nbsp;mm shot</li>
              <li>Tested through ramp jumps, 15&nbsp;cm forward step descents and 8&nbsp;cm lateral step descents</li>
            </ul>
```

**§ Exoskeleton (lines 353–382)**

```html
        <h3><span class="icon">&#129470;</span>4-DOF Arm Exoskeleton (Course Project)</h3>
        <div class="project-subtitle">Wearable power assist <span class="sep">·</span> DH kinematic modelling <span class="sep">·</span> IMU tracking</div>
```

`alt="四轴手臂外骨骼 — 穿戴式动力辅助原型机"` → `alt="4-DOF arm exoskeleton — wearable power-assist prototype"`

```html
          <div class="highlight">&#129504; A 4-DOF lightweight exoskeleton prototype for upper-limb assistance and human-robot collaboration, validated through kinematic modelling and basic closed-loop control.</div>
```

```html
              <h5>&#128300; Matching Human Motion</h5>
              <ul>
                <li>Joint axes placed along the dominant degrees of freedom of the upper arm and elbow to minimise interference with the wearer</li>
                <li>Built the kinematic model from Denavit–Hartenberg (DH) parameters and verified workspace coverage in simulation</li>
              </ul>
```

```html
              <h5>&#127939; Tracking &amp; Assist Control</h5>
              <ul>
                <li>An IMU on the back of the hand predicts the intended direction of motion and drives the exoskeleton to follow</li>
                <li>Closed-loop motor control holds the pose and supplies assistive force in assist mode</li>
              </ul>
```

```html
            <span class="tag">Mechanical Design</span><span class="tag">Embedded Development</span>
```

**§ Pre-research (lines 391–466)**

```html
    <h2 class="section-title">&#128218; 2024-2025 Technical Pre-Research &amp; Module Development</h2>
```

Launcher module — `dual-stage` here means acceleration stages, distinct from `double-supported`:

```html
        <h4>&#128640; Launcher Pre-Research Iterations</h4>
        <p>From the single-stage RM2024 Hero launcher, through a dual-stage four-wheel prototype, to a dual-stage six-wheel direction.</p>
```

Image `alt` values: `alt="RM2024 英雄发机"` → `alt="RM2024 Hero launcher"`, `alt="双级四摩擦轮样机"` → `alt="Dual-stage four-wheel prototype"`, `alt="双级六摩擦轮方向"` → `alt="Dual-stage six-wheel direction"`. Captions:

```html
          <div class="launcher-caption">RM2024 Hero Launcher</div>
```
```html
          <div class="launcher-caption">Dual-Stage, Four Wheels</div>
```
```html
          <div class="launcher-caption">Dual-Stage, Six Wheels</div>
```

The three `onclick="openModal('...')" ` handlers keep their exact filenames.

```html
      <ul class="launcher-notes">
        <li>Continued multi-stage acceleration research on the back of the RM2024 Hero launcher experience</li>
        <li>The dual-stage four-wheel prototype showed wide left-right dispersion; a three-wheel attempt stabilised launch angle but could not hold muzzle velocity consistent</li>
        <li>Dual-stage six-wheel became the main development direction, aiming to hold both velocity consistency and dispersion</li>
      </ul>
```

Research card 01 — `alt="高负载工程舵轮方案"` → `alt="High-load Engineer swerve module"`, `alt="2025 英雄轻量化舵轮预研"` → `alt="2025 Hero lightweight swerve pre-research"`:

```html
        <h4>&#128736; Swerve Module Pre-Research</h4>
```
```html
        <ul>
          <li>The high-load design uses wide rubber tyres and gas-spring under-module suspension to meet the Engineer's needs for grip, damping and a steady chassis attitude</li>
          <li>The 2025 Hero study uses the 3508 motor body, gear drive, a photoelectric homing sensor, polyurethane wheels and over-module suspension to compress overall height</li>
          <li>The two branches test high-load stability and lightweight miniaturisation separately, against the space, load and mobility demands of different robot classes</li>
        </ul>
```

Research card 02 — `alt="大弹丸侧供弹"` → `alt="42 mm side-feed system"`, `alt="小弹丸中心供弹预研"` → `alt="17 mm centre-feed pre-research"`:

```html
        <h4>&#127922; Ammunition System Pre-Research</h4>
```
```html
        <ul>
          <li>The 42&nbsp;mm side feed serves the RM2024 Hero robot, optimised for continuous feeding of golf-ball-sized projectiles without jamming</li>
          <li>A first-pass 17&nbsp;mm centre feed explores multi-layer staging, a fairing, and shear protection as the leading design priority</li>
          <li>Mentored a junior member in optimising the 17&nbsp;mm side feed, raising feed rate from <strong>20&nbsp;Hz</strong> to close to <strong>30&nbsp;Hz</strong></li>
        </ul>
```

**§ Honours (lines 473–480)**

```html
    <h2 class="section-title">&#127891; Honours &amp; Awards</h2>
```
```html
      <h4><span class="dot"></span>Scholarships &amp; Academic Honours</h4>
      <ul class="honors-list">
        <li><strong>Scholarship:</strong> HKSAR Government Scholarship Fund – Talent Development Scholarship, 2024 &amp; 2025</li>
        <li><strong>Academic Honour:</strong> HKUST SENG Dean's List, Fall 2023</li>
      </ul>
```

`class="honors-card"` and `class="honors-list"` keep American spelling — selectors, not copy.

- [ ] **Step 4: Verify no Chinese characters remain outside the language link**

```powershell
Set-Location "D:\AI_playground\My-RM-Portfolio"
$hits = Select-String -Path docs\en.html -Pattern '[\u4e00-\u9fff]' | Where-Object { $_.Line -notmatch 'href="index\.html"' }
if ($hits) { Write-Output "FAIL — untranslated text:"; $hits | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } } else { Write-Output "OK: only the language link carries Chinese" }
```

Expected: `OK: only the language link carries Chinese`

The one permitted occurrence is `中文` in the switch link.

- [ ] **Step 5: Verify units are bound and WR is intact**

```powershell
$bad = Select-String -Path docs\en.html -Pattern '\d\s+(s|kg|mm|cm|Hz|kPa|rpm|g|L/min|m/s)\b' -AllMatches
if ($bad) { Write-Output "FAIL — unbound unit (use &nbsp;):"; $bad | ForEach-Object { "$($_.LineNumber): $($_.Line.Trim())" } } else { Write-Output "OK: all units bound with nbsp" }

$wr = (Select-String -Path docs\en.html -Pattern '\bWR\b' -AllMatches).Matches.Count
Write-Output "WR occurrences: $wr (expected 3)"
Select-String -Path docs\en.html -Pattern 'world record' -SimpleMatch
```

Expected: units OK, `WR occurrences: 3`, and the `world record` search printing nothing.

- [ ] **Step 6: Commit**

```powershell
git add docs/en.html
git commit -m @'
feat: 新增英文版作品集页面

docs/en.html，与中文版结构严格一致，共用 style.css 与 script.js。
'@
```

---

### Task 4: Add the language link to the Chinese page

Isolated into its own task and its own commit because it is the single line that touches the Chinese page. A reviewer can accept or reject it independently of the translation.

**Ordering note:** this runs *before* structural verification on purpose. `en.html` gains its language link in Task 3, taking it to 369 start tags while `index.html` is still at 367. Verifying before this task would fail by exactly those two tags. Both pages must carry the link before the skeletons can match.

**Files:**
- Modify: `docs/index.html:21` (insert after)

**Interfaces:**
- Consumes: `docs/en.html` existing (Task 3), so the link does not 404.
- Produces: bidirectional navigation, and matching tag counts (369 each) for Task 5.

- [ ] **Step 1: Insert the link**

In `docs/index.html`, immediately after line 21 (the `mailto:` anchor) and before the closing `</div>` of `.contact`, add:

```html
      <a href="en.html"><span class="icon">&#127760;</span>English</a>
```

Indentation matches the two anchors above it. No CSS needed — `.contact a` and `.icon` already style it.

The structure must mirror `en.html`'s link exactly — one `<a>` wrapping one `<span class="icon">`. A structural difference here shows up as a Task 5 failure.

- [ ] **Step 2: Verify the diff is exactly one line**

```powershell
Set-Location "D:\AI_playground\My-RM-Portfolio"
git diff --stat docs/index.html
git diff docs/index.html
```

Expected: `1 file changed, 1 insertion(+)` with zero deletions. Read the diff and confirm the only change is the added anchor.

- [ ] **Step 3: Verify both links resolve**

```powershell
Select-String -Path docs\index.html -Pattern 'href="en\.html"'
Select-String -Path docs\en.html -Pattern 'href="index\.html"'
Test-Path docs\en.html
```

Expected: one hit each, and `True`.

- [ ] **Step 4: Commit**

```powershell
git add docs/index.html
git commit -m @'
feat: 中文页添加英文版入口

侧边栏 contact 区新增一行，复用现有样式。
'@
```

---

### Task 5: Verify structural fidelity

The mechanical gate. Runs against both finished pages, catching anything Task 3 dropped by hand.

**Files:**
- Read only: `docs/index.html`, `docs/en.html`

**Interfaces:**
- Consumes: the two commands from Task 1, `en.html` from Task 3, the link from Task 4.
- Produces: a pass/fail signal. No artefacts.

- [ ] **Step 1: Diff the skeletons**

```powershell
Set-Location "D:\AI_playground\My-RM-Portfolio"
$SP = "D:\tmp\claude-1000\D--AI-playground-My-RM-Portfolio/a8f06bf1-96a6-4831-33fd-a58e8d5aaa8e/scratchpad"
python "$SP\skeldiff.py" docs\index.html docs\en.html
```

Expected: `OK: skeletons identical (369 start tags)`, exit 0.

369 = the original 367 plus the `<a>` and `<span>` of the language link, now present in both files.

The script normalises the two language-switch `href` values (`en.html` / `index.html`) to `LANGSWITCH`, so that intentional difference does not register. Any other difference is a defect: a dropped tag, a renamed class, a changed image, a lost `onclick`.

If it fails, fix `en.html` to match — never edit `index.html` to make the diff pass.

- [ ] **Step 2: Diff the bullet counts**

```powershell
python "$SP\bulletdiff.py" docs\index.html docs\en.html
```

Expected: `OK: 24 lists, all bullet counts match`, exit 0.

A mismatch means rule 5 was violated — bullets merged or dropped during translation. Restore the 1:1 correspondence.

- [ ] **Step 3: Confirm the Chinese page changed by exactly one line**

```powershell
git diff HEAD~1 --stat docs/index.html
```

Expected: `1 file changed, 1 insertion(+)` — the Task 4 anchor and nothing else.

- [ ] **Step 4: No commit unless fixes were needed**

Verification only. If Steps 1–2 required fixes to `en.html`:

```powershell
git add docs/en.html
git commit -m @'
fix: 修正英文页结构与中文版对齐
'@
```

---

### Task 6: Verify rendering across breakpoints

Structure being right does not mean the page looks right. This is the part that cannot be automated away.

**Files:**
- Read only: `docs/en.html`, `docs/index.html`
- Possibly modify: `docs/style.css` (the `html[lang="en"]` block only), `docs/en.html` (wording only)

**Interfaces:**
- Consumes: everything from Tasks 2–5.
- Produces: the final rendering fixes, if any.

- [ ] **Step 1: Open the English page at desktop width**

Load `docs/en.html` in a browser at ≥1101 px wide. A browser automation tool (Playwright MCP if connected, otherwise the `kimi-webbridge` skill) can drive this; a manual check is equally valid.

Inspect specifically:
- Sidebar name `CUI Chuhan` fits within the 280 px sidebar
- Every nav label sits on one line
- `.project-subtitle` three-part rows break sensibly, not orphaning a single word
- The three-column `.subsystem-grid` cards (~200 px each) have readable headers and bullets
- `.launcher-caption` under the three side-by-side images

- [ ] **Step 2: Check the mid breakpoint**

Resize to between 801 px and 1100 px. Here `--sidebar-width` drops to 240 px and `.subsystem-grid` becomes two columns.

Confirm nav labels still fit the narrower sidebar, and that the two-column subsystem cards reflow without overflow.

- [ ] **Step 3: Check mobile and exercise the JavaScript**

Resize to ≤800 px. The sidebar becomes a sticky top bar with a hamburger.

- Tap `#menuToggle` — the menu expands, showing subtitle, badge, contacts and nav
- Tap a nav item — the page scrolls smoothly to that section and the menu closes
- Scroll manually — the active nav item updates (scroll spy)
- Tap a gallery image — the modal opens; press Escape — it closes

This is the real test of the "`script.js` unchanged" claim. If scroll spy misbehaves, an `id` was altered in Task 3 — go fix `en.html`, not `script.js`.

- [ ] **Step 4: Compare side by side with the Chinese page**

Open `docs/index.html` at the same widths. Card heights, whitespace rhythm and colour should read as the same design. English text will run slightly longer — that is expected and fine. What is not fine: a visibly different visual density, or the Chinese page having changed in any way.

- [ ] **Step 5: Review typography with the design skill**

Invoke the `frontend-design` skill to assess the Latin typography: whether the line-heights genuinely read as equivalent density, whether `text-wrap: balance` is applied where it earns its place, and whether any unit escaped its `&nbsp;`.

- [ ] **Step 6: Apply fixes, if any**

Order of preference, per spec §6.4:
1. Adjust the `html[lang="en"]` block in `style.css`
2. Shorten the English wording

Never change DOM structure. Never touch the Chinese page.

After any fix, re-run the mechanical gate:

```powershell
$SP = "D:\tmp\claude-1000\D--AI-playground-My-RM-Portfolio/a8f06bf1-96a6-4831-33fd-a58e8d5aaa8e/scratchpad"
python "$SP\skeldiff.py" docs\index.html docs\en.html
python "$SP\bulletdiff.py" docs\index.html docs\en.html
```

Both must still report OK.

- [ ] **Step 7: Commit any fixes**

```powershell
git add docs/style.css docs/en.html
git commit -m @'
fix: 微调英文页排版细节
'@
```

If nothing needed fixing, skip the commit and say so in the completion report.

---

## Appendix A: Verification script sources

Recreate these in `$SP` only if they are missing. They are deliberately not committed — they are scaffolding, not product.

**`skeldiff.py`** — compares DOM skeletons, ignoring all text:

```python
#!/usr/bin/env python3
"""Compare the DOM skeleton of index.html and en.html."""
import difflib
import sys
from html.parser import HTMLParser

TRACKED = ("class", "id", "src", "href", "data-gallery", "onclick")
LANG_HREFS = {"en.html", "index.html"}


class Skeleton(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.rows = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        parts = [tag]
        for key in TRACKED:
            if key not in d:
                continue
            val = d[key]
            if key == "href" and val in LANG_HREFS:
                val = "LANGSWITCH"
            parts.append('%s="%s"' % (key, val))
        self.rows.append(" ".join(parts))


def skeleton(path):
    parser = Skeleton()
    with open(path, encoding="utf-8") as fh:
        parser.feed(fh.read())
    return parser.rows


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    left_path, right_path = sys.argv[1], sys.argv[2]
    left, right = skeleton(left_path), skeleton(right_path)
    diff = list(difflib.unified_diff(left, right, fromfile=left_path, tofile=right_path, lineterm=""))
    if not diff:
        print("OK: skeletons identical (%d start tags)" % len(left))
        return 0
    print("\n".join(diff))
    added = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    removed = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))
    print("\nFAIL: %d added, %d removed" % (added, removed))
    return 1


if __name__ == "__main__":
    sys.exit(main())
```

**`bulletdiff.py`** — compares `<li>` counts per `<ul>`:

```python
#!/usr/bin/env python3
"""Compare <li> counts per <ul> between index.html and en.html."""
import sys
from html.parser import HTMLParser


class Bullets(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.rows = []
        self.stack = []
        self.last_class = "?"

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if d.get("class"):
            self.last_class = d["class"]
        if tag == "ul":
            self.stack.append([d.get("class") or self.last_class, 0])
        elif tag == "li" and self.stack:
            self.stack[-1][1] += 1

    def handle_endtag(self, tag):
        if tag == "ul" and self.stack:
            cls, count = self.stack.pop()
            self.rows.append("ul[%s] li=%d" % (cls, count))


def bullets(path):
    parser = Bullets()
    with open(path, encoding="utf-8") as fh:
        parser.feed(fh.read())
    return parser.rows


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    left_path, right_path = sys.argv[1], sys.argv[2]
    left, right = bullets(left_path), bullets(right_path)
    if len(left) != len(right):
        print("FAIL: %s has %d <ul>, %s has %d" % (left_path, len(left), right_path, len(right)))
        return 1
    bad = 0
    for i, (a, b) in enumerate(zip(left, right)):
        if a.rsplit("li=", 1)[1] != b.rsplit("li=", 1)[1]:
            print("FAIL ul#%d: %s vs %s" % (i, a, b))
            bad += 1
    if bad:
        print("\n%d of %d lists differ" % (bad, len(left)))
        return 1
    print("OK: %d lists, all bullet counts match" % len(left))
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

---

## Appendix B: Deployment

Not part of this plan's tasks. When the work is reviewed and the user chooses to publish:

```powershell
git push origin main
```

GitHub Pages redeploys in 1–2 minutes. The English page will be live at
`https://ccuiab.github.io/My-RM-Portfolio/en.html`.

Do not push without the user asking.
