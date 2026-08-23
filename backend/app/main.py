from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import (
    admin,
    auth,
    castellon,
    laliga,
    matches,
    predictions,
    standings,
    stats,
    sync,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="BetSoccer API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(matches.router)
app.include_router(predictions.router)
app.include_router(standings.router)
app.include_router(stats.router)
app.include_router(sync.router)
app.include_router(laliga.router)
app.include_router(admin.router)
app.include_router(castellon.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
