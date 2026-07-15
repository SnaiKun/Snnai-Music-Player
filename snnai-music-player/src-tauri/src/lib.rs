use std::process::Command as StdCommand;
use tauri_plugin_shell::ShellExt;
use serde::{Deserialize, Serialize};
use tauri::Manager;
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

mod db;

// ─── Data Types ────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub artwork_url: String,
    pub duration_ms: u64,
    pub preview_url: Option<String>,
    pub genre_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub tracks: Vec<Track>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LyricsResponse {
    pub plain_lyrics: Option<String>,
    pub synced_lyrics: Option<String>,
    pub track_name: String,
    pub artist_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Album {
    pub id: String,
    pub name: String,
    pub artist: String,
    pub artwork_url: String,
    pub track_count: u32,
    pub genre: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Artist {
    pub id: String,
    pub name: String,
    pub genre: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub tracks: Vec<Track>,
    pub albums: Vec<Album>,
    pub artists: Vec<Artist>,
}

// ─── iTunes Search ─────────────────────────────────────────────────────────────

/// Search iTunes API for tracks matching `query`. Returns up to `limit` results.
#[tauri::command]
async fn search_tracks(query: String, limit: u32) -> Result<Vec<Track>, String> {
    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit={}",
        urlencoding::encode(&query),
        limit.min(50)
    );
    fetch_itunes_tracks(&url).await
}

async fn fetch_itunes_tracks(url: &str) -> Result<Vec<Track>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp: serde_json::Value = client
        .get(url)
        .header("User-Agent", "SnnaiMusicPlayer/0.1")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let results = resp["results"]
        .as_array()
        .ok_or("No results array in response")?;

    Ok(results.iter().filter_map(parse_itunes_track).collect())
}

fn parse_itunes_track(item: &serde_json::Value) -> Option<Track> {
    let track_id = item["trackId"].as_u64()?.to_string();
    let title = item["trackName"].as_str()?.to_string();
    let artist = item["artistName"].as_str()?.to_string();
    let album = item["collectionName"].as_str().unwrap_or("Unknown Album").to_string();
    let duration_ms = item["trackTimeMillis"].as_u64().unwrap_or(0);
    let preview_url = item["previewUrl"].as_str().map(String::from);
    let genre_name = item["primaryGenreName"].as_str().map(String::from);

    // iTunes returns 100x100 artwork; upgrade to 600x600
    let artwork_url = item["artworkUrl100"]
        .as_str()
        .unwrap_or("")
        .replace("100x100bb", "600x600bb")
        .to_string();

    Some(Track {
        id: track_id,
        title,
        artist,
        album,
        artwork_url,
        duration_ms,
        preview_url,
        genre_name,
    })
}

fn parse_itunes_album(item: &serde_json::Value) -> Option<Album> {
    let id = item["collectionId"].as_u64()?.to_string();
    let name = item["collectionName"].as_str()?.to_string();
    let artist = item["artistName"].as_str()?.to_string();

    let artwork_url = item["artworkUrl100"]
        .as_str()
        .unwrap_or("")
        .replace("100x100bb", "600x600bb")
        .to_string();

    let track_count = item["trackCount"].as_u64().unwrap_or(0) as u32;
    let genre = item["primaryGenreName"].as_str().map(String::from);

    Some(Album {
        id,
        name,
        artist,
        artwork_url,
        track_count,
        genre,
    })
}

fn parse_itunes_artist(item: &serde_json::Value) -> Option<Artist> {
    let id = item["artistId"].as_u64()?.to_string();
    let name = item["artistName"].as_str()?.to_string();
    let genre = item["primaryGenreName"].as_str().map(String::from);

    Some(Artist {
        id,
        name,
        genre,
    })
}

async fn fetch_itunes_albums(url: &str) -> Result<Vec<Album>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp: serde_json::Value = client
        .get(url)
        .header("User-Agent", "SnnaiMusicPlayer/0.1")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let results = resp["results"]
        .as_array()
        .ok_or("No results array in response")?;

    Ok(results.iter().filter_map(parse_itunes_album).collect())
}

async fn fetch_itunes_artists(url: &str) -> Result<Vec<Artist>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let resp: serde_json::Value = client
        .get(url)
        .header("User-Agent", "SnnaiMusicPlayer/0.1")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    let results = resp["results"]
        .as_array()
        .ok_or("No results array in response")?;

    Ok(results.iter().filter_map(parse_itunes_artist).collect())
}

