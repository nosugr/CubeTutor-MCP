# CubeTutor

<div align="center">

![React 19](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-0.170-black?logo=threedotjs)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)
![MCP](https://img.shields.io/badge/Protocol-MCP%20Standard-8a2be2)
![Tests](https://img.shields.io/badge/Pytest-41%2F41%20Passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**基于 MCP 协议与多模态大模型的智能魔方教学与交互系统**

[快速开始](#快速开始) • [核心特性](#核心特性) • [系统架构](#系统架构) • [MCP 工具规范](#mcp-协议工具集) • [演示文档](./docs/screenshot/demo.md)

</div>

---

## 项目简介

**CubeTutor** 是一个融合 3D 物理渲染、计算机视觉识别、阶梯式数学求解算法与 **Anthropic MCP (Model Context Protocol)** 开放协议的现代化智能魔方教学平台。

通过将底层魔方状态机与求解算法封装为标准 MCP 工具，系统能够与大语言模型（LLM）实现双向交互，为儿童益智与魔方初学者提供具备“**物理状态感知、大白话分步教学、空间姿态归一化、Emotion Ball 拟人情绪伴学、智能语音伴读**”能力的智能魔方私教体验。

---

## 系统架构

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   前端交互层 (React 19 + Three.js)                     │
│  - 3D 虚拟魔方渲染与手势物理交互 (src/cuber)                           │
│  - Emotion Ball 情绪球 32 套表情物理伴学 Avatar (src/avatar)           │
│  - 右侧抽屉式「魔方助手」交互面板 (拖拽调宽 / 历史持久化 / src/components) │
│  - 摄像头视频流实时扫面采集 (src/cv/scanner.ts)                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP REST / SSE 流式 / JSON-RPC
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   后端服务层 (Python FastAPI :8000)                    │
│  - API 路由控制器 (server/api/)                                        │
│  - 54 格状态单例、24 姿态中心归一化与数学群论校验 (server/core/)        │
│  - 按 6 大中心块颜色索引的 3x3 真实九格解析器 (format_cube_layout_cn)   │
│  - YOLOv8 目标检测与色彩空间自适应采样 (server/cv/)                    │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌───────────────────────────────────────┐   ┌────────────────────────────┐
│          三大阶梯求解器体系           │   │    AI Agent 与 MCP 协议    │
│  - 新手层先法 (7 阶段人类分步教学引擎)│   │  - 标准 MCP Server 服务端  │
│  - CFOP 进阶法 (4 阶段速拧算法引擎)   │   │  - 4 项核心工具标准暴露    │
│  - Kociemba 最优解 (20 步极速二阶段)  │   │  - 4 阶段聚合调用轨迹展示  │
└───────────────────────────────────────┘   └────────────────────────────┘
```

---

## 核心特性

- **标准 MCP 协议集成**：原生实现 Model Context Protocol (MCP) Server，提供 4 项标准化魔方操作工具，支持大语言模型通过 JSON-RPC 直接调度、沙盒推演与分步启发式教学。
- **儿童益智与初学友好大白话教学**：
  - 严格以 6 处固定中心块颜色（顶白 U、底黄 D、正绿 F、背蓝 B、左橙 L、右红 R）为基准坐标系；
  - 将专业 WCA 转动代号（如 `R U R' U'`）100% 翻译为直观的“大白话动作 + 颜色方位”（如：“右侧红色面向上推一步 `R`，顶层白色面向左拨一步 `U`”）；
  - 具备 3×3 真实九格颜色分布解析器，杜绝大模型混淆颜色中心面。
- **空间旋转群动态中心归一化（Dynamic Center Normalization）**：
  - 算法层支持三维空间旋转群 $SO(3)$ 对应的 **24 种合法空间物理朝向**；
  - 无论用户在 3D 舞台中如何整体翻转魔方视角，求解器均能动态识别中心块朝向并瞬间归一化，彻底根除翻转魔方后的校验报错。
- **Emotion Ball 拟人情绪球伴学系统**：
  - 接入完整 32 套表情物理引擎，支持视线追踪、撒花庆祝（`33` 号任务完成）、好奇大圆眼（`03` 号思考中）与警示报警（`34` 号报错）。
- **原生 Web Speech API 智能语音伴读**：
  - 浏览器原生 `window.speechSynthesis` 引擎，中文语调亲切自然，智能过滤 Markdown 语法符号；
  - 默认静音保护，每条回答气泡附带独立语音播放按钮，支持随点随播与声波跳动动效。
- **主流 Agent 风格的 4 阶段聚合调用轨迹**：
  - 智能折叠聚合连续推演步数，清晰展示 `get_cube_state`、`validate_state`、`get_solution` 与 `apply_move (执行推演 ×N 步)`。
- **Cherry Studio 级多服务商配置中心**：
  - 原生支持 DeepSeek、通义千问、OpenRouter、OpenAI、硅基流动、Moonshot、Ollama 等；
  - 内置一键获取模型列表与实时连接测试。
- **阶梯式三大求解体系**：
  - 新手层先法 (Beginner)：7 个分步教学阶段（小黄花 → 底十字 → 底角 → 中棱 → 顶十字 → 顶面 → 顶角顶棱）；
  - CFOP 进阶法 (CFOP)：Cross 底十字、F2L 前两层、OLL 顶面朝向与 PLL 顶面置换 4 大速拧阶段；
  - Kociemba 最优解：二阶段群论搜索算法，在 20~22 步内极速给出理论最短复原路径。
- **YOLOv8 视觉识别与同步**：通过摄像头捕获物理魔方表面，结合目标检测与 OpenCV 色彩空间自适应采样，一键将物理状态映射到 3D 虚拟场景。

---

## MCP 协议工具集

CubeTutor 后端内置的 MCP Server 暴露了 4 个符合 [Model Context Protocol](https://modelcontextprotocol.io/) 规范的标准工具：

| 工具名称 (Tool Name) | 参数 (Arguments) | 功能描述 (Description) |
| :--- | :--- | :--- |
| `get_cube_state` | 无 | 获取当前魔方的 54 格标准 Facelet 颜色序列与复原状态 |
| `validate_state` | `facelets?: string` | 校验魔方在群论约束下的物理合法性（朝向与置换奇偶性） |
| `get_solution` | `method: "beginner" \| "cfop" \| "kociemba"` | 调用指定算法求解，返回结构化动作与阶段教学说明 |
| `apply_move` | `move: string, facelets?: string` | 在服务端执行步序旋转，支持会话变更与无状态沙盒推演 |

---

## 快速开始

### 环境要求
- Node.js >= 18.0
- Python >= 3.10

### 方式一：一键启动 (Windows)
直接双击根目录下的 [`start.bat`](./start.bat)，脚本将在单终端内同时拉起前后端服务，并自动打开浏览器访问 `http://localhost:5173/`。

### 方式二：手动分步启动

```bash
# 1. 安装前端与后端依赖
npm install
pip install -r requirements.txt

# 2. 启动后端服务 (端口 8000)
uvicorn --app-dir server api.http_app:app --port 8000 --host 127.0.0.1

# 3. 启动前端开发服务器 (端口 5173)
npm run dev
```

---

## 自动化测试与类型检查

项目内置 41 项自动化单元测试与端到端测试，覆盖状态机矩阵、三大求解器逻辑、数学合法性校验、流式对话与 MCP 工具链：

```bash
# 运行后端测试套件
pytest server/tests

# 运行前端 TypeScript 检查
npx tsc --noEmit
```

**测试结果**：`41 passed (100% 全部通过)`，TypeScript `0 错误 0 告警`。

---

## 项目目录结构

```text
CubeTutor/
├── start.bat               # Windows 一键极速启动脚本
├── package.json            # 前端工程配置与依赖
├── requirements.txt        # 后端全量 Python 依赖清单
├── vite.config.ts          # Vite 构建配置
├── index.html              # 前端 SPA 页面入口
│
├── src/                    # 🖥️ 前端 React 19 + Three.js 源码
│   ├── avatar/             # Emotion Ball 情绪球 Avatar 组件与 32 套表情物理引擎
│   ├── components/         # ChatPanel 智能教学助手面板 (包含 MCP 调用轨迹与模型设置)
│   ├── cuber/              # 3D 魔方物理模型与渲染管线
│   ├── cv/                 # 摄像头视频流扫面驱动 (scanner.ts)
│   ├── solver/             # 前端离线备用求解器
│   ├── data.ts / index.css # 状态数据模型与现代化玻璃拟态样式
│   └── index.tsx           # 前端总工作台与主控制器
│
├── server/                 # ⚡ 统一 Python 后端大脑
│   ├── core/               # 54 格状态、置换表、24姿态归一化、九格解析与单例会话
│   ├── solvers/            # 三大求解算法包 (beginner / cfop / kociemba)
│   ├── cv/                 # 视觉识别模块 (YOLOv8 + OpenCV 采样)
│   ├── agent/              # MCP Server 协议实现、In-Process Client、Agent 调度与 LLM 客户端
│   ├── api/                # FastAPI 路由控制器 (http_app, routes_state, routes_solve, routes_detect)
│   └── tests/              # 41 项自动化单元与端到端测试套件
│
└── docs/                   # 📚 项目文档与技术规范体系
    ├── screenshot/         # 功能演示动图与 demo.md
    └── superpowers/        # 模块任务书、进展书与 specs/plans 规范
```

---

## 开源许可证

本项目基于 [MIT License](./LICENSE) 协议发布。
