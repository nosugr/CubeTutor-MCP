# CubeTutor（基于 MCP 的魔方教学助手）Implementation Plan

> **状态：已完成（P0）** · 实施约 2026-08-22  
> **结构说明：** 下文「文件结构」与各 Task 的 Create/Modify 路径是**实施当时的扁平布局快照**。2026-08-23 起后端已重组为 `core/` · `solvers/` · `agent/` · `api/`，依赖迁至根目录 `requirements.txt`。  
> **当前目录树、启动命令、MCP 入口以仓库根 `README.md` 为准**；本文件仅作施工过程与验收勾选记录，不再作为路径权威。

> Steps use checkbox (`- [ ]` / `- [x]`) syntax for tracking.

**Goal:** 交付可演示的 3D 魔方工作台：随机打乱或六面拍照+点色同步、三种还原规则、MCP Agent 指挥逐步还原、文字/可选语音单向讲解、带播放控制的自动演示。

**Architecture:** 浏览器负责 Three.js 仿真与交互；Python 负责 facelet 状态、合法校验、三种出步骤器、MCP 四工具、Agent 写讲解与 TTS 适配。前后端以「54 格 facelet 串 + 统一步骤列表」为契约；Agent 在服务端调 MCP 工具，前端只消费状态增量与讲解。

**Tech Stack:** Three.js（CDN 即可）、Python 3.11+、`RubikTwoPhase`（Kociemba）、MCP Python SDK、可切换 LLM/TTS（OpenAI 兼容接口优先）、pytest。

**项目根目录:** `D:\桌面\实习\基于MCP的智能魔方项目\CubeTutor\`（以下路径均相对此根）  
**Spec:** `docs/superpowers/specs/2026-08-22-cubetutor-design.md`

---

## 文件结构（实施当时 · 历史快照）

```
基于MCP的智能魔方项目/
  cube-demo.html              # 旧预览，留在上一级；3D 迁入 web/ 后再删
  大模型…任务书.pdf
  CubeTutor/                  # ← 英文项目根（git 也建在这里）
    .gitignore                # venv、__pycache__、.env、Kociemba 表目录等
    README.md
    web/
      index.html              # 工作台单页
      css/workbench.css
      js/
        main.js               # 启动、UI 绑定
        cube3d.js             # Three.js 魔方与层转动画
        keyboard.js           # UDLRFB / Shift
        capture.js            # 六面上传、取色、点色修正
        player.js             # 播放/暂停/步进/速度
        api.js                # 调后端 HTTP
    server/
      requirements.txt
      cubetutor/
        __init__.py
        state.py              # facelet 模型、apply_move
        validate.py           # 合法状态
        moves.py              # 公式解析 U/R/F… 与 U' U2
        solution.py           # Step / Solution 统一结构
        solvers/
          base.py             # Solver 协议：solve(facelets)->Solution
          beginner.py         # 层先法
          cfop.py             # 课程范围 CFOP（见 Task 5 边界）
          kociemba_solver.py  # 调 RubikTwoPhase
        mcp_server.py         # 四个 MCP tools
        agent.py              # 工具循环 + 讲解生成
        tts.py                # TTS 适配（可 no-op）
        http_app.py           # 给前端的薄 HTTP
        config.py             # 模型/TTS 厂家与 key，不写死
      tests/
        test_state.py
        test_validate.py
        test_beginner.py
        test_cfop.py
        test_kociemba.py
        test_mcp_tools.py
        test_agent_fallback.py
    docs/superpowers/
      specs/2026-08-22-cubetutor-design.md
      plans/2026-08-22-cubetutor.md