#[tauri::command]
async fn search_all(app: tauri::AppHandle, query: String) -> Result<SearchResults, String> {
    let tracks_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=30",
        urlencoding::encode(&query)
    );
    let albums_url = format!(
        "https://itunes.apple.com/search?term={}&entity=album&limit=15",
        urlencoding::encode(&query)
    );
    let artists_url = format!(
        "https://itunes.apple.com/search?term={}&entity=musicArtist&limit=6",
        urlencoding::encode(&query)
    );

    let (tracks_res, albums_res, artists_res, sc_tracks_res) = tokio::join!(
        fetch_itunes_tracks(&tracks_url),
        fetch_itunes_albums(&albums_url),
        fetch_itunes_artists(&artists_url),
        search_soundcloud(app, query.clone(), 15),
    );

    let mut tracks = tracks_res.unwrap_or_default();
    let albums = albums_res.unwrap_or_default();
    let artists = artists_res.unwrap_or_default();

    if let Ok(sc_tracks) = sc_tracks_res {
        tracks.extend(sc_tracks);
    }

    Ok(SearchResults {
        tracks,
        albums,
        artists,
    })
}

#[tauri::command]
async fn lookup_album(album_id: String) -> Result<Vec<Track>, String> {
    let url = format!(
        "https://itunes.apple.com/lookup?id={}&entity=song",
        album_id
    );
    fetch_itunes_tracks(&url).await
}

#[tauri::command]
async fn lookup_artist(artist_id: String) -> Result<Vec<Track>, String> {
    let url = format!(
        "https://itunes.apple.com/lookup?id={}&entity=song&limit=30",
        artist_id
    );
    fetch_itunes_tracks(&url).await
}

static SOUNDCLOUD_TOKEN_CACHE: std::sync::Mutex<Option<(String, std::time::Instant, std::time::Duration)>> = std::sync::Mutex::new(None);

async fn get_soundcloud_token(client_id: &str, client_secret: &str) -> Result<String, String> {
    // Check if token exists in cache and is still valid
    {
        let cache = SOUNDCLOUD_TOKEN_CACHE.lock().unwrap();
        if let Some((token, created_at, expires_in)) = &*cache {
            if created_at.elapsed() < *expires_in - std::time::Duration::from_secs(60) {
                return Ok(token.clone());
            }
        }
    }

    // Otherwise, retrieve a new token
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let params = [
        ("grant_type", "client_credentials"),
    ];

    let resp = client.post("https://secure.soundcloud.com/oauth/token")
        .basic_auth(client_id, Some(client_secret))
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Network error during authentication: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("SoundCloud token exchange failed ({}): {}", status, body));
    }

    let data: serde_json::Value = resp.json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    let access_token = data["access_token"].as_str()
        .ok_or_else(|| "No access_token field in response".to_string())?
        .to_string();

    let expires_in_secs = data["expires_in"].as_u64().unwrap_or(3600);
    let expires_in = std::time::Duration::from_secs(expires_in_secs);

    // Save token in cache
    {
        let mut cache = SOUNDCLOUD_TOKEN_CACHE.lock().unwrap();
        *cache = Some((access_token.clone(), std::time::Instant::now(), expires_in));
    }

    Ok(access_token)
}

async fn search_soundcloud_ytdlp(app: tauri::AppHandle, query: String, limit: u32) -> Result<Vec<Track>, String> {
    let limit_val = limit.min(30);
    let search_term = format!("scsearch{}:{}", limit_val, query);

    let output = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--flat-playlist",
            "--dump-json",
            "--no-playlist",
            "--no-warnings",
            &search_term,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp sidecar: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp SoundCloud error: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let db = db::get_db(&app)?;

    let mut tracks = Vec::new();
    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }

        let val: serde_json::Value = match serde_json::from_str(line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let id_str = val["id"].as_str()
            .map(|s| s.to_string())
            .or_else(|| val["id"].as_i64().map(|n| n.to_string()))
            .unwrap_or_default();

        if id_str.is_empty() {
            continue;
        }

        let id = format!("soundcloud:{}", id_str);
        let title = val["title"].as_str().unwrap_or("").to_string();
        let artist = val["uploader"].as_str().unwrap_or("").to_string();
        let duration_sec = val["duration"].as_f64().unwrap_or(0.0);
        let duration_ms = (duration_sec * 1000.0) as u64;
        let webpage_url = val["webpage_url"].as_str().unwrap_or("").to_string();

        // Extract high-res artwork from thumbnails list
        let mut artwork_url = String::new();
        if let Some(thumbnails) = val["thumbnails"].as_array() {
            // First search for t300x300 (ideal size) or large
            for thumb in thumbnails {
                if let Some(thumb_id) = thumb["id"].as_str() {
                    if thumb_id == "t300x300" {
                        if let Some(url) = thumb["url"].as_str() {
                            artwork_url = url.to_string();
                            break;
                        }
                    }
                }
            }
            // Fallback: search for "large" or standard thumbnail
            if artwork_url.is_empty() {
                for thumb in thumbnails {
                    if let Some(thumb_id) = thumb["id"].as_str() {
                        if thumb_id == "large" {
                            if let Some(url) = thumb["url"].as_str() {
                                artwork_url = url.to_string();
                                break;
                            }
                        }
                    }
                }
            }
            // Fallback: use last item
            if artwork_url.is_empty() && !thumbnails.is_empty() {
                if let Some(url) = thumbnails.last().and_then(|t| t["url"].as_str()) {
                    artwork_url = url.to_string();
                }
            }
        }

        // Final SVG fallback if no artwork URL was extracted
        if artwork_url.is_empty() {
            artwork_url = "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" fill=\"%23ff5500\"/><path d=\"M20,60 C20,50 30,40 40,40 C45,40 50,45 55,50 C60,40 70,40 75,50 C80,45 90,50 90,60 C90,70 80,70 20,70 Z\" fill=\"white\"/></svg>".to_string();
        }

        // Cache webpage URL for playback
        if !webpage_url.is_empty() {
            let _ = db::cache_youtube_url(&db, &id, &webpage_url);
        }

        tracks.push(Track {
            id,
            title,
            artist,
            album: "SoundCloud".to_string(),
            artwork_url,
            duration_ms,
            preview_url: Some(webpage_url),
            genre_name: Some("SoundCloud".to_string()),
        });
    }

    Ok(tracks)
}

