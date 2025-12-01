FROM --platform=linux/arm64 python:3.12-slim

RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    wget \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/task

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

RUN mkdir -p /var/task/models

RUN wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx \
    -O /var/task/models/es_ES-davefx-medium.onnx && \
    wget -q https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json \
    -O /var/task/models/es_ES-davefx-medium.onnx.json

COPY handler.py .

ENV MODEL_PATH=/var/task/models/es_ES-davefx-medium.onnx
ENV ORT_LOGGING_LEVEL=4

ENTRYPOINT ["python3", "-m", "awslambdaric"]
CMD ["handler.lambda_handler"]
