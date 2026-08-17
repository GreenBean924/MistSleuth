"""结构化剧本数据模型（Pydantic）。

视角隔离依赖这些字段：游玩时只注入「当前视角」的字段，真相只在复盘阶段注入。
"""
from pydantic import BaseModel


class Character(BaseModel):
    name: str
    public_identity: str
    secret: str
    goal: str
    relations: str = ""


class Clue(BaseModel):
    id: str
    category: str   # 个人 / 公共 / 现场 / 尸检
    content: str
    owner: str = ""  # 归属角色名，空 = 公共


class TimelineEvent(BaseModel):
    time: str
    event: str


class Truth(BaseModel):
    culprit: str
    method: str
    motive: str
    key_evidence: str


class Location(BaseModel):
    name: str
    area: str  # 分区标签，如「二楼室内」「一楼室内」「室外」
    description: str = ""


class ScriptStructure(BaseModel):
    title: str
    description: str = ""
    characters: list[Character]
    clues: list[Clue]
    timeline: list[TimelineEvent]
    truth: Truth
    locations: list[Location] = []  # 可搜查/出现的场所，旧数据缺省为空
