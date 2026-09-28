const REANIME_API = "https://kumo-anime-belb.onrender.com/";
const ANILIST_API = "https://graphql.anilist.co";

let catalogCache = [];
let rankingCache = [];

window.addEventListener('DOMContentLoaded', async () => {
    await initApp();
});

async function initApp() {
    const badge = document.getElementById('apiStatusBadge');
    try {
        const res = await fetch(`${REANIME_API}/home`);
        if (!res.ok) throw new Error(`ReAnime API error status: ${res.status}`);
        const data = await res.json();
        
        catalogCache = data.latest_aired || data.results || data.trending || data.data || [];
        rankingCache = data.top_weekly || data.trending || catalogCache.slice(0, 5);
        
        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-circle-check text-green-400 mr-1.5"></i> ReAnime Connected`;
        }
        
        if (catalogCache.length > 0) {
            const richHero = await enrichWithAniList(catalogCache[0]);
            renderHomeHero(richHero);
            renderGrid(catalogCache, 'trendingGrid');
            renderGrid(catalogCache, 'catalogGrid');
            renderRankingList(rankingCache, 'rankingGrid');
        } else {
            loadFallbackData();
        }
    } catch (err) {
        console.warn("ReAnime API connection failed:", err);
        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-yellow-400 mr-1.5"></i> Offline / Fallback Mode`;
        }
        loadFallbackData();
    }
}

async function enrichWithAniList(anime) {
    const query = `
        query ($search: String) {
            Media (search: $search, type: ANIME) {
                coverImage { large extraLarge }
                bannerImage
                description
                genres
                studios (isMain: true) { nodes { name } }
            }
        }
    `;
    try {
        const response = await fetch(ANILIST_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query, variables: { search: anime.title } })
        });
        const json = await response.json();
        const media = json.data?.Media;
        if (media) {
            return {
                ...anime,
                coverImage: media.coverImage.extraLarge || media.coverImage.large || anime.image,
                bannerImage: media.bannerImage || media.coverImage.extraLarge || anime.bannerImage,
                description: media.description?.replace(/<[^>]*>?/gm, '') || anime.description || 'No description available.',
                genres: media.genres ? media.genres.join(' • ') : 'Action • Anime',
                studio: media.studios?.nodes?.[0]?.name || 'Studio Animation'
            };
        }
    } catch (e) {
        console.error("AniList enrichment error:", e);
    }
    return anime;
}

function renderHomeHero(anime) {
    if (!anime) return;
    const banner = document.getElementById('heroBannerImg');
    const title = document.getElementById('heroTitle');
    const genres = document.getElementById('heroGenres');
    const synopsis = document.getElementById('heroSynopsis');
    const watchBtn = document.getElementById('heroWatchBtn');

    if (banner) banner.src = anime.bannerImage || anime.coverImage || anime.image || '';
    if (title) title.innerHTML = `${anime.title} <span class="text-zestyBright">Edition</span>`;
    if (genres) genres.innerText = anime.genres || 'Action • Simulcast';
    if (synopsis) synopsis.innerText = anime.description || 'Watch live streaming episodes.';
    if (watchBtn) watchBtn.onclick = () => openWatchView(anime);
}

function renderGrid(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = data.map((anime, idx) => {
        const imgUrl = anime.image || anime.coverImage || 'https://placehold.co/300x450/1E1E1A/FFFF66?text=No+Cover';
        return `
        <div onclick='selectAnimeItem(${idx})' 
             class="group bg-zestyCard border border-zestyMutedOlive/30 rounded-2xl overflow-hidden cursor-pointer hover:border-zestyBright transition-all shadow-lg flex flex-col">
            <div class="relative aspect-[2/3] w-full overflow-hidden bg-zestyDark">
                <img src="${imgUrl}" alt="${anime.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                <div class="absolute top-3 right-3 bg-zestyDark/90 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold text-zestyBright">
                    HD Sub
                </div>
            </div>
            <div class="p-4 flex flex-col flex-grow justify-between">
                <h3 class="font-bold text-sm text-white line-clamp-1 group-hover:text-zestyBright">${anime.title}</h3>
                <span class="text-xs text-zestyMutedOlive mt-1"><i class="fa-solid fa-play text-zestyBright mr-1"></i> Watch Series</span>
            </div>
        </div>
    `;
    }).join('');
}

