FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Build toolchain so native wheels (psutil, asyncpg, cryptography) can compile
# if a prebuilt wheel is unavailable for the platform. Removed in the same layer
# to keep the image small. This fixes "error: command 'gcc' failed" build breaks.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc python3-dev build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
