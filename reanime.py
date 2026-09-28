from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import os
import httpx

app = FastAPI(title="Kumo-Anime Direct API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANILIST_URL = "https://graphql.anilist.co"

@app.get("/home")
async def home(limit: int = Query(20, ge=1, le=100)):
    query = """
    query ($perPage: Int) {
      Page (perPage: $perPage) {
        media (sort: [TRENDING_DESC, POPULARITY_DESC], type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          episodes
          status
          description
          genres
        }
      }
    }
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(ANILIST_URL, json={"query": query, "variables": {"perPage": limit}})
            data = response.json()
            media_list = data.get("data", {}).get("Page", {}).get("media", [])
            
            # Format to match your frontend structure
            formatted = []
            for item in media_list:
                formatted.append({
                    "id": str(item["id"]),
                    "title": item["title"]["english"] or item["title"]["romaji"],
                    "image": item["coverImage"]["large"],
                    "description": item["description"],
                    "totalEpisodes": item["episodes"]
                })
            
            return {
                "latest_aired": formatted,
                "top_weekly": formatted[:10]
            }
        except Exception as e:
            print(f"AniList error: {e}")
            return {"latest_aired": [], "top_weekly": []}

@app.get("/search")
async def search_anime(q: str = Query(...)):
    query = """
    query ($search: String) {
      Page (perPage: 20) {
        media (search: $search, type: ANIME) {
          id
          title { romaji english }
          coverImage { large }
          episodes
        }
      }
    }
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(ANILIST_URL, json={"query": query, "variables": {"search": q}})
            data = response.json()
            media_list = data.get("data", {}).get("Page", {}).get("media", [])
            
            results = [{
                "id": str(item["id"]),
                "title": item["title"]["english"] or item["title"]["romaji"],
                "image": item["coverImage"]["large"]
            } for item in media_list]
            
            return {"results": results}
        except Exception as e:
            return {"results": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("reanime:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
