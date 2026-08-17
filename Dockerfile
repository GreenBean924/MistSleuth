# 多阶段构建：先编译前端，再组装 FastAPI 单服务镜像
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
WORKDIR /app

# onnxruntime（chromadb 传递依赖）在 slim 镜像需要 libgomp 运行库
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 先装依赖（利用 Docker 层缓存）
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 拷贝后端（含预摄取数据 backend/data/）+ 前端构建产物
COPY backend/ ./backend/
COPY --from=frontend-build /build/dist ./frontend/dist

WORKDIR /app/backend
EXPOSE 8000
# Railway 注入 $PORT；本地默认 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
