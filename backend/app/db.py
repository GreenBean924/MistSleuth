"""SQLite 存储层：结构化剧本 + 游戏会话。"""
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from app import config
from app.schemas import ScriptStructure


def get_conn() -> sqlite3.Connection:
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    """提交/回滚事务并保证关闭连接。"""
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS scripts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                source_file TEXT,
                structured_json TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );
            """
        )


def save_script(structure: ScriptStructure, source_file: str) -> int:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO scripts (title, description, source_file, structured_json) "
            "VALUES (?, ?, ?, ?)",
            (structure.title, structure.description, source_file, structure.model_dump_json()),
        )
        return int(cur.lastrowid)


def list_scripts() -> list[dict]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, title, description, source_file FROM scripts ORDER BY id"
        ).fetchall()
    return [dict(r) for r in rows]


def get_script(script_id: int) -> ScriptStructure | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT structured_json FROM scripts WHERE id = ?", (script_id,)
        ).fetchone()
    if row is None:
        return None
    return ScriptStructure.model_validate_json(row["structured_json"])