async fn search_soundcloud_api(
    app: tauri::AppHandle,
    query: &str,
    limit: u32,
    client_id: &str,
    client_secret: &str,
) -> Result<Vec<Track>, String> {
    let token = get_soundcloud_token(client_id, client_secret).await?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!(
        "https://api.soundcloud.com/tracks?q={}&limit={}&linked_partitioning=true&access=playable",
        urlencoding::encode(query),
        limit.min(50)
    );

    let resp = client.get(&url)
        .header("Authorization", format!("OAuth {}", token))
        .header("User-Agent", "SnnaiMusicPlayer/0.1")
        .send()
        .await
        .map_err(|e| format!("SoundCloud API search network error: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("SoundCloud API search failed ({}): {}", status, body));
    }

    let data: serde_json::Value = resp.json()
        .await
        .map_err(|e| format!("Failed to parse SoundCloud search response: {}", e))?;

    let collection = data["collection"].as_array()
        .ok_or_else(|| "Missing collection array in SoundCloud response".to_string())?;

    let db = db::get_db(&app)?;

    let mut tracks = Vec::new();
    for item in collection {
        let id_num = match item["id"].as_i64() {
            Some(n) => n,
            None => continue,
        };
        let id_str = id_num.to_string();
        let id = format!("soundcloud:{}", id_str);
        
        let title = item["title"].as_str().unwrap_or("").to_string();
        
        let artist = item["user"]["username"].as_str()
            .or_else(|| item["user"]["permalink"].as_str())
            .unwrap_or("Unknown Artist")
            .to_string();
            
        let duration_ms = item["duration"].as_u64().unwrap_or(0);
        let permalink_url = item["permalink_url"].as_str().unwrap_or("").to_string();
        let genre_name = item["genre"].as_str().map(|s| s.to_string());

        // Process high-res artwork URL
        let mut artwork_url = item["artwork_url"].as_str()
            .or_else(|| item["user"]["avatar_url"].as_str())
            .unwrap_or("")
            .to_string();

        if !artwork_url.is_empty() {
            if artwork_url.contains("-large.jpg") {
                artwork_url = artwork_url.replace("-large.jpg", "-t300x300.jpg");
            }
        } else {
            artwork_url = "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" fill=\"%23ff5500\"/><path d=\"M20,60 C20,50 30,40 40,40 C45,40 50,45 55,50 C60,40 70,40 75,50 C80,45 90,50 90,60 C90,70 80,70 20,70 Z\" fill=\"white\"/></svg>".to_string();
        }

        // Cache permalink_url in track_youtube_cache table for yt-dlp playback
        if !permalink_url.is_empty() {
            let _ = db::cache_youtube_url(&db, &id, &permalink_url);
        }

        tracks.push(Track {
            id,
            title,
            artist,
            album: "SoundCloud".to_string(),
            artwork_url,
            duration_ms,
            preview_url: Some(permalink_url),
            genre_name: Some(genre_name.unwrap_or_else(|| "SoundCloud".to_string())),
        });
    }

    Ok(tracks)
}

#[tauri::command]
async fn save_soundcloud_credentials(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    let db = db::get_db(&app)?;
    db::save_setting(&db, "soundcloud_client_id", &client_id)?;
    db::save_setting(&db, "soundcloud_client_secret", &client_secret)?;
    Ok(())
}

#[tauri::command]
async fn get_soundcloud_credentials(
    app: tauri::AppHandle,
) -> Result<Option<(String, String)>, String> {
    let db = db::get_db(&app)?;
    let client_id = db::get_setting(&db, "soundcloud_client_id")?.unwrap_or_default();
    let client_secret = db::get_setting(&db, "soundcloud_client_secret")?.unwrap_or_default();
    if client_id.is_empty() || client_secret.is_empty() {
        Ok(None)
    } else {
        Ok(Some((client_id, client_secret)))
    }
}

#[tauri::command]
async fn search_soundcloud(
    app: tauri::AppHandle,
    query: String,
    limit: u32,
) -> Result<Vec<Track>, String> {
    let db = db::get_db(&app)?;
    let client_id = db::get_setting(&db, "soundcloud_client_id")?.unwrap_or_default();
    let client_secret = db::get_setting(&db, "soundcloud_client_secret")?.unwrap_or_default();

    if client_id.is_empty() || client_secret.is_empty() {
        return search_soundcloud_ytdlp(app, query, limit).await;
    }

    match search_soundcloud_api(app.clone(), &query, limit, &client_id, &client_secret).await {
        Ok(tracks) => Ok(tracks),
        Err(e) => {
            eprintln!("SoundCloud official API search failed ({}), falling back to yt-dlp search", e);
            search_soundcloud_ytdlp(app, query, limit).await
        }
    }
}

#[tauri::command]
async fn test_soundcloud_credentials(client_id: String, client_secret: String) -> Result<(), String> {
    let cid = client_id.trim().to_string();
    let csecret = client_secret.trim().to_string();
    if cid.is_empty() || csecret.is_empty() {
        return Err("Credentials cannot be empty".to_string());
    }
    let _token = get_soundcloud_token(&cid, &csecret).await?;
    Ok(())
}

// ─── Recommendations ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recommendations {
    pub more_by_artist: Vec<Track>,
    pub similar_genre: Vec<Track>,
}