function renderRankingList(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const topItems = data.slice(0, 5);
    container.innerHTML = topItems.map((anime, idx) => {
        const imgUrl = anime.image || anime.coverImage || 'https://placehold.co/100x150/1E1E1A/FFFF66?text=Rank';
        const rankNum = idx + 1;
        return `
        <div onclick='selectAnimeItem(${idx})' class="flex items-center space-x-4 bg-zestyCard border border-zestyMutedOlive/20 hover:border-zestyBright p-3 rounded-xl cursor-pointer transition-all group">
            <span class="text-xl font-black text-zestyMutedOlive group-hover:text-zestyBright w-6 text-center">0${rankNum}</span>
            <img src="${imgUrl}" alt="${anime.title}" class="w-12 h-16 object-cover rounded-lg shadow">
            <div class="flex-grow min-w-0">
                <h4 class="text-sm font-bold text-white truncate group-hover:text-zestyBright">${anime.title}</h4>
                <p class="text-xs text-zestyMutedOlive mt-0.5"><i class="fa-solid fa-fire text-zestyBright mr-1"></i> Weekly Rank #${rankNum}</p>
            </div>
        </div>
        `;
    }).join('');
}

async function selectAnimeItem(index) {
    const anime = catalogCache[index];
    if (!anime) return;
    const enriched = await enrichWithAniList(anime);
    openWatchView(enriched);
}

async function openWatchView(anime) {
    navigate('watch');
    const slug = anime.slug || anime.id || anime.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    document.getElementById('watchCoverImg').src = anime.coverImage || anime.image || '';
    document.getElementById('watchTitle').innerText = anime.title;
    document.getElementById('watchJapaneseTitle').innerText = anime.japaneseTitle || anime.title;
    document.getElementById('watchDescription').innerText = anime.description || 'Loading description...';
    document.getElementById('watchStatus').innerText = anime.status || 'Finished';
    document.getElementById('watchStudios').innerText = anime.studio || 'Studio Animation';
    document.getElementById('watchTotalEp').innerText = anime.totalEpisodes || '12';

    let episodesList = [];
    try {
        const infoRes = await fetch(`${REANIME_API}/info/${slug}`);
        if (!infoRes.ok) throw new Error("Failed to fetch /info endpoint");
        const infoData = await infoRes.json();
        
        if (infoData) {
            document.getElementById('watchDescription').innerText = infoData.description || anime.description;
            document.getElementById('watchStatus').innerText = infoData.status || 'Finished';
            episodesList = infoData.episodes || [];
            document.getElementById('watchTotalEp').innerText = episodesList.length || 12;
        }
    } catch (e) {
        console.warn("Could not fetch ReAnime /info/{slug}, generating standard episodes list:", e);
        for (let i = 1; i <= 12; i++) episodesList.push({ number: i });
    }

    const epContainer = document.getElementById('episodesGrid');
    epContainer.innerHTML = '';
    
    const countBadge = document.getElementById('episodesCountBadge');
    if (countBadge) countBadge.innerText = `${episodesList.length} Available`;

    episodesList.forEach((ep, index) => {
        const epNum = ep.number || (index + 1);
        const btn = document.createElement('button');
        btn.className = `py-2 rounded-xl text-xs font-bold transition-all border ${index === 0 ? 'bg-zestyBright text-zestyDark border-zestyBright zesty-glow' : 'bg-zestyDark text-zestyMutedOlive border-zestyMutedOlive/30 hover:border-zestyBright hover:text-white'}`;
        btn.innerText = epNum;
        btn.onclick = () => {
            document.querySelectorAll('#episodesGrid button').forEach(b => {
                b.className = 'py-2 rounded-xl text-xs font-bold transition-all border bg-zestyDark text-zestyMutedOlive border-zestyMutedOlive/30 hover:border-zestyBright hover:text-white';
            });
            btn.className = 'py-2 rounded-xl text-xs font-bold transition-all border bg-zestyBright text-zestyDark border-zestyBright zesty-glow';
            loadEpisodeStream(slug, epNum);
        };
        epContainer.appendChild(btn);
    });

    if (episodesList.length > 0) {
        loadEpisodeStream(slug, episodesList[0].number || 1);
    }
}

