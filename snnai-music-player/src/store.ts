import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';
import { Track, Playlist, RepeatMode, PlayerState, AppState, LyricsState, LyricLine, Artist, Album } from './types';

// ─── Player Store ─────────────────────────────────────────────────────────────

interface PlayerStore extends PlayerState {
  setCurrentTrack: (track: Track) => void;
  setQueue: (tracks: Track[], startIndex?: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  jumpToQueueIndex: (index: number) => void;
  clearQueue: () => void;
  setPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setIsSeeking: (seeking: boolean) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  setStreamUrl: (url: string | null) => void;
  setLoadingStream: (loading: boolean) => void;
  setStreamError: (error: string | null) => void;
  playTrack: (track: Track, queue?: Track[]) => Promise<void>;
  next: () => void;
  previous: () => void;
  togglePlay: () => void;
  toggleRepeat: () => void;
  prefetchNextTrack: () => Promise<void>;
}

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: 0,
  isPlaying: false,
  volume: 0.8,
  progress: 0,
  duration: 0,
  isSeeking: false,
  repeatMode: 'none',
  isShuffle: false,
  streamUrl: null,
  isLoadingStream: false,
  streamError: null,
  prefetchedStream: null,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setQueue: (tracks, startIndex = 0) => set({ queue: tracks, queueIndex: startIndex }),
  addToQueue: (track) => set((s) => ({ queue: [...s.queue, track] })),