/// Fetch recommendations: more tracks by the same artist + tracks in the same genre.
/// Both use the iTunes Search API — no API key required.
#[tauri::command]
async fn get_recommendations(
    artist: String,
    genre: String,
    exclude_id: String,
) -> Result<Recommendations, String> {
    // Run both requests in parallel
    let artist_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=12",
        urlencoding::encode(&artist)
    );
    let genre_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=15",
        urlencoding::encode(&format!("{} popular", genre))
    );

    let (artist_result, genre_result) = tokio::join!(
        fetch_itunes_tracks(&artist_url),
        fetch_itunes_tracks(&genre_url),
    );

    let more_by_artist = artist_result
        .unwrap_or_default()
        .into_iter()
        .filter(|t| t.id != exclude_id)
        .take(10)
        .collect();

    let similar_genre = genre_result
        .unwrap_or_default()
        .into_iter()
        .filter(|t| t.id != exclude_id && t.artist != artist)
        .take(10)
        .collect();

    Ok(Recommendations { more_by_artist, similar_genre })
}

// ─── Lyrics ───────────────────────────────────────────────────────────────────

/// Fetch lyrics from LRCLIB (free, no API key).
/// Returns both plain text and synced LRC lyrics when available.
#[tauri::command]
async fn get_lyrics(
    artist: String,
    title: String,
    album: String,
    duration_secs: u64,
) -> Result<LyricsResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    // Try exact match first (with duration for accuracy)
    let url = format!(
        "https://lrclib.net/api/get?artist_name={}&track_name={}&album_name={}&duration={}",
        urlencoding::encode(&artist),
        urlencoding::encode(&title),
        urlencoding::encode(&album),
        duration_secs,
    );

    let response = client
        .get(&url)
        .header("User-Agent", "SnnaiMusicPlayer/0.1 (https://github.com/snnai/music-player)")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if response.status() == 404 {
        // Fallback: search without album/duration
        let fallback_url = format!(
            "https://lrclib.net/api/search?artist_name={}&track_name={}",
            urlencoding::encode(&artist),
            urlencoding::encode(&title),
        );

        let fallback_resp = client
            .get(&fallback_url)
            .header("User-Agent", "SnnaiMusicPlayer/0.1 (https://github.com/snnai/music-player)")
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;

        if !fallback_resp.status().is_success() {
            return Err("No lyrics found".to_string());
        }

        let results: serde_json::Value = fallback_resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        let first = results
            .as_array()
            .and_then(|arr| arr.first())
            .ok_or("No lyrics found")?;

        return Ok(LyricsResponse {
            plain_lyrics: first["plainLyrics"].as_str().map(String::from),
            synced_lyrics: first["syncedLyrics"].as_str().map(String::from),
            track_name: first["trackName"].as_str().unwrap_or(&title).to_string(),
            artist_name: first["artistName"].as_str().unwrap_or(&artist).to_string(),
        });
    }

    if !response.status().is_success() {
        return Err(format!("LRCLIB error: {}", response.status()));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    Ok(LyricsResponse {
        plain_lyrics: data["plainLyrics"].as_str().map(String::from),
        synced_lyrics: data["syncedLyrics"].as_str().map(String::from),
        track_name: data["trackName"].as_str().unwrap_or(&title).to_string(),
        artist_name: data["artistName"].as_str().unwrap_or(&artist).to_string(),
    })
}

