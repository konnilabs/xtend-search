# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
ARG PYTHON_IMAGE=python:3.12-slim-bookworm@sha256:392307d22300de8b5986851a12d9176dfc0fc073e65bf6523ebd7dcbeb23564e
FROM ${NODE_IMAGE} AS frontend
WORKDIR /build/xtend
COPY xtend/package.json xtend/package-lock.json ./
COPY xtend/vendor-inputs ./vendor-inputs
RUN npm install --global npm@11.17.0 && npm ci --ignore-scripts
WORKDIR /build
COPY . .
# Keep corresponding source and the exact local XTend package available.
RUN tar --exclude=./xtend/node_modules --exclude=./source.tar.gz -czf /source.tar.gz .
WORKDIR /build/xtend
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM ${PYTHON_IMAGE} AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    BIND_HOST=0.0.0.0 PORT=8080 XTEND_SECRET_DIR=/var/lib/xtend-search \
    SEARXNG_SETTINGS_PATH=/app/xtend/config/settings.yml \
    SEARXNG_URL=http://localhost:8080/ XTEND_PYTHON=/usr/local/bin/python
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends tini libstdc++6 ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 xtend && useradd --uid 10001 --gid 10001 --no-create-home xtend \
    && mkdir -p /var/lib/xtend-search && chown 10001:10001 /var/lib/xtend-search
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY xtend/requirements.lock.txt /app/xtend/requirements.lock.txt
RUN pip install --no-cache-dir -r /app/xtend/requirements.lock.txt
COPY searx /app/searx
COPY LICENSE /app/LICENSE
COPY --from=frontend /build/xtend /app/xtend
COPY --from=frontend /source.tar.gz /app/source.tar.gz
RUN python -c 'from pathlib import Path; Path("searx/version_frozen.py").write_text("VERSION_STRING = \"2026.9.19+e831fc2a1+xtend.0.2.1\"\nVERSION_TAG = \"2026.9.19+e831fc2a1\"\nDOCKER_TAG = \"xtend-search-0.2.1\"\nGIT_URL = \"/source.tar.gz\"\nGIT_BRANCH = \"xtend-search\"\n")'
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD node -e 'fetch("http://127.0.0.1:8080/health/ready").then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "xtend/server/supervisor.mjs"]