```

**统一数据契约**

- 状态：`str` 长度 54，字符属于 `URFDLB`，布局与 Kociemba facelet 一致。  
- 一步：`{ "move": "R", "stage": "f2l", "narration": "..." }`  
- 一解：`{ "method": "beginner"|"cfop"|"kociemba", "steps": Step[] }`

---

### Task 1: 仓库骨架与依赖

**Files:**
- Create: `.gitignore`
- Create: `server/requirements.txt`
- Create: `server/cubetutor/__init__.py`
- Create: `server/cubetutor/config.py`
- Create: `web/index.html`（占位标题即可）
- Create: `README.md`（如何装依赖、起服务、开页面，三行级）

- [x] **Step 1: 在 CubeTutor/ 初始化 git（若尚无）**
  - 思路：仓库根是 `CubeTutor/`，不是上一级「基于MCP的智能魔方项目」。后续每任务在此 commit。
  - 验证：在 `CubeTutor/` 下 `git status` 可用。

- [x] **Step 2: 写入 `.gitignore`**
  - 思路：忽略 `__pycache__/`、`.venv/`/`venv/`、`.env`、`.idea/`、`*.pyc`、Kociemba 表缓存目录（如 `server/.twophase_cache/`）、系统垃圾 `.DS_Store`/`Thumbs.db`。不忽略 `docs/`。
  - 验证：故意建一个 `.env` 后 `git status` 不出现它。

- [x] **Step 3: 写入 Python 依赖清单**
  - 思路：先列 `pytest`、`RubikTwoPhase`、`mcp`、一个 ASGI/HTTP 小框架（`fastapi`+`uvicorn`）、`httpx`（测 HTTP）、`pydantic`（若 FastAPI 需要）。TTS/LLM SDK 先不锁死厂家，用 `httpx` 打 OpenAI 兼容端点。
  - 验证：`pip install -r server/requirements.txt` 成功。（依赖清单已写；venv 安装可后续做）

- [x] **Step 4: `config.py` 只读环境变量**
  - 思路：`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` / `TTS_BASE_URL` / `TTS_API_KEY`；缺 key 时 Agent 走模板讲解降级，不崩。
  - 验证：无环境变量时 import config 不抛错。

- [x] **Step 5: Commit**
  - `git add … && git commit -m "chore: CubeTutor skeleton and deps"`

---

### Task 2: facelet 状态与转动

**Files:**
- Create: `server/cubetutor/moves.py`
- Create: `server/cubetutor/state.py`
- Create: `server/tests/test_state.py`

- [x] **Step 1: 写失败测试 — 还原态与单步转动**
  - 测：`SOLVED = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"`；`apply_move(SOLVED,"R")` 后再 `apply_move(...,"R'")` 回到 SOLVED；`R2` 两次回 SOLVED。
  - 验证：`pytest server/tests/test_state.py` 失败（未实现）。

- [x] **Step 2: 实现 moves/state**
  - 思路：硬编码 54 格在每种基本面转动下的置换表（或由角块/棱块模型推导，二选一，选更短的）；`parse_move` 接受 `U/U'/U2/R…`。非法 move 抛 `ValueError`。
  - 验证：上述测试通过；再加一条乱序字符串长度≠54 抛错。

- [x] **Step 3: Commit**
  - `git commit -m "feat: facelet state and apply_move"`

---

### Task 3: 合法状态校验

**Files:**
- Create: `server/cubetutor/validate.py`
- Create: `server/tests/test_validate.py`

- [x] **Step 1: 写失败测试**
  - 测：SOLVED → ok；把两个角块色对调造成的非法串 → not ok；缺色（某色不是 9 格）→ not ok。
  - 验证：pytest 失败。

- [x] **Step 2: 实现校验**
  - 思路：先查每种颜色恰好 9；再转成角/棱朝向与置换，检查：角朝向和 %3==0、棱朝向和 %2==0、角置换与棱置换奇偶相同。错误返回结构化原因码（如 `corner_orientation`），给前端提示用。
  - 验证：测试通过。

- [x] **Step 3: Commit**
  - `git commit -m "feat: cube state validation"`

---

### Task 4: 统一 Solution 结构 + 新手层先法求解器

**Files:**
- Create: `server/cubetutor/solution.py`
- Create: `server/cubetutor/solvers/base.py`
- Create: `server/cubetutor/solvers/beginner.py`
- Create: `server/tests/test_beginner.py`

- [x] **Step 1: 定义数据结构**
  - 思路：`Step(move, stage, narration_key)`；`Solution(method, steps)`；`narration_key` 先当稳定键，Agent/模板再渲成人话，避免求解器里塞长中文。

- [x] **Step 2: 写失败测试 — 随机拧乱再还原**
  - 测：对 SOLVED 施加固定公式打乱 → `beginner.solve` 返回步骤 → 逐步 `apply_move` 后等于 SOLVED。至少 3 组打乱序列。
  - 验证：pytest 失败。

- [x] **Step 3: 实现层先法**
  - 思路：阶段 `cross → first_layer_corners → second_layer → last_layer_cross → last_layer_corners_orient → last_layer_corners_perm → last_layer_edges`（经典七步可合并，但 stage 名要稳定）。每阶段查表/搜索短序列；不追求步数最优，只求总能还原。
  - 验证：测试通过；已还原态返回空 steps。