// ─── Audio Extraction ─────────────────────────────────────────────────────────

async fn run_ytdlp_search(app: &tauri::AppHandle, query: &str) -> Result<(String, String), String> {
    let search_term = format!("ytsearch1:{}", query);
    println!("[DEBUG] run_ytdlp_search query='{}' search_term='{}'", query, search_term);

    let output = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--print", "webpage_url",
            "--get-url",
            "-f", "bestaudio[ext=m4a]/bestaudio/best",
            "--no-playlist",
            "--no-warnings",
            &search_term,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp sidecar: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    println!("[DEBUG] run_ytdlp_search status={:?} stdout='{}' stderr='{}'", output.status, stdout, stderr);

    if !output.status.success() {
        return Err(format!("yt-dlp search error: {}", stderr));
    }

    let mut lines = stdout.lines().map(|l| l.trim()).filter(|l| !l.is_empty());
    let webpage_url = lines.next().unwrap_or("").to_string();
    let stream_url = lines.next().unwrap_or("").to_string();

    if webpage_url.is_empty() || stream_url.is_empty() {
        return Err("No valid stream URL found during search.".to_string());
    }

    Ok((webpage_url, stream_url))
}

async fn run_soundcloud_search_single(app: &tauri::AppHandle, query: &str) -> Result<(String, String), String> {
    let search_term = format!("scsearch1:{}", query);
    println!("[DEBUG] run_soundcloud_search_single query='{}' search_term='{}'", query, search_term);

    let output = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--print", "webpage_url",
            "--get-url",
            "-f", "bestaudio/best",
            "--no-playlist",
            "--no-warnings",
            &search_term,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp sidecar: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    println!("[DEBUG] run_soundcloud_search_single status={:?} stdout='{}' stderr='{}'", output.status, stdout, stderr);

    if !output.status.success() {
        return Err(format!("yt-dlp SoundCloud search error: {}", stderr));
    }

    let mut lines = stdout.lines().map(|l| l.trim()).filter(|l| !l.is_empty());
    let webpage_url = lines.next().unwrap_or("").to_string();
    let stream_url = lines.next().unwrap_or("").to_string();

    if webpage_url.is_empty() || stream_url.is_empty() {
        return Err("No valid SoundCloud stream URL found during search.".to_string());
    }

    Ok((webpage_url, stream_url))
}

async fn run_ytdlp_for_url(app: &tauri::AppHandle, url: &str) -> Result<String, String> {
    let output = app.shell().sidecar("yt-dlp")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--get-url",
            "-f", "bestaudio[ext=m4a]/bestaudio/best",
            "--no-playlist",
            "--no-warnings",
            url,
        ])
        .output()
        .await
        .map_err(|e| format!("Failed to run yt-dlp sidecar: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp fetch error: {}", stderr.trim()));
    }

    let stream_url = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stream_url.is_empty() {
        return Err("No valid stream URL found for direct url.".to_string());
    }

    Ok(stream_url)
}

