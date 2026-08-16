"""剧本摄取管线：文档加载 → 全文 → LLM 结构化抽取 → SQLite + Chroma。"""
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app import config
from app.db import init_db, save_script
from app.extraction import extract_structure
from app.vector_store import VectorStoreService


def _load_text(file_path: Path) -> str:
    """按扩展名提取全文。md/txt 直接读，pdf/docx 走对应 loader。"""
    ext = file_path.suffix.lower()
    if ext in (".md", ".txt"):
        return file_path.read_text(encoding="utf-8")
    if ext == ".pdf":
        from langchain_community.document_loaders import PyPDFLoader

        docs = PyPDFLoader(str(file_path)).load()
        return "\n".join(d.page_content for d in docs)
    if ext == ".docx":
        from langchain_community.document_loaders import Docx2txtLoader

        docs = Docx2txtLoader(str(file_path)).load()
        return "\n".join(d.page_content for d in docs)
    raise ValueError(f"不支持的格式: {ext}")


def _add_to_chroma(full_text: str, source_name: str) -> int:
    """原文分块入向量库，返回块数。"""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        separators=config.SEPARATORS,
    )
    chunks = splitter.split_text(full_text)
    metadatas = [{"source": source_name} for _ in chunks]
    VectorStoreService().add_texts(chunks, metadatas)
    return len(chunks)


def ingest_script(file_path: str, source_name: str | None = None) -> dict:
    """摄取单个剧本，返回结果摘要。"""
    fp = Path(file_path)
    source_name = source_name or fp.name

    full_text = _load_text(fp)
    if not full_text.strip():
        return {"ok": False, "source": source_name, "error": "未能提取到文本"}

    result: dict = {"ok": True, "source": source_name}

    # 1. LLM 结构化抽取（失败降级为纯 RAG）
    structure = extract_structure(full_text)
    if structure is not None:
        init_db()
        save_script(structure, source_name)
        result["structured"] = True
        result["title"] = structure.title
        result["characters"] = len(structure.characters)
        result["clues"] = len(structure.clues)
    else:
        result["structured"] = False
        result["error"] = "结构化抽取失败，已降级为纯 RAG"

    # 2. 原文分块入 Chroma（无论抽取是否成功都做，保证 RAG 兜底）
    result["chunks"] = _add_to_chroma(full_text, source_name)

    return result
