from fastapi import APIRouter
from src.api.endpoints import auth, feeds, items, agents, chat, teams

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(feeds.router)
api_router.include_router(items.router)
api_router.include_router(agents.router)
api_router.include_router(chat.router)
api_router.include_router(teams.router)
