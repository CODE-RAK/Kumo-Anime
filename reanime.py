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
            if response.status_code != 200:
                return {"latest_aired": [], "top_weekly": []}
                
            res_json = response.json()
            if not res_json or not isinstance(res_json, dict):
                return {"latest_aired": [], "top_weekly": []}
                
            data = res_json.get("data")
            if not data or not isinstance(data, dict):
                return {"latest_aired": [], "top_weekly": []}
                
            page = data.get("Page")
            if not page or not isinstance(page, dict):
                return {"latest_aired": [], "top_weekly": []}
                
            media_list = page.get("media", [])
            if not media_list:
                return {"latest_aired": [], "top_weekly": []}
            
            formatted = []
            for item in media_list:
                if not item:
                    continue
                title_obj = item.get("title") or {}
                cover_obj = item.get("coverImage") or {}
                
                title = title_obj.get("english") or title_obj.get("romaji") or "Unknown Title"
                image = cover_obj.get("large") or ""
                
                formatted.append({
                    "id": str(item.get("id", "")),
                    "title": title,
                    "image": image,
                    "description": item.get("description", "No description available."),
                    "totalEpisodes": item.get("episodes") or 12
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
            if response.status_code != 200:
                return {"results": []}
                
            res_json = response.json()
            if not res_json or not isinstance(res_json, dict):
                return {"results": []}
                
            data = res_json.get("data", {}) or {}
            page = data.get("Page", {}) or {}
            media_list = page.get("media", []) or []
            
            results = []
            for item in media_list:
                if not item:
                    continue
                title_obj = item.get("title") or {}
                cover_obj = item.get("coverImage") or {}
                results.append({
                    "id": str(item.get("id", "")),
                    "title": title_obj.get("english") or title_obj.get("romaji") or "Unknown",
                    "image": cover_obj.get("large") or ""
                })
            return {"results": results}
        except Exception as e:
            return {"results": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("reanime:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
