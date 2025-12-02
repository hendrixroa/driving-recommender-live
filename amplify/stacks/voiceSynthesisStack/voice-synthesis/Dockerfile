FROM --platform=linux/amd64 python:3.12-slim

RUN apt-get update && apt-get install -y \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/task

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

RUN mkdir -p /var/task/models

RUN wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx \
    -O /var/task/models/es_MX-claude-high.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx.json \
    -O /var/task/models/es_MX-claude-high.onnx.json

RUN ls -la /var/task/models/

COPY handler.py .

ENV MODEL_PATH=/var/task/models/es_MX-claude-high.onnx
ENV ORT_LOGGING_LEVEL=4
ENV ONNXRUNTIME_LOG_SEVERITY_LEVEL=4
ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["python3", "-m", "awslambdaric"]
CMD ["handler.lambda_handler"]
