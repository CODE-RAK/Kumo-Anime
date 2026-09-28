from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import os
import httpx

app = FastAPI(title="Kumo-Anime API Backend")

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Using reliable public anime API provider as upstream base
UPSTREAM_BASE = "https://api.consumet.org"

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

@app.get("/home")
async def home(limit: int = Query(20, ge=1, le=100)):
    try:
        # Fetching trending and recent releases
        data = await _get("/anime/gogoanime/trending", {"page": 1})
        results = data.get("results", [])
        
        return {
            "latest_aired": results,
            "top_weekly": results[:10] if results else []
        }
    except Exception as e:
        print(f"Home route error: {e}")
        return {"latest_aired": [], "top_weekly": []}

@app.get("/search")
async def search_anime(q: str = Query(...)):
    try:
        data = await _get(f"/anime/gogoanime/{q}")
        return data
    except Exception as e:
        print(f"Search route error: {e}")
        return {"results": []}

@app.get("/info/{slug}")
async def anime_info(slug: str):
    try:
        data = await _get(f"/anime/gogoanime/info/{slug}")
        return data
    except Exception as e:
        print(f"Info route error for {slug}: {e}")
        return {
            "title": slug.replace("-", " ").title(),
            "description": "Fallback description: Could not fetch metadata.",
            "status": "Ongoing",
            "episodes": [{"number": i, "id": f"{slug}-episode-{i}"} for i in range(1, 13)]
        }

@app.get("/servers/{slug}/{episode}")
async def servers(slug: str, episode: int):
    # Constructing episode ID standard for Gogoanime provider format
    ep_id = f"{slug}-episode-{episode}"
    data = await _get(f"/anime/gogoanime/watch/{ep_id}")
    return data

@app.get("/stream/from-link")
async def stream_from_link(link: str = Query(...)):
    return {"streamUrl": link}

@app.get("/stream/{access_id}")
async def stream(access_id: str):
    data = await _get(f"/anime/gogoanime/watch/{access_id}")
    return data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("reanime:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), workers=1, reload=False)
