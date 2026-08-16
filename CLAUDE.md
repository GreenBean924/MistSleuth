# MistSleuth · 迷雾剧场 AI 剧本杀（单人侦探模式）

单人沉浸式剧本杀：玩家选一个角色，AI 同时担任主持人 + 所有 NPC，搜证、推理、指认、复盘。视角隔离保证游玩阶段不剧透。

## 技术栈
- 后端: FastAPI + SSE 流式输出
- LLM: 阿里云 DashScope（ChatTongyi qwen3-max + text-embedding-v4）
- 结构化抽取: LLM IE → Pydantic → SQLite；向量库: Chroma（LangChain）
- 前端: React 18 + Vite 5 + TypeScript
- 部署: 单服务 Docker（FastAPI 托管 React 构建产物，同源）

## 项目结构
```
├── backend/
│   ├── app/
│   │   ├── main.py         # FastAPI 入口 + API + 静态托管
│   │   ├── config.py       # 全局配置（路径/模型/参数，禁止他处硬编码）
│   │   ├── schemas.py      # Pydantic 数据结构（角色/线索/时间线/真相）
│   │   ├── db.py           # SQLite 存储
│   │   ├── extraction.py   # LLM 结构化抽取（失败降级纯 RAG）
│   │   ├── vector_store.py # Chroma 封装（按 source 过滤）
│   │   ├── ingestion.py    # 摄取管线
│   │   └── agent.py        # 游戏状态机 + 视角隔离 Agent
│   ├── data/               # app.db + chroma/ + scripts/（预摄取，随镜像发布）
│   ├── ingest.py
│   └── requirements.txt
├── frontend/
│   ├── src/                # App/GameView/ReplayView + api.ts
│   └── package.json
├── docs/product-spec.md
├── Dockerfile
└── .dockerignore
```

## 约定
- 配置项统一放 backend/app/config.py，禁止其他模块硬编码模型名/路径/参数
- 视角隔离铁律：truth（真凶/手法/动机）绝不进入游玩阶段 prompt，复盘阶段才注入
- 前后端字段名严格对齐（api.ts 类型 ↔ main.py 返回结构），改动任一端需同步核对另一端
- 中文注释和文档，代码标识符用英文
- 新增文档格式在 backend/app/ingestion.py 的 _load_text 中扩展

## 启动
```bash
# 后端（需 DASHSCOPE_API_KEY）
cd backend && uvicorn app.main:app --reload --port 8000
# 前端
cd frontend && npm run dev
```
详见 README.md。
