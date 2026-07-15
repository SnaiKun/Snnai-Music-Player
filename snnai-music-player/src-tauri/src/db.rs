use rusqlite::{Connection, Result as SqlResult};
use tauri::Manager;
use crate::{Playlist, Track, Artist};

/// Open (or create) the SQLite database in the app's data directory.
pub fn get_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Cannot get app data dir: {}", e))?;

    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Cannot create app data dir: {}", e))?;

    let db_path = app_dir.join("snnai.db");
    Connection::open(db_path).map_err(|e| format!("DB open error: {}", e))
}

/// Create all tables if they don't already exist.
pub fn initialize_schema(db: &Connection) -> SqlResult<()> {
    db.execute_batch("
        PRAGMA journal_mode=WAL;
        PRAGMA foreign_keys=ON;

        CREATE TABLE IF NOT EXISTS playlists (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT    NOT NULL,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS playlist_tracks (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
            track_id    TEXT NOT NULL,
            title       TEXT NOT NULL,
            artist      TEXT NOT NULL,
            album       TEXT NOT NULL,
            artwork_url TEXT NOT NULL,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            preview_url TEXT,
            genre_name  TEXT,
            position    INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS recent_searches (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            query      TEXT    NOT NULL UNIQUE,
            searched_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS play_history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            track_id    TEXT NOT NULL,
            title       TEXT NOT NULL,
            artist      TEXT NOT NULL,
            album       TEXT NOT NULL,
            artwork_url TEXT NOT NULL,
            duration_ms INTEGER NOT NULL DEFAULT 0,
            preview_url TEXT,
            genre_name  TEXT,
            played_at   INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS track_youtube_cache (
            track_id    TEXT PRIMARY KEY,
            youtube_url TEXT NOT NULL,
            cached_at   INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS favorite_artists (
            artist_id   TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            genre       TEXT,
            favorited_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    ")?;

    // Schema migrations for existing databases that were created before these columns were added.
    let _ = db.execute("ALTER TABLE playlist_tracks ADD COLUMN preview_url TEXT", []);
    let _ = db.execute("ALTER TABLE playlist_tracks ADD COLUMN genre_name TEXT", []);
    let _ = db.execute("ALTER TABLE playlist_tracks ADD COLUMN position INTEGER NOT NULL DEFAULT 0", []);

    Ok(())
}

// ─── Playlist CRUD ─────────────────────────────────────────────────────────────

pub fn get_all_playlists(db: &Connection) -> Result<Vec<Playlist>, String> {
    let mut stmt = db
        .prepare("SELECT id, name FROM playlists ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let playlist_rows: Vec<(i64, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut playlists = Vec::new();
    for (id, name) in playlist_rows {
        let tracks = get_playlist_tracks(db, id)?;
        playlists.push(Playlist { id, name, tracks });
    }
    Ok(playlists)
}

pub fn get_playlist_tracks(db: &Connection, playlist_id: i64) -> Result<Vec<Track>, String> {
    let mut stmt = db
        .prepare(
            "SELECT track_id, title, artist, album, artwork_url, duration_ms, preview_url, genre_name
             FROM playlist_tracks WHERE playlist_id = ?1 ORDER BY position ASC",
        )
        .map_err(|e| e.to_string())?;

    let tracks = stmt
        .query_map([playlist_id], |row| {
            Ok(Track {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                album: row.get(3)?,
                artwork_url: row.get(4)?,
                duration_ms: row.get::<_, i64>(5)? as u64,
                preview_url: row.get::<_, Option<String>>(6)?,
                genre_name: row.get::<_, Option<String>>(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(tracks)
}

pub fn create_playlist(db: &Connection, name: &str) -> Result<i64, String> {
    db.execute("INSERT INTO playlists (name) VALUES (?1)", [name])
        .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

pub fn delete_playlist(db: &Connection, playlist_id: i64) -> Result<(), String> {
    db.execute("DELETE FROM playlists WHERE id = ?1", [playlist_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_track_to_playlist(
    db: &Connection,
    playlist_id: i64,
    track: &Track,
) -> Result<(), String> {
    // Get current max position
    let pos: i64 = db
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM playlist_tracks WHERE playlist_id = ?1",
            [playlist_id],
            |row| row.get(0),
        )
        .unwrap_or(-1)
        + 1;

    db.execute(
        "INSERT OR IGNORE INTO playlist_tracks
         (playlist_id, track_id, title, artist, album, artwork_url, duration_ms, preview_url, genre_name, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        rusqlite::params![
            playlist_id,
            track.id,
            track.title,
            track.artist,
            track.album,
            track.artwork_url,
            track.duration_ms as i64,
            track.preview_url,
            track.genre_name,
            pos,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn remove_track_from_playlist(
    db: &Connection,
    playlist_id: i64,
    track_id: &str,
) -> Result<(), String> {
    db.execute(
        "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
        rusqlite::params![playlist_id, track_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Recent Searches ──────────────────────────────────────────────────────────

pub fn get_recent_searches(db: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = db
        .prepare("SELECT query FROM recent_searches ORDER BY searched_at DESC LIMIT 20")
        .map_err(|e| e.to_string())?;

    let searches = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(searches)
}

pub fn save_search(db: &Connection, query: &str) -> Result<(), String> {
    db.execute(
        "INSERT INTO recent_searches (query) VALUES (?1)
         ON CONFLICT(query) DO UPDATE SET searched_at = strftime('%s', 'now')",
        [query],
    )
    .map_err(|e| e.to_string())?;

    // Keep only 50 most recent
    db.execute(
        "DELETE FROM recent_searches WHERE id NOT IN (
             SELECT id FROM recent_searches ORDER BY searched_at DESC LIMIT 50
         )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ─── Play History & YouTube Caching ───────────────────────────────────────────

pub fn get_cached_youtube_url(db: &Connection, track_id: &str) -> Result<Option<String>, String> {
    let mut stmt = db
        .prepare("SELECT youtube_url FROM track_youtube_cache WHERE track_id = ?1")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query([track_id]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let url: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(url))
    } else {
        Ok(None)
    }
}

pub fn cache_youtube_url(db: &Connection, track_id: &str, youtube_url: &str) -> Result<(), String> {
    db.execute(
        "INSERT OR REPLACE INTO track_youtube_cache (track_id, youtube_url) VALUES (?1, ?2)",
        [track_id, youtube_url],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn record_play(db: &Connection, track: &Track) -> Result<(), String> {
    db.execute(
        "INSERT INTO play_history
         (track_id, title, artist, album, artwork_url, duration_ms, preview_url, genre_name)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            track.id,
            track.title,
            track.artist,
            track.album,
            track.artwork_url,
            track.duration_ms as i64,
            track.preview_url,
            track.genre_name,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Keep only the 100 most recent plays to prevent database bloat
    db.execute(
        "DELETE FROM play_history WHERE id NOT IN (
             SELECT id FROM play_history ORDER BY played_at DESC LIMIT 100
         )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn get_favorite_artists(db: &Connection, limit: u32) -> Result<Vec<String>, String> {
    let mut stmt = db
        .prepare(
            "SELECT artist, COUNT(*) as play_count 
             FROM play_history 
             WHERE artist IS NOT NULL AND artist != ''
             GROUP BY artist 
             ORDER BY play_count DESC 
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let artists = stmt
        .query_map([limit], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(artists)
}

pub fn get_favorite_genres(db: &Connection, limit: u32) -> Result<Vec<String>, String> {
    let mut stmt = db
        .prepare(
            "SELECT genre_name, COUNT(*) as play_count 
             FROM play_history 
             WHERE genre_name IS NOT NULL AND genre_name != ''
             GROUP BY genre_name 
             ORDER BY play_count DESC 
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let genres = stmt
        .query_map([limit], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(genres)
}

pub fn get_recent_played_track_ids(db: &Connection, limit: u32) -> Result<Vec<String>, String> {
    let mut stmt = db
        .prepare(
            "SELECT DISTINCT track_id 
             FROM play_history 
             ORDER BY played_at DESC 
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let track_ids = stmt
        .query_map([limit], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(track_ids)
}

// ─── Favorite Artists ──────────────────────────────────────────────────────────

pub fn toggle_favorite_artist(
    db: &Connection,
    artist_id: &str,
    name: &str,
    genre: Option<&str>,
) -> Result<bool, String> {
    let exists: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM favorite_artists WHERE artist_id = ?1)",
            [artist_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if exists {
        db.execute("DELETE FROM favorite_artists WHERE artist_id = ?1", [artist_id])
            .map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        db.execute(
            "INSERT INTO favorite_artists (artist_id, name, genre) VALUES (?1, ?2, ?3)",
            rusqlite::params![artist_id, name, genre],
        )
        .map_err(|e| e.to_string())?;
        Ok(true)
    }
}

pub fn is_artist_favorited(db: &Connection, artist_id: &str) -> Result<bool, String> {
    let exists: bool = db
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM favorite_artists WHERE artist_id = ?1)",
            [artist_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(exists)
}

pub fn get_favorite_artists_list(db: &Connection) -> Result<Vec<Artist>, String> {
    let mut stmt = db
        .prepare("SELECT artist_id, name, genre FROM favorite_artists ORDER BY favorited_at DESC")
        .map_err(|e| e.to_string())?;

    let artists = stmt
        .query_map([], |row| {
            Ok(Artist {
                id: row.get(0)?,
                name: row.get(1)?,
                genre: row.get::<_, Option<String>>(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(artists)
}

pub fn get_favorite_artists_names(db: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = db
        .prepare("SELECT name FROM favorite_artists")
        .map_err(|e| e.to_string())?;

    let names = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(names)
}

pub fn get_setting(db: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = db
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query([key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let val: String = row.get(0).map_err(|e| e.to_string())?;
        Ok(Some(val))
    } else {
        Ok(None)
    }
}

pub fn save_setting(db: &Connection, key: &str, value: &str) -> Result<(), String> {
    db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        [key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
