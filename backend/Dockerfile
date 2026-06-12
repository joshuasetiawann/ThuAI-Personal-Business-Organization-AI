FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1

# Build toolchain so native wheels (psutil, asyncpg, cryptography) can compile
# if a prebuilt wheel is unavailable for the platform. curl is used by the
# container HEALTHCHECK. Removed apt lists in the same layer to keep it small.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc python3-dev build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# Run as an unprivileged user so an RCE/path bug can't act as root in-container.
# /data is the writable volume mount; create + own it so a FRESH named volume
# inherits this ownership. For an EXISTING root-owned volume, run once:
#   docker compose run --rm --user root backend chown -R thunity:thunity /data
RUN groupadd --system thunity \
    && useradd --system --gid thunity --no-create-home thunity \
    && mkdir -p /data \
    && chown -R thunity:thunity /app /data
USER thunity

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8000/api/health/local-only || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