  removeFromQueue: (index) =>
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index);
      // Adjust queueIndex if needed
      let newIndex = s.queueIndex;
      if (index < s.queueIndex) newIndex = Math.max(0, s.queueIndex - 1);
      else if (index === s.queueIndex) newIndex = Math.min(newIndex, newQueue.length - 1);
      return { queue: newQueue, queueIndex: newIndex };
    }),

  jumpToQueueIndex: (index) => {
    const { queue, playTrack } = get();
    if (index >= 0 && index < queue.length) {
      set({ queueIndex: index });
      playTrack(queue[index]);
    }
  },

  clearQueue: () => set((s) => ({ queue: s.queue.slice(0, s.queueIndex + 1) })),

  setPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setIsSeeking: (seeking) => set({ isSeeking: seeking }),
  setRepeatMode: (mode) => set({ repeatMode: mode }),
  toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
  setStreamUrl: (url) => set({ streamUrl: url }),
  setLoadingStream: (loading) => set({ isLoadingStream: loading }),
  setStreamError: (error) => set({ streamError: error }),
  
  injectAndPlay: (track) => {
    set((s) => {
      // If it's already the current track, just do nothing
      if (s.queue[s.queueIndex]?.id === track.id) return {};
      const newQueue = [...s.queue];
      newQueue.splice(s.queueIndex + 1, 0, track);
      return { queue: newQueue, queueIndex: s.queueIndex + 1 };
    });
    get().playTrack(track);
  },

  playTrack: async (track, queue) => {
    if (queue) {
      const idx = queue.findIndex((t) => t.id === track.id);
      set({ queue, queueIndex: idx >= 0 ? idx : 0 });
    }
    set({
      currentTrack: track,
      isPlaying: false,
      streamUrl: null,
      isLoadingStream: true,
      streamError: null,
      progress: 0,
      duration: 0,
    });
    // Trigger lyrics fetch (deferred so useLyricsStore is always initialized)
    setTimeout(() => useLyricsStore.getState().fetchLyrics(track), 0);

    // Record play history in backend
    invoke('record_play_history', { track }).catch((e) => {
      console.error('Failed to record play history:', e);
    });

    try {
      // Check if we already have it prefetched
      const { prefetchedStream } = get();
      let url: string;
      if (prefetchedStream && prefetchedStream.trackId === track.id && prefetchedStream.expiresAt > Date.now()) {
        url = prefetchedStream.url;
        // Clear current prefetch
        set({ prefetchedStream: null });
      } else {
        const query = `${track.artist} - ${track.title}`;
        url = await invoke('get_audio_url', { trackId: track.id, query });
      }
      
      set({ streamUrl: url, isLoadingStream: false, isPlaying: true });
      
      // Prefetch the next track after a short delay
      setTimeout(() => {
        get().prefetchNextTrack().catch((e) => console.warn('Prefetch error:', e));
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ isLoadingStream: false, streamError: msg, isPlaying: false });
    }
  },

  next: async () => {
    const { queue, queueIndex, repeatMode, isShuffle, playTrack } = get();
    if (queue.length === 0) return;
    let nextIndex: number;
    if (repeatMode === 'one') {
      nextIndex = queueIndex;
    } else if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          // Autoplay fallback logic
          const { isAutoplayEnabled } = useAppStore.getState();
          const currentTrack = queue[queueIndex];
          if (isAutoplayEnabled && currentTrack) {
            set({ isLoadingStream: true });
            try {
              const recommendations: Track[] = await invoke('get_autoplay_recommendations', {
                trackId: currentTrack.id,
                artist: currentTrack.artist,
                genre: currentTrack.genreName || 'Pop',
              });

              if (recommendations && recommendations.length > 0) {
                const existingIds = new Set(queue.map((t) => t.id));
                const newTracks = recommendations.filter((t) => !existingIds.has(t.id));

                if (newTracks.length > 0) {
                  const updatedQueue = [...queue, ...newTracks];
                  set({ queue: updatedQueue, queueIndex: queue.length });
                  playTrack(newTracks[0]);
                  return;
                }
              }
            } catch (err) {
              console.error('Failed to get autoplay recommendations:', err);
            }
          }
          // Default behavior if autoplay is off or fails
          return;
        }
      }
    }
    set({ queueIndex: nextIndex });
    playTrack(queue[nextIndex]);
  },

  previous: () => {
    const { queue, queueIndex, progress, playTrack } = get();
    if (queue.length === 0) return;
    if (progress > 3) {
      set({ progress: 0 });
      playTrack(queue[queueIndex]);
      return;
    }
    const prevIndex = Math.max(0, queueIndex - 1);
    set({ queueIndex: prevIndex });
    playTrack(queue[prevIndex]);
  },

  togglePlay: () => {
    const { isPlaying, currentTrack, streamUrl, playTrack } = get();
    if (isPlaying) {
      set({ isPlaying: false });
    } else {
      if (currentTrack && !streamUrl) {
        playTrack(currentTrack);
      } else if (currentTrack) {
        set({ isPlaying: true });
      }
    }
  },
  toggleRepeat: () =>
    set((s) => {
      const modes: RepeatMode[] = ['none', 'all', 'one'];
      const next = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length];
      return { repeatMode: next };
    }),

  prefetchNextTrack: async () => {
    const { queue, queueIndex, repeatMode, isShuffle } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (repeatMode === 'one') {
      nextIndex = queueIndex;
    } else if (isShuffle) {
      if (queue.length <= 1) return;
      let rand = queueIndex;
      while (rand === queueIndex) {
        rand = Math.floor(Math.random() * queue.length);
      }
      nextIndex = rand;
    } else {
      nextIndex = queueIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (!nextTrack) return;

    const currentPrefetch = get().prefetchedStream;
    if (currentPrefetch && currentPrefetch.trackId === nextTrack.id && currentPrefetch.expiresAt > Date.now()) {
      return;
    }

    try {
      const query = `${nextTrack.artist} - ${nextTrack.title}`;
      const url: string = await invoke('get_audio_url', { trackId: nextTrack.id, query });

      let expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 hour fallback
      try {
        const urlObj = new URL(url);
        const expireParam = urlObj.searchParams.get('expire');
        if (expireParam) {
          const expireSecs = parseInt(expireParam, 10);
          if (!isNaN(expireSecs)) {
            expiresAt = expireSecs * 1000 - 60000;
          }
        }
      } catch (e) {
        // Ignore parsing issues, default is fine
      }

      set({
        prefetchedStream: {
          trackId: nextTrack.id,
          url,
          expiresAt,
        },
      });
    } catch (e) {
      console.warn('Failed to prefetch next track:', e);
    }
  },
    }),
    {
      name: 'snnai-player-storage',
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        queue: state.queue,
        queueIndex: state.queueIndex,
        volume: state.volume,
        repeatMode: state.repeatMode,
        isShuffle: state.isShuffle,
      }),
    }
  )
);

// ─── Lyrics Store ─────────────────────────────────────────────────────────────

