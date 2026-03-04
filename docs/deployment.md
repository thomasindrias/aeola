# Deployment Guide

## Docker Self-Host

### Docker Compose

```bash
cp .env.example .env
# Set API_KEY and OPENAI_API_KEY in .env

docker compose up --build -d
```

### Environment Variables

Pass via `.env` file or `docker compose` environment:

```yaml
services:
  agent-store:
    build: .
    ports:
      - "8000:8000"
    environment:
      - API_KEY=your-secret-key
      - OPENAI_API_KEY=sk-...
      - DB_PATH=/data/agent-store.db
      - PORT=8000
      - CONCURRENCY=3
      - RATE_LIMIT=5
      - CORS_ORIGINS=*
      - LOG_LEVEL=info
    volumes:
      - ./data:/data
```

### Persistent Storage

Mount a volume for the SQLite database:

```bash
docker run -v ./data:/data -e DB_PATH=/data/agent-store.db ...
```

## Railway

1. Fork the repository
2. Create a new project on [Railway](https://railway.app/)
3. Connect your GitHub repo
4. Set environment variables: `API_KEY`, `OPENAI_API_KEY`
5. Deploy — Railway auto-detects the Dockerfile

## Fly.io

```bash
# Install flyctl
fly launch --dockerfile Dockerfile

# Set secrets
fly secrets set API_KEY=your-key OPENAI_API_KEY=sk-...

# Deploy
fly deploy
```

Create `fly.toml`:

```toml
[http_service]
  internal_port = 8000
  auto_stop_machines = true
  auto_start_machines = true

[mounts]
  source = "agent_store_data"
  destination = "/data"

[env]
  DB_PATH = "/data/agent-store.db"
  PORT = "8000"
```

## Resource Requirements

| Concurrency | RAM   | CPU | Notes                          |
| ----------- | ----- | --- | ------------------------------ |
| 1           | 256MB | 0.5 | Minimum for light usage        |
| 3 (default) | 512MB | 1.0 | Recommended for most workloads |
| 10          | 1GB   | 2.0 | High-throughput ingestion      |
| 20 (max)    | 2GB   | 4.0 | Maximum extraction parallelism |

Note: Discovery (Playwright) always runs serially. Concurrency applies to the
extraction phase only.
