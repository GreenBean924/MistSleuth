"""全局配置。

所有路径、模型名、参数统一收敛到这里，禁止在其他模块硬编码。
"""
from pathlib import Path

# 目录（以 backend/ 为基准）
BASE_DIR = Path(__file__).resolve().parent.parent   # backend/
DATA_DIR = BASE_DIR / "data"
SCRIPTS_DIR = DATA_DIR / "scripts"                   # 原始剧本文件
DB_PATH = DATA_DIR / "app.db"                        # SQLite
CHROMA_DIR = DATA_DIR / "chroma"                     # 向量库持久化
MD5_PATH = DATA_DIR / "md5.txt"                      # 摄取去重记录

# Chroma
COLLECTION_NAME = "rag"

# 分块参数
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 100
SEPARATORS = ["\n\n", "。", "？", "！", " ", "", ".", "\n"]
MAX_SPLIT = 1000

# 检索
RETRIEVAL_K = 6

# 模型
EMBEDDING_MODEL_NAME = "text-embedding-v4"
MODEL_NAME = "qwen3-max"
# 结构化抽取用低温度保证输出稳定；对话/主持用略高温度保证表现力
EXTRACTION_TEMPERATURE = 0.0
AGENT_TEMPERATURE = 0.7
