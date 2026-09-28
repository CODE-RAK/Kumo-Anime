from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import re
import httpx

app = FastAPI(title="ReAnime API Backend")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPSTREAM_BASE = "https://reanime.to"  # Adjust if your upstream provider base URL differs

async def _get(path: str, params: dict = None):
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            url = f"{UPSTREAM_BASE}{path}" if path.startswith("/") else path
            response = await client.get(url, params=params, headers={"User-Agent": "Mozilla/5.0"})
            if response.status_code != 200:
                return {}
            return response.json()
        except Exception as e:
            print(f"Upstream fetch error for {path}: {e}")
            return {}

def _anilist_from_anime(anime: dict) -> int:
    return anime.get("anilist_id") or 0

async def _servers(slug: str, episode: int, anilist_id: int = None):
    data = await _get(f"/api/servers/{slug}/{episode}")
    return data

async def get_stream_url(access_id: str, v: int):
    # Calls internal decryption or external stream resolver
    data = await _get(f"/api/stream/{access_id}", {"v": v})
    return data

@app.get("/home")
async def home(limit: int = Query(20, ge=1, le=100)):
    try:
        latest, top = await asyncio.gather(
            _get("/api/home/latest-aired", {"limit": limit}),
            _get("/api/top/anime", {"period": "week", "limit": limit}),
        )
        return {
            "latest_aired": latest if isinstance(latest, list) else latest.get("data", []),
            "top_weekly": top if isinstance(top, list) else top.get("data", [])
        }
    except Exception as e:
        print(f"Home route error: {e}")
        return {"latest_aired": [], "top_weekly": []}

@app.get("/top")
async def top(
    period: str = Query("week", pattern="^(day|week|month)$"),
    limit: int = Query(20, ge=1, le=100),
):
    return await _get("/api/top/anime", {"period": period, "limit": limit})

@app.get("/schedule")
async def schedule():
    return await _get("/api/schedule")

@app.get("/info/{slug}")
async def anime_info(slug: str):
    try:
        meta, eps = await asyncio.gather(
            _get(f"/api/watch/{slug}/1"),
            _get(f"/api/episodes/{slug}"),
        )
        anime = meta.get("anime") or {}
        anilist_id = _anilist_from_anime(anime)
        ep_list = eps if isinstance(eps, list) else eps.get("data", eps.get("episodes", []))
        return {**anime, "episodes": ep_list, "anilist_id": anilist_id}
    except Exception as e:
        print(f"Info route error for {slug}: {e}")
        return {
            "title": slug.replace("-", " ").title(),
            "description": "Fallback description: Could not fetch metadata from upstream provider.",
            "status": "Ongoing",
            "episodes": [{"number": i} for i in range(1, 13)]
        }

@app.get("/episodes/{slug}")
async def episodes(slug: str):
    data = await _get(f"/api/episodes/{slug}")
    return data if isinstance(data, list) else data.get("data", data.get("episodes", data))

@app.get("/servers/{slug}/{episode}")
async def servers(slug: str, episode: int, anilist_id: int = Query(None)):
    return await _servers(slug, episode, anilist_id)

@app.get("/stream/from-link")
async def stream_from_link(link: str = Query(...)):
    m = re.search(r"/e/([^?#\s]+)\?v=(\d+)", link)
    if not m:
        raise HTTPException(400, detail="Expected URL format")
    return await get_stream_url(m.group(1), int(m.group(2)))

@app.get("/stream/{access_id}")
async def stream(access_id: str, v: int = Query(2, ge=1, le=2)):
    return await get_stream_url(access_id, v)

@app.get("/thumbnails/{anilist_id}")
async def thumbnails(anilist_id: int):
    return await _get(f"/api/thumbnails/{anilist_id}")

@app.get("/recommendations/{slug}")
async def recommendations(slug: str):
    return await _get(f"/api/anime/{slug}/recommendations")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("reanime:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), workers=1, reload=False)