- [x] **Step 4: Commit**
  - `git commit -m "feat: beginner layer-by-layer solver"`

---

### Task 5: CFOP 求解器（课程范围，必须总能还原）

**Files:**
- Create: `server/cubetutor/solvers/cfop.py`
- Create: `server/tests/test_cfop.py`

**边界（写进代码注释 `ponytail:`）：** 不做完整 57 OLL / 21 PLL。用 **2-look OLL + 2-look PLL**（或等价的「总能还原」公式子集），阶段名仍用 `cross/f2l/oll/pll`，答辩叙事仍是 CFOP。F2L 可用「槽位插入」搜索，不必 41 公式背完。

- [x] **Step 1: 写失败测试**
  - 同 Task4：多组打乱 → solve → 回 SOLVED；并断言 steps 里出现的 `stage` 集合 ⊆ `{cross,f2l,oll,pll}`。
  - 验证：pytest 失败。

- [x] **Step 2: 实现 CFOP（课程子集）**
  - 思路：Cross → 四槽 F2L → 2-look OLL → 2-look PLL；公式表单独常量区，便于以后加全。
  - 验证：测试通过。

- [x] **Step 3: Commit**
  - `git commit -m "feat: course-scope CFOP solver"`

---

### Task 6: Kociemba 求解器

**Files:**
- Create: `server/cubetutor/solvers/kociemba_solver.py`
- Create: `server/tests/test_kociemba.py`

- [x] **Step 1: 写失败测试**
  - 测：固定打乱串（可用 RubikTwoPhase 文档示例）→ 步骤逐步执行回 SOLVED；`method=="kociemba"`。
  - 验证：首次跑可能因生成表变慢——测试里允许较长 timeout，表生成放在第一次调用并缓存到本地目录（gitignore）。

- [x] **Step 2: 封装 `RubikTwoPhase`**
  - 思路：facelet 串直接交给 `twophase.solver.solve`；解析返回公式为 Step 列表；`stage` 统一标 `kociemba`；超时/失败抛明确错误。
  - 验证：测试通过。

- [x] **Step 3: Commit**
  - `git commit -m "feat: Kociemba solver wrapper"`

---

### Task 7: 求解器注册表

**Files:**
- Create: `server/cubetutor/solvers/__init__.py`
- Modify: 各 solver 若需
- Create: `server/tests/test_solvers_registry.py`

- [x] **Step 1: `get_solver(name) -> Solver`**
  - 思路：`beginner|cfop|kociemba` 映射；未知名抛清晰错误。`solve_all` 不需要。
  - 验证：三个名字都能 `solve(打乱)` 回 SOLVED。

- [x] **Step 2: Commit**
  - `git commit -m "feat: solver registry"`

---

### Task 8: MCP 四个工具

**Files:**
- Create: `server/cubetutor/mcp_server.py`
- Create: `server/tests/test_mcp_tools.py`

- [x] **Step 1: 进程内「当前立方」会话对象**
  - 思路：`CubeSession` 持有 facelets；工具读写它。单用户 Demo 足够；不搞多租户。

- [x] **Step 2: 实现四工具（可先纯函数测，再挂 MCP）**
  - `get_cube_state` → 当前 54 串  
  - `validate_state` → `{ok, reason?}`（可对参数串或当前串）  
  - `get_solution(method)` → Solution JSON  
  - `apply_move(move)` → 新状态  
  - 验证：pytest 直接调函数：打乱→get_solution→逐 apply→SOLVED。

- [x] **Step 3: 挂 MCP Server 入口**
  - 思路：用官方 MCP Python SDK 暴露同名 tool；`python -m cubetutor.mcp_server` 可启动。HTTP 路径给前端用另见 Task 9，避免前端必须讲 MCP 协议。
  - 验证：工具列表能列到四个名字（按 SDK 惯用检查方式）。

- [x] **Step 4: Commit**
  - `git commit -m "feat: MCP tools for cube session"`

---

### Task 9: 给前端的薄 HTTP API

**Files:**
- Create: `server/cubetutor/http_app.py`
- Create: `server/tests/test_http_app.py`

