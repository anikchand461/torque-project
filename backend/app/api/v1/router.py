from fastapi import APIRouter
from app.api.v1 import executions, graphs, nodes, protocols, relationships

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(graphs.router)
api_router.include_router(nodes.router)
api_router.include_router(relationships.router)
api_router.include_router(protocols.router)
api_router.include_router(executions.router)
