"""向量库封装：Chroma 检索，支持按剧本 source 过滤。"""
from langchain_chroma import Chroma
from langchain_community.embeddings import DashScopeEmbeddings

from app import config


class VectorStoreService:
    def __init__(self):
        self.embedding = DashScopeEmbeddings(model=config.EMBEDDING_MODEL_NAME)
        self.store = Chroma(
            collection_name=config.COLLECTION_NAME,
            embedding_function=self.embedding,
            persist_directory=str(config.CHROMA_DIR),
        )

    def add_texts(self, texts: list[str], metadatas: list[dict]) -> None:
        self.store.add_texts(texts=texts, metadatas=metadatas)

    def get_retriever(self, filter_source: str | None = None):
        search_kwargs = {"k": config.RETRIEVAL_K}
        if filter_source:
            search_kwargs["filter"] = {"source": filter_source}
        return self.store.as_retriever(search_kwargs=search_kwargs)