async fn run_soundcloud_search_single_smart(app: &tauri::AppHandle, query: &str) -> Result<(String, String), String> {
    let db = db::get_db(app)?;
    let client_id = db::get_setting(&db, "soundcloud_client_id")?.unwrap_or_default();
    let client_secret = db::get_setting(&db, "soundcloud_client_secret")?.unwrap_or_default();

    if !client_id.is_empty() && !client_secret.is_empty() {
        // We have credentials! Let's do a fast search using the official API
        match search_soundcloud_api(app.clone(), query, 1, &client_id, &client_secret).await {
            Ok(tracks) => {
                if let Some(track) = tracks.first() {
                    // We found a track! Now resolve its stream URL using yt-dlp on its cached permalink URL
                    let cached_url = db::get_cached_youtube_url(&db, &track.id)?;
                    if let Some(webpage_url) = cached_url {
                        match run_ytdlp_for_url(app, &webpage_url).await {
                            Ok(stream_url) => return Ok((webpage_url, stream_url)),
                            Err(e) => {
                                eprintln!("Failed to resolve stream URL for cached SoundCloud URL ({}): {}", webpage_url, e);
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Official SoundCloud API search fallback failed ({}), trying yt-dlp scraping", e);
            }
        }
    }

    // Otherwise, fallback to scraping
    run_soundcloud_search_single(app, query).await
}

/// Use yt-dlp to extract the best audio stream URL for `query`.
#[tauri::command]
async fn get_audio_url(app: tauri::AppHandle, track_id: String, query: String) -> Result<String, String> {
    let db = db::get_db(&app)?;

    // 1. Check SQLite cache
    let cached_url = db::get_cached_youtube_url(&db, &track_id)?;

    if let Some(youtube_url) = cached_url {
        // Fetch stream URL directly
        match run_ytdlp_for_url(&app, &youtube_url).await {
            Ok(stream_url) => return Ok(stream_url),
            Err(e) => {
                // If direct fetch fails (e.g. video was deleted/unavailable), fall back to search
                eprintln!("Direct URL fetch failed ({}), falling back to search: {}", youtube_url, e);
            }
        }
    }

    // 2. Perform search and get webpage_url + stream_url
    let (webpage_url, stream_url) = if track_id.starts_with("soundcloud:") {
        match run_soundcloud_search_single_smart(&app, &query).await {
            Ok(res) => res,
            Err(e) => {
                eprintln!("SoundCloud fallback search failed, trying YouTube: {}", e);
                run_ytdlp_search(&app, &query).await?
            }
        }
    } else {
        match run_ytdlp_search(&app, &query).await {
            Ok(res) => res,
            Err(e) => {
                eprintln!("YouTube search failed, trying SoundCloud fallback: {}", e);
                run_soundcloud_search_single_smart(&app, &query).await?
            }
        }
    };

    // 3. Cache the webpage_url
    if !webpage_url.is_empty() {
        let _ = db::cache_youtube_url(&db, &track_id, &webpage_url);
    }

    Ok(stream_url)
}

#[tauri::command]
async fn get_autoplay_recommendations(
    app: tauri::AppHandle,
    track_id: String,
    artist: String,
    genre: String,
) -> Result<Vec<Track>, String> {
    if track_id.starts_with("soundcloud:") {
        let db = db::get_db(&app)?;
        let client_id = db::get_setting(&db, "soundcloud_client_id")?.unwrap_or_default();
        let client_secret = db::get_setting(&db, "soundcloud_client_secret")?.unwrap_or_default();

        if !client_id.is_empty() && !client_secret.is_empty() {
            let numeric_id = track_id.replace("soundcloud:", "");
            let track_urn = format!("soundcloud:tracks:{}", numeric_id);

            let token = get_soundcloud_token(&client_id, &client_secret).await?;
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())?;

            let url = format!(
                "https://api.soundcloud.com/tracks/{}/related?limit=15&access=playable&linked_partitioning=true",
                track_urn
            );

            let resp = client.get(&url)
                .header("Authorization", format!("OAuth {}", token))
                .header("User-Agent", "SnnaiMusicPlayer/0.1")
                .send()
                .await
                .map_err(|e| format!("SoundCloud related tracks request failed: {}", e))?;

            if resp.status().is_success() {
                let data: serde_json::Value = resp.json()
                    .await
                    .map_err(|e| format!("Failed to parse related tracks response: {}", e))?;

                let collection = data["collection"].as_array()
                    .ok_or_else(|| "Missing collection".to_string())?;

                let mut tracks = Vec::new();
                for item in collection {
                    let id_num = match item["id"].as_i64() {
                        Some(n) => n,
                        None => continue,
                    };
                    let id_str = id_num.to_string();
                    let id = format!("soundcloud:{}", id_str);
                    
                    let title = item["title"].as_str().unwrap_or("").to_string();
                    let artist = item["user"]["username"].as_str()
                        .or_else(|| item["user"]["permalink"].as_str())
                        .unwrap_or("Unknown Artist")
                        .to_string();
                    let duration_ms = item["duration"].as_u64().unwrap_or(0);
                    let permalink_url = item["permalink_url"].as_str().unwrap_or("").to_string();
                    let genre_name = item["genre"].as_str().map(|s| s.to_string());

                    // Process high-res artwork URL
                    let mut artwork_url = item["artwork_url"].as_str()
                        .or_else(|| item["user"]["avatar_url"].as_str())
                        .unwrap_or("")
                        .to_string();

                    if !artwork_url.is_empty() {
                        if artwork_url.contains("-large.jpg") {
                            artwork_url = artwork_url.replace("-large.jpg", "-t300x300.jpg");
                        }
                    } else {
                        artwork_url = "data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\" fill=\"%23ff5500\"/><path d=\"M20,60 C20,50 30,40 40,40 C45,40 50,45 55,50 C60,40 70,40 75,50 C80,45 90,50 90,60 C90,70 80,70 20,70 Z\" fill=\"white\"/></svg>".to_string();
                    }

                    // Cache permalink_url in track_youtube_cache table for yt-dlp playback
                    if !permalink_url.is_empty() {
                        let _ = db::cache_youtube_url(&db, &id, &permalink_url);
                    }

                    tracks.push(Track {
                        id,
                        title,
                        artist,
                        album: "SoundCloud".to_string(),
                        artwork_url,
                        duration_ms,
                        preview_url: Some(permalink_url),
                        genre_name: Some(genre_name.unwrap_or_else(|| "SoundCloud".to_string())),
                    });
                }
                return Ok(tracks);
            }
        }
    }

    // Fallback: iTunes recommendations
    let artist_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=15",
        urlencoding::encode(&artist)
    );
    let genre_url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=20",
        urlencoding::encode(&format!("{} popular", genre))
    );

    let (artist_result, genre_result) = tokio::join!(
        fetch_itunes_tracks(&artist_url),
        fetch_itunes_tracks(&genre_url),
    );

    let mut recommended = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    if let Ok(tracks) = artist_result {
        for track in tracks {
            if track.id != track_id && !seen_ids.contains(&track.id) {
                seen_ids.insert(track.id.clone());
                recommended.push(track);
            }
        }
    }

    if let Ok(tracks) = genre_result {
        for track in tracks {
            if track.id != track_id && track.artist != artist && !seen_ids.contains(&track.id) {
                seen_ids.insert(track.id.clone());
                recommended.push(track);
            }
        }
    }

    recommended.truncate(15);
    Ok(recommended)
}

#[tauri::command]
async fn record_play_history(app: tauri::AppHandle, track: Track) -> Result<(), String> {
    let db = db::get_db(&app)?;
    db::record_play(&db, &track)?;
    Ok(())
}

#[tauri::command]
async fn fetch_audio_bytes(url: String) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url)
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .header("Accept-Encoding", "identity")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP error: {}", resp.status()));
    }

    let bytes = resp.bytes().await
        .map_err(|e| {
            eprintln!("[DEBUG] fetch_audio_bytes error: {:?}", e);
            format!("Failed to read response bytes: {:?}", e)
        })?;

    Ok(bytes.to_vec())
}

