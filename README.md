# CubeTutor

<div align="center">

![React 19](https://img.shields.io/badge/React-19.0.0-61dafb?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)
![Three.js](https://img.shields.io/badge/Three.js-0.170-black?logo=threedotjs)
![Python](https://img.shields.io/badge/Python-3.10%2B-3776ab?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-009688?logo=fastapi&logoColor=white)
![MCP](https://img.shields.io/badge/Protocol-MCP%20Standard-8a2be2)
![Tests](https://img.shields.io/badge/Pytest-39%2F39%20Passing-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

**基于 MCP 协议与多模态大模型的智能魔方教学与交互系统**

[快速开始](#快速开始) • [核心特性](#核心特性) • [系统架构](#系统架构) • [MCP 工具规范](#mcp-协议工具集) • [演示文档](./docs/screenshot/demo.md)

</div>

---

## 项目简介

**CubeTutor** 是一个融合 3D 物理渲染、计算机视觉识别、阶梯式数学求解算法与 **Anthropic MCP (Model Context Protocol)** 开放协议的现代化魔方教学平台。

通过将底层魔方状态机与求解算法封装为标准 MCP 工具，系统能够与大语言模型（LLM）实现双向交互，为学习者提供具备“状态感知、算法求解、动作验证、语音伴教”能力的智能魔方私教体验。

---

## 系统架构

```text
┌───────────────────────────────────────────────────────────┐
│             前端交互层 (React 19 + Three.js)              │
│  - 3D 虚拟魔方渲染与物理交互 (src/cuber)                  │
│  - 摄像头实时扫面采集 (src/cv/scanner.ts)                 │
│  - 公式库回放、WCA 计时器与复盘 (src/index.tsx)           │
└─────────────────────────────┬─────────────────────────────┘
                              │ HTTP REST / JSON-RPC
                              ▼
┌───────────────────────────────────────────────────────────┐
│             后端服务层 (Python FastAPI :8000)             │
│  - API 路由控制器 (server/api/)                           │
│  - 54 格状态单例与数学群论校验 (server/core/)             │
│  - YOLOv8 目标检测与色彩空间采样 (server/cv/)             │
└──────────────┬─────────────────────────────┬──────────────┘
               │                             │
               ▼                             ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│    三大阶梯求解器体系     │   │   AI Agent 与 MCP 协议    │
│  - 新手层先法 (7 阶段教学)│   │  - 标准 MCP Server 服务端 │
│  - CFOP 进阶 (4 阶段速拧) │   │  - 4 项核心工具标准暴露   │
│  - Kociemba 最优解 (20 步)│   │  - 中文 TTS 语音伴教播报  │
└───────────────────────────┘   └───────────────────────────┘
```

### 模块分层与技术选型

| 分层 | 技术选型 | 核心职责 |
| :--- | :--- | :--- |
| 前端交互层 | React 19, TypeScript, Three.js, Vite | 60 FPS 3D 魔方渲染、视角控制、公式回放与视频流采集 |
| 接口路由层 | FastAPI, Uvicorn, Pydantic | 提供 RESTful 接口与状态管理控制器 |
| 核心算法层 | Python 3.12, RubikTwoPhase | 维护 54 格状态单例，执行数学合法性校验与阶段求解 |
| 视觉感知层 | YOLOv8, OpenCV, Roboflow | 物理魔方目标定位与 3x3 贴纸色彩自适应提取 |
| 智能体协议层 | Anthropic MCP Standard, TTS | 提供标准 MCP Server 接口供 LLM 调度，生成中文语音讲解 |

---

## 核心特性

- **标准 MCP 协议集成**：原生实现 Model Context Protocol (MCP) Server，提供 4 项标准化魔方操作工具，支持大语言模型通过 JSON-RPC 直接调度与分步启发式教学。
- **阶梯式三大求解体系**：
  - 新手层先法 (Beginner)：严格拆解为 7 个教学阶段（小黄花 → 底十字 → 底角 → 中棱 → 顶十字 → 顶面 → 顶角顶棱），配备中文语义指引。
  - CFOP 进阶法 (CFOP)：涵盖 Cross 底十字、F2L 前两层、OLL 顶面朝向与 PLL 顶面置换 4 大速拧阶段。
  - Kociemba 最优解：二阶段群论搜索算法，在 20~22 步内极速给出理论最短复原路径。
- **YOLOv8 视觉识别与同步**：通过摄像头捕获物理魔方表面，结合目标检测与 OpenCV 色彩空间自适应采样，一键将物理状态映射到 3D 虚拟场景。
- **React 19 + Three.js 3D 工作台**：玻璃拟态现代 UI 架构，提供 60 FPS 流畅物理渲染、公式播放、WCA 打乱与竞速计时器。
- **实时中文语音伴教**：集成 TTS 语音合成通道，还原过程中的每一个关键动作与阶段目标实时语音播报。

---

## MCP 协议工具集

CubeTutor 后端内置的 MCP Server 暴露了 4 个符合 [Model Context Protocol](https://modelcontextprotocol.io/) 规范的标准工具：

| 工具名称 (Tool Name) | 参数 (Arguments) | 功能描述 (Description) |
| :--- | :--- | :--- |
| `get_cube_state` | 无 | 获取当前魔方的 54 格标准 Facelet 颜色序列与复原状态 |
| `validate_state` | `facelets?: string` | 校验魔方在群论约束下的物理合法性（朝向与置换奇偶性） |
| `get_solution` | `method: "beginner" \| "cfop" \| "kociemba"` | 调用指定算法求解，返回结构化动作与阶段教学说明 |
| `apply_move` | `move: string` (如 `R`, `U'`, `F2`) | 在服务端单例会话中执行步序旋转，推进魔方状态 |

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

## 自动化测试

项目内置 39 项自动化单元测试，覆盖状态机矩阵、三大求解器逻辑、数学合法性校验与 MCP 工具链：

```bash
pytest server/tests
```

**测试结果**：`39 passed in 5.96s (100% 通过)`

---

## 项目目录结构

```text
CubeTutor/
├── start.bat               # Windows 一键启动脚本
├── package.json            # 前端工程配置与依赖
├── requirements.txt        # 后端全量 Python 依赖清单
├── vite.config.ts          # Vite 构建配置
├── index.html              # 前端 SPA 页面入口
│
├── src/                    # 前端 React 19 + Three.js 源码
│   ├── cuber/              # 3D 魔方物理模型与渲染管线
│   ├── cv/                 # 摄像头视频流扫面驱动 (scanner.ts)
│   ├── solver/             # 前端备用求解器
│   └── index.tsx           # 前端总控制台
│
├── server/                 # 后端 Python FastAPI 源码
│   ├── core/               # 54 格状态、置换表、单例 Session 与校验
│   ├── solvers/            # 三大求解算法包 (beginner / cfop / kociemba)
│   ├── cv/                 # YOLOv8 目标检测与色彩采样
│   ├── agent/              # MCP Server 协议实现、Agent 调度与 TTS
│   ├── api/                # FastAPI 路由控制器
│   └── tests/              # 39 项自动化单元测试
│
└── docs/                   # 项目技术文档与开发规范
    ├── screenshot/         # 基础功能演示动图与 demo.md
    └── superpowers/        # 模块任务书与进展跟踪
```

---

## 开源许可证

本项目基于 [MIT License](./LICENSE) 协议发布。
