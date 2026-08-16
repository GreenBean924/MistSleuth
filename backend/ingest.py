"""摄取内置剧本到知识库。用法：cd backend && python ingest.py"""
from app import config
from app.ingestion import ingest_script


def main() -> None:
    for fp in sorted(config.SCRIPTS_DIR.iterdir()):
        if fp.suffix.lower() in (".md", ".txt", ".pdf", ".docx"):
            print(ingest_script(str(fp)))


if __name__ == "__main__":
    main()
