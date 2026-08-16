"""FastAPI 入口：REST API + 流式输出 + 托管前端静态文件。"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import config, db
from app.agent import create_session, get_session


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="AI 剧本杀 DM", lifespan=lifespan)

# 开发期前端 Vite dev server 跨域；单服务部署时同源、无影响
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- 请求模型 ----------
class StartRequest(BaseModel):
    script_id: int
    character: str


class MessageRequest(BaseModel):
    session_id: str
    message: str


class AccuseRequest(BaseModel):
    session_id: str
    culprit: str
    method: str
    motive: str


# ---------- API ----------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/scripts")
def scripts():
    return db.list_scripts()


@app.get("/api/scripts/{script_id}")
def script_detail(script_id: int):
    s = db.get_script(script_id)
    if s is None:
        raise HTTPException(status_code=404, detail="剧本不存在")
    return {
        "id": script_id,
        "title": s.title,
        "description": s.description,
        "characters": [
            {"name": c.name, "public_identity": c.public_identity}
            for c in s.characters
        ],
    }


@app.post("/api/game/start")
def game_start(req: StartRequest):
    try:
        session_id, agent = create_session(req.script_id, req.character)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    opening = agent.start()
    return {
        "session_id": session_id,
        "opening": opening,
        "player_view": agent.player_view(),
    }


@app.post("/api/game/message")
async def game_message(req: MessageRequest):
    agent = get_session(req.session_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    if agent.phase != "playing":
        raise HTTPException(status_code=400, detail="游戏已结束，请重新开局")

    async def gen():
        async for piece in agent.respond_stream(req.message):
            yield piece

    return StreamingResponse(gen(), media_type="text/plain")


@app.post("/api/game/accuse")
def game_accuse(req: AccuseRequest):
    agent = get_session(req.session_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return agent.accuse(req.culprit, req.method, req.motive)


# ---------- 前端静态托管（生产：单服务） ----------
_frontend_dist = config.BASE_DIR.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")