/** Parse LRC format into timed lyric lines */
function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  for (const line of lrc.split('\n')) {
    const match = line.match(regex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = match[3].length === 2
        ? parseInt(match[3], 10) * 10
        : parseInt(match[3], 10);
      const timeMs = minutes * 60_000 + seconds * 1_000 + centiseconds;
      const text = match[4].trim();
      if (text) lines.push({ timeMs, text });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

interface LyricsStore extends LyricsState {
  fetchLyrics: (track: Track) => Promise<void>;
  clearLyrics: () => void;
}

export const useLyricsStore = create<LyricsStore>((set, get) => ({
  plainLyrics: null,
  syncedLyrics: null,
  isLoading: false,
  error: null,
  trackId: null,

  fetchLyrics: async (track: Track) => {
    // Don't re-fetch if same track
    if (get().trackId === track.id) return;

    set({ isLoading: true, error: null, plainLyrics: null, syncedLyrics: null, trackId: track.id });
    try {
      const result: { plainLyrics?: string; syncedLyrics?: string } = await invoke('get_lyrics', {
        artist: track.artist,
        title: track.title,
        album: track.album,
        durationSecs: Math.floor(track.durationMs / 1000),
      });
      set({
        plainLyrics: result.plainLyrics || null,
        syncedLyrics: result.syncedLyrics ? parseLrc(result.syncedLyrics) : null,
        isLoading: false,
      });
    } catch (e: unknown) {
      set({ error: String(e), isLoading: false, plainLyrics: null, syncedLyrics: null });
    }
  },

  clearLyrics: () => set({ plainLyrics: null, syncedLyrics: null, error: null, trackId: null }),
}));

// ─── App Store ────────────────────────────────────────────────────────────────

export interface AppStore extends AppState {
  theme: 'light' | 'dark';
  session: Session | null;
  setPlaylists: (playlists: Playlist[]) => void;
  setActiveView: (view: 'search' | 'playlist' | 'library') => void;
  setActivePlaylistId: (id: number | null) => void;
  addRecentSearch: (query: string) => void;
  setYtdlp: (available: boolean, version: string | null) => void;
  toggleQueue: () => void;
  toggleLyrics: () => void;
  toggleTheme: () => void;
  closeAllPanels: () => void;

  initializeAuth: () => void;
  loadPlaylists: () => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  addTrackToPlaylist: (playlistId: number, track: Track) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: number, trackId: string) => Promise<void>;
  setSelectedArtist: (artist: Artist | null) => void;
  setSelectedAlbum: (album: Album | null) => void;
  setSoundCloudCredentials: (clientId: string | null, clientSecret: string | null) => void;
  toggleAutoplay: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      theme: 'light',
      session: null,
      playlists: [],
      activeView: 'search',
      activePlaylistId: null,
      recentSearches: [],
      isYtdlpAvailable: false,
      ytdlpVersion: null,
      isQueueOpen: false,
      isLyricsOpen: false,
      selectedArtist: null,
      selectedAlbum: null,
      soundcloudClientId: 'IZwQIdwvEAY24MVfj3pjvwyxzEb3hrYB',
      soundcloudClientSecret: 'oHxFHI4pGhUdbBhKQBlIfUGRMaw6g96k',
      isAutoplayEnabled: true,

      setSelectedArtist: (artist) => set({ selectedArtist: artist }),
      setSelectedAlbum: (album) => set({ selectedAlbum: album }),
      setSoundCloudCredentials: (clientId, clientSecret) => {
        set({ soundcloudClientId: clientId, soundcloudClientSecret: clientSecret });
        invoke('save_soundcloud_credentials', {
          clientId: clientId || '',
          clientSecret: clientSecret || '',
        }).catch((err) => console.error('Failed to save SoundCloud credentials to SQLite:', err));
      },
      toggleAutoplay: () => set((s) => ({ isAutoplayEnabled: !s.isAutoplayEnabled })),

  setPlaylists: (playlists) => set({ playlists }),
  setActiveView: (view) => set({ activeView: view }),
  setActivePlaylistId: (id) => set({ activePlaylistId: id }),
  addRecentSearch: (query) =>
    set((s) => ({
      recentSearches: [query, ...s.recentSearches.filter((q) => q !== query)].slice(0, 10),
    })),
  setYtdlp: (available, version) => set({ isYtdlpAvailable: available, ytdlpVersion: version }),

  toggleQueue: () => set((s) => ({ isQueueOpen: !s.isQueueOpen, isLyricsOpen: s.isQueueOpen ? s.isLyricsOpen : false })),
  toggleLyrics: () => set((s) => ({ isLyricsOpen: !s.isLyricsOpen, isQueueOpen: s.isLyricsOpen ? s.isQueueOpen : false })),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
  closeAllPanels: () => set({ isQueueOpen: false, isLyricsOpen: false }),

  initializeAuth: () => {
    // Load SoundCloud credentials from SQLite database
    invoke<[string, string] | null>('get_soundcloud_credentials').then((creds) => {
      if (creds) {
        set({ soundcloudClientId: creds[0], soundcloudClientSecret: creds[1] });
      } else {
        // If SQLite is empty, write our preloaded default keys immediately
        const defaultId = 'IZwQIdwvEAY24MVfj3pjvwyxzEb3hrYB';
        const defaultSecret = 'oHxFHI4pGhUdbBhKQBlIfUGRMaw6g96k';
        invoke('save_soundcloud_credentials', { clientId: defaultId, clientSecret: defaultSecret })
          .then(() => {
            set({ soundcloudClientId: defaultId, soundcloudClientSecret: defaultSecret });
          })
          .catch((err) => console.error('Failed to save default SoundCloud credentials to SQLite:', err));
      }
    }).catch((err) => {
      console.error('Failed to load SoundCloud credentials from SQLite:', err);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session });
      if (session) get().loadPlaylists();
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        get().loadPlaylists();
      } else {
        set({ playlists: [], activePlaylistId: null });
      }
    });
  },

  loadPlaylists: async () => {
    const { session } = get();
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          id,
          name,
          playlist_tracks (
            track_id, title, artist, album, artwork_url, duration_ms, preview_url, genre_name, position
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const playlists: Playlist[] = data.map((p: any) => ({
        id: p.id,
        name: p.name,
        tracks: p.playlist_tracks
          .sort((a: any, b: any) => a.position - b.position)
          .map((t: any) => ({
            id: t.track_id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            artworkUrl: t.artwork_url,
            durationMs: t.duration_ms,
            previewUrl: t.preview_url,
            genreName: t.genre_name
          }))
      }));
      set({ playlists });
    } catch (e) {
      console.error('Failed to load playlists:', e);
    }
  },

  createPlaylist: async (name: string) => {
    const { session } = get();
    if (!session) return;
    const { error } = await supabase.from('playlists').insert({ name, user_id: session.user.id });
    if (error) console.error('Failed to create playlist:', error);
    else await get().loadPlaylists();
  },

  deletePlaylist: async (id: number) => {
    const { error } = await supabase.from('playlists').delete().eq('id', id);
    if (!error) {
      const s = get();
      if (s.activePlaylistId === id) set({ activePlaylistId: null });
      await get().loadPlaylists();
    }
  },

  addTrackToPlaylist: async (playlistId: number, track: Track) => {
    const playlist = get().playlists.find(p => p.id === playlistId);
    if (!playlist) {
      throw new Error('Playlist not found');
    }

    // Check if the track is already in the playlist
    const isDuplicate = playlist.tracks.some((t) => t.id === track.id);
    if (isDuplicate) {
      throw new Error('Song is already in this playlist');
    }

    const position = playlist.tracks.length;
    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: playlistId,
      track_id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork_url: track.artworkUrl,
      duration_ms: track.durationMs,
      preview_url: track.previewUrl,
      genre_name: track.genreName,
      position,
    });
    if (error) {
      console.error('Failed to add track to playlist:', error);
      throw new Error(error.message);
    } else {
      await get().loadPlaylists();
    }
  },

  removeTrackFromPlaylist: async (playlistId: number, trackId: string) => {
    const { error } = await supabase.from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('track_id', trackId);
    if (!error) await get().loadPlaylists();
  },
    }),
    {
      name: 'snnai-app-storage',
      partialize: (state) => ({
        theme: state.theme,
        recentSearches: state.recentSearches,
        soundcloudClientId: state.soundcloudClientId,
        soundcloudClientSecret: state.soundcloudClientSecret,
        isAutoplayEnabled: state.isAutoplayEnabled,
      }),
    }
  )
);
