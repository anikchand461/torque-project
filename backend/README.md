# Torque Communications Backend

Backend-only graph orchestration engine for modeling organizational positions, hierarchy, communication relationships, protocols, and deterministic execution.

## Requirements

- Python 3.12+
- No external API keys
- SQLite for development

## Setup

```bash
cd torque-communications/backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Initialize database

The FastAPI lifespan initializes SQLite automatically when the server starts. You can also initialize it manually:

```bash
python -c "import asyncio; from app.core.database import init_db; asyncio.run(init_db())"
```

## Seed sample graph

```bash
python scripts/seed.py
```

The script prints the graph ID and CEO node ID.

## Run server

```bash
uvicorn app.main:app --reload
```

Open Swagger at `http://127.0.0.1:8000/docs`.

## Run tests

```bash
pytest -q
```

## Execute sample graph

After seeding, call:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/graphs/<GRAPH_ID>/execute \
  -H 'Content-Type: application/json' \
  -d '{"start_node_id":"<CEO_NODE_ID>","question":"How should the target organization price its next product?"}'
```

Then inspect:

```bash
curl http://127.0.0.1:8000/api/v1/executions/<EXECUTION_ID>
curl http://127.0.0.1:8000/api/v1/executions/<EXECUTION_ID>/trace
```

## Architecture

- `api/`: HTTP endpoints only
- `models/`: SQLAlchemy persistence models
- `schemas/`: Pydantic request/response schemas
- `services/`: application/business services
- `graph_engine/`: validation, routing, context construction, execution state, orchestration
- `agents/`: provider-neutral agent interface and deterministic mock implementation

Routing is deterministic. The engine never asks an LLM to decide where information goes.

Hierarchy is represented with `parent_id`. Communication is represented separately with `Relationship` records. Communication cycles are allowed; hierarchy cycles are rejected.

## External persona agents

Implement `PersonaAgent` from `app/agents/interface.py`:

```python
class MyPersonaAgent(PersonaAgent):
    async def execute(self, request: AgentRequest) -> AgentResponse:
        ...
```

Then pass the implementation into `GraphExecutionEngine.execute(...)`. The graph APIs and routing engine do not need to know which model/provider is behind the interface.