- [x] **Step 1: 路由（只这些）**
  - `GET /api/health`
  - `POST /api/state` body:`{facelets}` → validate + 写入 session
  - `GET /api/state`
  - `POST /api/scramble` body 可选:`{n}`（默认约 25）→ 从当前或 SOLVED 起施加 n 个随机合法招，写回 session，返回 `{facelets, moves[]}`（moves 供前端播打乱动画）
  - `POST /api/solve` body:`{method}` → 返回 Solution（先不算 Agent，纯求解，便于前端播）
  - `POST /api/move` body:`{move}`
  - `CORS` 放开本机。
  - 验证：httpx 测同步非法串返回 400；scramble 后 `validate` 为 ok；再 solve 得 steps。

- [x] **Step 2: Commit**
  - `git commit -m "feat: HTTP API for workbench"`

---

### Task 10: 前端 3D + 键盘（从 cube-demo 演进）

**Files:**
- Create: `web/js/cube3d.js`
- Create: `web/js/keyboard.js`
- Create: `web/js/main.js`
- Create: `web/css/workbench.css`
- Modify: `web/index.html`
- Delete（本任务末可选）: `cube-demo.html`

- [x] **Step 1: 把临时 demo 迁成模块**
  - 思路：27 小方块 + OrbitControls；增加按层转动动画队列；对外 `setFacelets(str)` / `playMove(move)`。
  - 验证：浏览器打开 `web/index.html`（或由 uvicorn 静态挂载）可拖拽旋转。

- [x] **Step 2: 键盘**
  - 思路：`u/d/l/r/f/b`（大小写不敏感）拧 90°；`Shift` 反向；动画进行中把键入排队。本地先只改 3D，可选同步 `POST /api/move`。
  - 验证：手按键层会转；`R` 再 `Shift+R` 视觉回原。

- [x] **Step 3: 「随机打乱」按钮**
  - 思路：3D 旁放按钮；点击则若播放器在跑先 pause；`POST /api/scramble` → 用返回的 `moves[]` 在 3D 排队播放 → 结束时 `setFacelets` 与后端一致。不上传照片也可进入后续还原。
  - 验证：连续点两次打乱，魔方外观变化且之后能 `solve` 还原。

- [x] **Step 4: Commit**
  - `git commit -m "feat: 3D workbench, keyboard, and scramble"`

---

### Task 11: 六面拍照 + 点色修正 + 同步

**Files:**
- Create: `web/js/capture.js`
- Modify: `web/index.html`、`web/css/workbench.css`、`web/js/main.js`

- [x] **Step 1: UI**
  - 思路：六个上传槽（U/R/F/D/L/B）；每面 3×3 可点击循环改色；「识别」对每张图在九宫位置采样平均色并映射到最近的六色（阈值/距离）；不引入 OpenCV。
  - 验证：无照片时可手点 54 格涂成任意状态。

- [x] **Step 2: 同步**
  - 思路：点「同步到魔方」→ `POST /api/state`；400 则展示 `reason`；200 则 `cube3d.setFacelets`。
  - 验证：故意涂非法色 → 提示且 3D 不更新；合法 → 3D 一致。

- [x] **Step 3: Commit**
  - `git commit -m "feat: six-face capture and color fix sync"`

---

### Task 12: 播放器接 Solution

**Files:**
- Create: `web/js/player.js`
- Modify: `web/js/main.js`、`web/index.html`

- [x] **Step 1: 播放器状态机**
  - 思路：持有 `steps[]`、`index`；`play/pause/next/prev/setSpeed`；`next` 调 `cube3d.playMove`；`prev` 通过逆招（`R↔R'`,`R2↔R2`）回退并保持 index 一致。
  - 验证：选 beginner，点求解，自动播完到还原；暂停/单步/加速可用。

- [x] **Step 2: 规则下拉 +「开始还原」**
  - 思路：先走纯 `POST /api/solve`（不经过 Agent），保证演示链路不依赖 LLM。
  - 验证：三种 method 都能播完（kociemba 首次慢可接受）。

- [x] **Step 3: Commit**
  - `git commit -m "feat: solution player with transport controls"`

---

### Task 13: Agent 讲解（MCP 工具循环）+ 降级

**Files:**
- Create: `server/cubetutor/agent.py`
- Create: `server/tests/test_agent_fallback.py`
- Modify: `server/cubetutor/http_app.py`（增加会话接口）