#[tauri::command]
async fn get_personalized_recommendations(
    app: tauri::AppHandle,
    limit: u32,
) -> Result<Vec<Track>, String> {
    let db = db::get_db(&app)?;

    // 1. Get favorite artists explicitly marked by the user
    let mut fav_artists_names = db::get_favorite_artists_names(&db)?;

    // 2. Get top played artists (up to 3) from history and append if not already present
    let history_artists = db::get_favorite_artists(&db, 3)?;
    for artist in history_artists {
        if !fav_artists_names.contains(&artist) {
            fav_artists_names.push(artist);
        }
    }

    // Limit the number of artists to query in parallel to prevent excessive API load (max 5)
    fav_artists_names.truncate(5);

    // 3. Get top genres (up to 2) from history
    let fav_genres = db::get_favorite_genres(&db, 2)?;

    // 4. Get recent play history to exclude
    let recent_ids = db::get_recent_played_track_ids(&db, 50)?;
    let mut seen_ids = std::collections::HashSet::new();
    for id in &recent_ids {
        seen_ids.insert(id.clone());
    }

    let mut recommended_tracks = Vec::new();

    // 5. Fetch tracks for favorite/history artists
    for artist in fav_artists_names {
        let artist_url = format!(
            "https://itunes.apple.com/search?term={}&entity=song&limit=12",
            urlencoding::encode(&artist)
        );
        if let Ok(tracks) = fetch_itunes_tracks(&artist_url).await {
            for track in tracks {
                if !seen_ids.contains(&track.id) {
                    seen_ids.insert(track.id.clone());
                    recommended_tracks.push(track);
                }
            }
        }
    }

    // 5. Fetch tracks for favorite genres
    for genre in fav_genres {
        let genre_url = format!(
            "https://itunes.apple.com/search?term={}&entity=song&limit=15",
            urlencoding::encode(&format!("{} popular", genre))
        );
        if let Ok(tracks) = fetch_itunes_tracks(&genre_url).await {
            for track in tracks {
                if !seen_ids.contains(&track.id) {
                    seen_ids.insert(track.id.clone());
                    recommended_tracks.push(track);
                }
            }
        }
    }

    // 6. Fallback if empty (e.g. no play history yet)
    if recommended_tracks.is_empty() {
        let fallback_queries = vec!["pop popular", "rock popular", "hits 2026"];
        for query in fallback_queries {
            let url = format!(
                "https://itunes.apple.com/search?term={}&entity=song&limit=10",
                urlencoding::encode(query)
            );
            if let Ok(tracks) = fetch_itunes_tracks(&url).await {
                for track in tracks {
                    if !seen_ids.contains(&track.id) {
                        seen_ids.insert(track.id.clone());
                        recommended_tracks.push(track);
                    }
                }
            }
        }
    }

    // 7. Fisher-Yates shuffle using SystemTime as seed
    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(42) as u64;

    let mut next_seed = seed;
    let mut random_index = || {
        next_seed = next_seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        next_seed
    };

    let len = recommended_tracks.len();
    if len > 1 {
        for i in (1..len).rev() {
            let j = (random_index() % (i as u64 + 1)) as usize;
            recommended_tracks.swap(i, j);
        }
    }

    recommended_tracks.truncate(limit as usize);
    Ok(recommended_tracks)
}

