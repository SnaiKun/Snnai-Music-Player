// Shared TypeScript types for the Snnai Music Player

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  durationMs: number;
  previewUrl?: string;
  genreName?: string;
}

export interface Playlist {
  id: number;
  name: string;
  tracks: Track[];
}

export type RepeatMode = 'none' | 'one' | 'all';

export interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  volume: number;         // 0–1
  progress: number;       // seconds
  duration: number;       // seconds
  isSeeking: boolean;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  streamUrl: string | null;
  isLoadingStream: boolean;
  streamError: string | null;
  injectAndPlay: (track: Track) => void;
  prefetchedStream: { trackId: string; url: string; expiresAt: number } | null;
  isKaraokeMode: boolean;
  karaokeState: 'idle' | 'decoding' | 'processing' | 'ready' | 'error';
  originalStreamUrl: string | null;
  processedStreamUrl: string | null;
  processedTrackId: string | null;
}

export interface AppState {
  playlists: Playlist[];
  activeView: 'search' | 'playlist' | 'library';
  activePlaylistId: number | null;
  recentSearches: string[];
  isYtdlpAvailable: boolean;
  ytdlpVersion: string | null;
  isQueueOpen: boolean;
  isLyricsOpen: boolean;
  selectedArtist: Artist | null;
  selectedAlbum: Album | null;
  soundcloudClientId: string | null;
  soundcloudClientSecret: string | null;
  isAutoplayEnabled: boolean;
}

// ─── Lyrics ───────────────────────────────────────────────────────────────────

/** A single line of synced lyrics with its timestamp */
export interface LyricLine {
  timeMs: number;   // milliseconds from track start
  text: string;
}

export interface LyricsState {
  plainLyrics: string | null;
  syncedLyrics: LyricLine[] | null;
  romanizedPlainLyrics: string | null;
  romanizedSyncedLyrics: LyricLine[] | null;
  isRomanized: boolean;
  isLoading: boolean;
  error: string | null;
  trackId: string | null;  // which track these lyrics belong to
}

// ─── Recommendations ─────────────────────────────────────────────────────────

export interface Recommendations {
  moreByArtist: Track[];
  similarGenre: Track[];
}

// ─── Search Results ──────────────────────────────────────────────────────────

export interface Album {
  id: string;
  name: string;
  artist: string;
  artworkUrl: string;
  trackCount: number;
  genre?: string;
}

export interface Artist {
  id: string;
  name: string;
  genre?: string;
}

export interface SearchResults {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
}