async function loadEpisodeStream(slug, epNumber) {
    document.getElementById('videoLoader').classList.remove('hidden');
    document.getElementById('currentPlayingEpText').innerText = `Resolving servers for Episode ${epNumber}...`;

    try {
        const serverRes = await fetch(`${REANIME_API}/servers/${slug}/${epNumber}`);
        if (!serverRes.ok) throw new Error("Server lookup failed");
        const serverData = await serverRes.json();
        
        const targetLink = serverData.sub?.[0]?.dataLink || serverData.link || serverData.dub?.[0]?.dataLink;
        if (!targetLink) throw new Error("No dataLink found in server response");

        document.getElementById('currentPlayingEpText').innerText = `Decrypting stream URL...`;

        const streamRes = await fetch(`${REANIME_API}/stream/from-link?link=${encodeURIComponent(targetLink)}`);
        if (!streamRes.ok) throw new Error("Stream decryption endpoint failed");
        const streamData = await streamRes.json();
        
        const m3u8Url = streamData.streamUrl || streamData.url;
        if (!m3u8Url) throw new Error("Stream URL missing from response");

        playHlsStream(m3u8Url, epNumber);
    } catch (e) {
        console.error("Backend streaming resolution error:", e);
        document.getElementById('currentPlayingEpText').innerText = `API Stream Error - Check Console (F12)`;
        document.getElementById('videoLoader').classList.add('hidden');
    }
}

function playHlsStream(url, epNumber) {
    const video = document.getElementById('hlsVideoPlayer');
    document.getElementById('videoLoader').classList.add('hidden');
    document.getElementById('currentPlayingEpText').innerText = `Playing Episode ${epNumber} (1080p HD)`;

    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => video.play());
    }
}

async function handleSearch(query) {
    if (!query) {
        renderGrid(catalogCache, 'catalogGrid');
        return;
    }
    try {
        const res = await fetch(`${REANIME_API}/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        const results = data.results || data.trending || [];
        renderGrid(results, 'catalogGrid');
        navigate('browse');
    } catch (e) {
        console.error("Search failed:", e);
    }
}

function navigate(viewName) {
    ['home', 'browse', 'watch'].forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.remove('hidden');
    
    if (viewName !== 'watch') {
        const video = document.getElementById('hlsVideoPlayer');
        if (video) { video.pause(); video.src = ""; }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadFallbackData() {
    const mockCatalog = [
        { 
            slug: "tokyo-ghoul", 
            title: "Tokyo Ghoul", 
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx20605-f48oB55w6j6h.jpg",
            bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/20605-b040441e8f80479da525cf16629ec2e9dfa34241.jpg",
            description: "A dark fantasy tale set in Tokyo featuring mysterious ghouls."
        },
        { 
            slug: "jujutsu-kaisen", 
            title: "Jujutsu Kaisen", 
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx113415-bbBWj4sEDbVU.jpg",
            bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/113415-jY4W2g4WzW8g.jpg",
            description: "A boy swallows a cursed talisman - the finger of a demon - and becomes cursed himself."
        },
        { 
            slug: "chainsaw-man", 
            title: "Chainsaw Man", 
            image: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx127230-floW3M61z99r.jpg",
            bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/127230-9i3W3V6f5sQd.jpg",
            description: "Following a betrayal, a young man trapped in poverty is resurrected with devil parts."
        }
    ];
    catalogCache = mockCatalog;
    rankingCache = mockCatalog;
    renderHomeHero(mockCatalog[0]);
    renderGrid(mockCatalog, 'trendingGrid');
    renderGrid(mockCatalog, 'catalogGrid');
    renderRankingList(mockCatalog, 'rankingGrid');
}

// Auth Modal Controls
function openAuthModal() { 
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('hidden'); 
}

function closeAuthModal() { 
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.add('hidden'); 
}

function handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value;
    closeAuthModal();
    alert(`Welcome back, ${email}! Successfully logged into Kumo-Anime.`);
}

window.addEventListener('click', (e) => {
    const modal = document.getElementById('authModal');
    if (e.target === modal) closeAuthModal();
});