#[tauri::command]
async fn toggle_favorite_artist(
    app: tauri::AppHandle,
    artist_id: String,
    name: String,
    genre: Option<String>,
) -> Result<bool, String> {
    let db = db::get_db(&app)?;
    let new_state = db::toggle_favorite_artist(&db, &artist_id, &name, genre.as_deref())?;
    Ok(new_state)
}

#[tauri::command]
async fn is_artist_favorited(app: tauri::AppHandle, artist_id: String) -> Result<bool, String> {
    let db = db::get_db(&app)?;
    let favorited = db::is_artist_favorited(&db, &artist_id)?;
    Ok(favorited)
}

#[tauri::command]
async fn get_favorite_artists(app: tauri::AppHandle) -> Result<Vec<Artist>, String> {
    let db = db::get_db(&app)?;
    let artists = db::get_favorite_artists_list(&db)?;
    Ok(artists)
}

/// Check if yt-dlp is installed and return its version.
#[tauri::command]
async fn check_ytdlp(app: tauri::AppHandle) -> Result<String, String> {
    let output = app.shell().sidecar("yt-dlp")
        .map_err(|_| "Sidecar config error".to_string())?
        .arg("--version")
        .output()
        .await
        .map_err(|_| "yt-dlp sidecar not found".to_string())?;
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(version)
}

// ─── Playlist / DB Commands ────────────────────────────────────────────────────

#[tauri::command]
async fn get_playlists(app: tauri::AppHandle) -> Result<Vec<Playlist>, String> {
    let db = db::get_db(&app)?;
    db::get_all_playlists(&db)
}

#[tauri::command]
async fn create_playlist(app: tauri::AppHandle, name: String) -> Result<i64, String> {
    let db = db::get_db(&app)?;
    db::create_playlist(&db, &name)
}

#[tauri::command]
async fn delete_playlist(app: tauri::AppHandle, playlist_id: i64) -> Result<(), String> {
    let db = db::get_db(&app)?;
    db::delete_playlist(&db, playlist_id)
}

#[tauri::command]
async fn add_track_to_playlist(
    app: tauri::AppHandle,
    playlist_id: i64,
    track: Track,
) -> Result<(), String> {
    let db = db::get_db(&app)?;
    db::add_track_to_playlist(&db, playlist_id, &track)
}

#[tauri::command]
async fn remove_track_from_playlist(
    app: tauri::AppHandle,
    playlist_id: i64,
    track_id: String,
) -> Result<(), String> {
    let db = db::get_db(&app)?;
    db::remove_track_from_playlist(&db, playlist_id, &track_id)
}

#[tauri::command]
async fn get_recent_searches(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let db = db::get_db(&app)?;
    db::get_recent_searches(&db)
}

#[tauri::command]
async fn save_search(app: tauri::AppHandle, query: String) -> Result<(), String> {
    let db = db::get_db(&app)?;
    db::save_search(&db, &query)
}

// ─── App Entry Point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // ── SQLite setup ──────────────────────────────────────────────
            let db = db::get_db(app.handle())?;
            db::initialize_schema(&db).map_err(|e| e.to_string())?;

            // ── System Tray ───────────────────────────────────────────────
            #[cfg(desktop)]
            {
                let show_item = MenuItem::with_id(app, "show", "Show Snnai", true, None::<&str>)?;
                let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&show_item, &separator, &quit_item])?;

                let _tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .tooltip("Snnai Music Player")
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        });

    #[cfg(desktop)]
    {
        builder = builder.on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap_or(());
                api.prevent_close();
            }
        });
    }

    builder
        .invoke_handler(tauri::generate_handler![
            search_tracks,
            get_audio_url,
            get_lyrics,
            get_recommendations,
            check_ytdlp,
            get_playlists,
            create_playlist,
            delete_playlist,
            add_track_to_playlist,
            remove_track_from_playlist,
            get_recent_searches,
            save_search,
            record_play_history,
            fetch_audio_bytes,
            get_personalized_recommendations,
            search_all,
            lookup_album,
            lookup_artist,
            toggle_favorite_artist,
            is_artist_favorited,
            get_favorite_artists,
            search_soundcloud,
            test_soundcloud_credentials,
            save_soundcloud_credentials,
            get_soundcloud_credentials,
            get_autoplay_recommendations,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