- [x] **Step 1: 模板降级讲解**
  - 思路：无 API key 时，用 `narration_key`+`move`+`stage` 拼中文模板（如「CFOP·F2L：执行 R」）。测试：关掉 key，仍返回逐步 `narration` 非空。

- [x] **Step 2: Agent 循环（有 key 时）**
  - 思路：服务端 Agent：`get_cube_state` → `validate_state` → `get_solution(method)` → 对每步可调用 LLM「根据 stage/move 写一句短中文讲解」（也可整表一次生成）；再逐步 `apply_move` 与前端推送。厂家走 `config` 的 OpenAI 兼容 Chat Completions；**工具调用也可用同一 SDK 风格**，但 Demo 允许「求解仍用本地 solver，LLM 只写讲解」以省费用与不稳定性——仍满足「Agent 经 MCP 读状态/取解/执行」：强制 Agent 路径必须实际调用四工具（单测里用假 LLM + 真工具断言调用次数）。
  - 验证：`test_agent_fallback` 覆盖无 key；另测 mock LLM 时四工具均被调用。

- [x] **Step 3: HTTP `POST /api/solve_with_agent`**
  - 思路：返回带 `narration` 的 steps；前端播放器显示文字。旧 `/api/solve` 保留作无 LLM 通道。
  - 验证：手动打一次本地请求看 JSON。

- [x] **Step 4: Commit**
  - `git commit -m "feat: agent narrations via MCP tools with fallback"`

---

### Task 14: TTS 开关（可 no-op）

**Files:**
- Create: `server/cubetutor/tts.py`
- Modify: `server/cubetutor/http_app.py`、`web/js/player.js`、`web/index.html`

- [x] **Step 1: `tts.synthesize(text) -> bytes | None`**
  - 思路：无配置返回 `None`；有配置打兼容 TTS HTTP，返回音频。`GET /api/tts?text=` 或 POST。
  - 验证：无配置时接口 204/空；前端开关开着也不报错。

- [x] **Step 2: 前端语音开关**
  - 思路：每步 narration 变化时若开关开且有音频则播；默认关。
  - 验证：无 TTS 时仅文字；有 key 时能出声（人工听）。

- [x] **Step 3: Commit**
  - `git commit -m "feat: optional TTS adapter"`

---

### Task 15: 端到端打磨与 README

**Files:**
- Modify: `README.md`
- Modify: 按需修 UI 文案
- Modify: `docs/superpowers/specs/2026-08-22-cubetutor-design.md`（状态改为已批准并链到本计划）

- [x] **Step 1: 静态挂载与一键启动说明**
  - 思路：uvicorn 同时挂 `/` → `web/`；README 写：`pip install`、`uvicorn cubetutor.http_app:app`、浏览器打开、可选环境变量。
  - 验证：按 README 冷启动能走完：随机打乱 → 三规则各还原一次；再试点色同步；播放器控制；无 key 下降级讲解。

- [x] **Step 2: 对照 spec 成功标准勾验**
  - 键盘拧、随机打乱免拍照、六面+修正+非法拦截、三规则自动演示、MCP 四工具路径、文字默认/语音可选、LLM/TTS 挂掉不白屏。
  - 验证：全部满足才标 Done。

- [x] **Step 3: Commit**
  - `git commit -m "docs: README and P0 acceptance notes"`

---

## Spec 自检（写计划时已核对）

| Spec 需求 | 对应 Task |
|-----------|-----------|
| 3D + 键盘 + 随机打乱 | 9（`/api/scramble`）, 10 |
| 六面拍照+点色+合法校验 | 3, 11 |
| 新手 / CFOP / Kociemba | 4, 5, 6, 7 |
| 自动演示+播放控制 | 12 |
| 单向文字+可选语音 | 13, 14 |
| MCP 四工具 + Agent | 8, 13 |
| 厂家可切换 / 降级 | 1, 13, 14 |
| `.gitignore` + git 根在 CubeTutor | 1 |
| 总览页延后 | 未列入（正确） |

**刻意不做：** 完整 OLL/PLL 全集、对话追问、蓝牙、总览页、重型 CV。

---

## 风险与顺序说明

1. **Kociemba 首次生成表慢** — 接受；表目录加入 `.gitignore`。  
2. **CFOP 公式量大** — 已用 2-look 边界锁死，避免做不完。  
3. **拍照识别不准** — 强制点色修正；识别只是加速。  
4. **先 Task12 再 Task13** — 保证无 LLM 也能演示，答辩现场更稳。
