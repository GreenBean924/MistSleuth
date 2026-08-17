# 🕯️ MistSleuth · 迷雾侦探 AI 剧本杀（单人侦探模式）

单人沉浸式剧本杀：你选一个角色，AI 同时担任**主持人 + 所有 NPC**，陪你搜证、推理、盘问，最后指认真凶并为你逐条复盘。视角隔离保证 AI 在游玩阶段绝不剧透。

## 核心玩法

选剧本 → 选角色 → 搜证 / 向 NPC 提问 / 陈述推理 → 指认凶手 → AI 复盘对照

## 技术栈

| 层 | 选型 | 为什么 |
|---|---|---|
| 后端 | FastAPI + SSE | 原生异步、流式输出（打字机效果）、单文件即可跑 |
| LLM | 通义千问 qwen3-max | 中文剧本理解强，DashScope 一键接入 |
| 结构化抽取 | LLM IE → Pydantic → SQLite | 把主持人手册抽成角色/线索/时间线/真相，支撑视角隔离 |
| 向量库 | Chroma（LangChain） | 本地持久化，零运维；按剧本 source 过滤 |
| 前端 | React 18 + Vite 5 + TS | 轻量、启动快、生态成熟 |
| 部署 | 单服务 Docker | FastAPI 托管 React 产物，前后端同源，一个容器上线 |

## 项目结构

```
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI 入口 + API + 静态托管
│   │   ├── config.py       # 全局配置（路径 / 模型 / 参数）
│   │   ├── schemas.py      # Pydantic 数据结构（角色/线索/时间线/真相）
│   │   ├── db.py           # SQLite 存储
│   │   ├── extraction.py   # LLM 结构化抽取（失败降级为纯 RAG）
│   │   ├── vector_store.py # Chroma 封装（按 source 过滤）
│   │   ├── ingestion.py    # 摄取管线：文档 → 抽取 → DB + Chroma
│   │   └── agent.py        # 游戏状态机 + 视角隔离 Agent
│   ├── data/               # app.db + chroma/ + scripts/（不提交）
│   ├── ingest.py           # 摄取 CLI
│   └── requirements.txt
├── frontend/
│   ├── src/                # React 组件 + api 封装（流式读取）
│   └── package.json
├── docs/product-spec.md    # 产品文档
├── Dockerfile              # 单服务部署
└── .dockerignore
```

## 本地运行

### 0. 环境变量

```bash
export DASHSCOPE_API_KEY=你的通义千问key
```

### 1. 后端（端口 8000）

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. 前端（Vite dev server，端口 5173，自动代理 /api）

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 即可游玩。

## 部署到 Railway

1. 把仓库推到 GitHub（`.env` 已被 `.dockerignore` 排除，密钥不会进镜像）。
2. Railway 新建 project → **Deploy from GitHub repo**（会自动检测根目录 `Dockerfile`）。
3. 在 Variables 里加一条环境变量：`DASHSCOPE_API_KEY=你的key`。
4. 部署完成后访问 Railway 分配的域名。

说明：预摄取的剧本数据（`backend/data/app.db` + `chroma/`）随镜像一起发布，容器启动即可玩，无需在线上再做摄取。

## 新增剧本

在 `backend/data/scripts/` 放一个 `.md` / `.txt` 剧本（主持人手册格式），然后：

```bash
cd backend
python ingest.py
```

LLM 会自动抽取结构化信息入 SQLite + 原文分块入 Chroma。
