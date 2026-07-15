import React, { useEffect, useRef, useCallback, useState } from 'react';
import AuthModal from './AuthModal';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Repeat, Repeat1, Shuffle,
  Loader2, AlertCircle, ListMusic, Mic2,
  Plus, Check,
} from 'lucide-react';
import { usePlayerStore, useAppStore } from '../store';

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement>(null);

  const {
    currentTrack, isPlaying, volume, progress, duration,
    isSeeking, repeatMode, isShuffle, streamUrl, isLoadingStream, streamError,
    setPlaying, setVolume, setProgress, setDuration, setIsSeeking,
    next, previous, togglePlay, toggleRepeat, toggleShuffle,
  } = usePlayerStore();

  const { isQueueOpen, isLyricsOpen, toggleQueue, toggleLyrics, playlists, addTrackToPlaylist, createPlaylist, session } = useAppStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [justAddedTo, setJustAddedTo] = useState<number | null>(null);
  const [menuMessage, setMenuMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  const handleAddToPlaylist = async (playlistId: number) => {
    if (!currentTrack) return;
    try {
      await addTrackToPlaylist(playlistId, currentTrack);
      setJustAddedTo(playlistId);
      setMenuMessage({ text: 'Added!', isError: false });
      setTimeout(() => {
        setJustAddedTo(null);
        setMenuMessage(null);
        setIsMenuOpen(false);
      }, 1000);
    } catch (err: any) {
      setMenuMessage({ text: err.message || 'Failed to add', isError: true });
      setTimeout(() => {
        setMenuMessage(null);
      }, 3000);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !currentTrack) return;
    try {
      const name = newPlaylistName.trim();
      await createPlaylist(name);
      // Wait for playlists to update and find the new playlist
      const updatedPlaylists = useAppStore.getState().playlists;
      const created = updatedPlaylists.find(p => p.name.toLowerCase() === name.toLowerCase());
      if (created) {
        await addTrackToPlaylist(created.id, currentTrack);
        setJustAddedTo(created.id);
        setNewPlaylistName('');
        setMenuMessage({ text: 'Created and Added!', isError: false });
        setTimeout(() => {
          setJustAddedTo(null);
          setMenuMessage(null);
          setIsMenuOpen(false);
        }, 1000);
      }
    } catch (err: any) {
      setMenuMessage({ text: err.message || 'Failed to add', isError: true });
      setTimeout(() => {
        setMenuMessage(null);
      }, 3000);
    }
  };

  // Sync audio src when stream URL changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (streamUrl) {
      audio.src = streamUrl;
      audio.volume = volume;
      audio.load();
    } else {
      // Clear audio source and pause it immediately to prevent background playback while loading the next track
      audio.pause();
      audio.src = '';
      audio.load();
    }
  }, [streamUrl]);

  // Play / pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !streamUrl) return;
    if (isPlaying) {
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, streamUrl]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const onTimeUpdate = useCallback(() => {
    if (!isSeeking && audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  }, [isSeeking, setProgress]);

  const onLoadedMetadata = useCallback(() => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  }, [setDuration]);

  const onEnded = useCallback(() => {
    if (repeatMode === 'one') {
      audioRef.current?.play();
    } else {
      next();
    }
  }, [repeatMode, next]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSeeking(true);
    setProgress(Number(e.target.value));
  };

  const handleSeekCommit = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    const time = Number(e.currentTarget.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setIsSeeking(false);
    setProgress(time);
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <footer
      className="fixed bottom-16 left-0 right-0 md:absolute md:bottom-6 md:left-6 md:right-6 flex items-center justify-between px-4 md:px-2 gap-2 md:gap-4 z-50 bg-[var(--bg-surface)] md:bg-transparent border-t md:border-none border-[var(--border)] h-16 md:h-[var(--player-height)] shadow-lg md:shadow-none"
    >
      {/* Mobile progress bar (top of the player bar) */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--bg-elevated)] md:hidden">
        <div
          className="h-full bg-[var(--accent-light)] transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        onCanPlay={() => { if (isPlaying) audioRef.current?.play().catch(() => {}); }}
      />

      {/* Track Info */}
      <div className="flex items-center gap-3 w-full md:w-64 min-w-0 shrink md:shrink-0 md:neumorphic-in p-0 md:p-3 rounded-none md:rounded-2xl bg-transparent border-none">
        {currentTrack ? (
          <>
            <img
              src={currentTrack.artworkUrl || '/placeholder.png'}
              alt={currentTrack.album}
              className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover shrink-0 glow-accent"
              onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="%231a1a28" rx="8"/><text x="50%" y="55%" text-anchor="middle" dy=".1em" font-size="20">🎵</text></svg>'; }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-sm font-semibold truncate text-white">{currentTrack.title}</p>
                {currentTrack.id.startsWith('soundcloud:') && currentTrack.previewUrl && (
                  <a
                    href={currentTrack.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[#ff5500] hover:text-[#ff7700] transition-colors"
                    title="Listen on SoundCloud"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="display-inline-block align-middle"><path d="M11.56 16.85a.76.76 0 0 1-.76-.76v-7.1a.76.76 0 0 1 1.52 0v7.1a.76.76 0 0 1-.76.76m-2.18-.76a.76.76 0 0 1-1.52 0V9.8a.76.76 0 0 1 1.52 0v6.29a.76.76 0 0 1 0 0zm4.35.76a.76.76 0 0 1-.76-.76v-8.3a.76.76 0 0 1 1.52 0v8.3a.76.76 0 0 1-.76.76m-6.52-.76a.76.76 0 0 1-1.52 0v-4.14a.76.76 0 0 1 1.52 0v4.14a.76.76 0 0 1 0 0zm8.7-.76a.76.76 0 0 1-1.52 0V6.76a.76.76 0 0 1 1.52 0V15.33zm-10.87-.76a.76.76 0 0 1-1.52 0v-2.14a.76.76 0 0 1 1.52 0v2.14a.76.76 0 0 1 0 0zm13.38.76H17.3c-.42 0-.76-.34-.76-.76V6.15c0-.42.34-.76.76-.76.42 0 .76.34.76.76v8.42h.3c1.47 0 2.66-1.2 2.66-2.66s-1.2-2.66-2.66-2.66c-.34 0-.67.06-.97.2a.76.76 0 0 1-1.02-.34.76.76 0 0 1 .34-1.02 4.2 4.2 0 0 1 5.48 2.37c.75 1.76.35 3.82-.96 5.15-.82.84-1.95 1.32-3.15 1.32zM.68 14.57A.76.76 0 0 1 0 13.8v-.95a.76.76 0 0 1 1.52 0v.95a.76.76 0 0 1-.84.76z"/></svg>
                  </a>
                )}
              </div>
              <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{currentTrack.artist}</p>
            </div>

            {/* Quick Add to Playlist Trigger & Menu */}
            <div className="relative shrink-0 ml-1" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 rounded-lg transition-all text-white/50 hover:text-white hover:bg-white/10"
                title="Add to Playlist"
              >
                <Plus size={16} />
              </button>

              {isMenuOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border p-2 z-50 shadow-2xl glass-panel animate-fade-in"
                  style={{
                    background: 'var(--bg-surface)',
                    borderColor: 'var(--border)',
                    backdropFilter: 'blur(16px)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  {!session ? (
                    <div className="p-3 text-center">
                      <p className="text-xs text-white/70 mb-2.5">Sign in to save playlists</p>
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          setShowAuthModal(true);
                        }}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold text-white transition-all bg-[var(--accent)] hover:opacity-90"
                      >
                        Sign In
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 px-2 py-1">
                        Add to Playlist
                      </p>
                      {menuMessage && (
                        <p className="text-[10px] px-2 py-0.5 font-medium animate-pulse" style={{ color: menuMessage.isError ? '#f87171' : '#4ade80' }}>
                          {menuMessage.text}
                        </p>
                      )}
                      {playlists.length === 0 ? (
                        <p className="text-xs text-white/40 px-2 py-2 text-center">No playlists found</p>
                      ) : (
                        playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={() => handleAddToPlaylist(pl.id)}
                            className="flex items-center justify-between text-left text-xs text-white/80 hover:text-white hover:bg-white/5 px-2.5 py-2 rounded-lg transition-all w-full"
                          >
                            <span className="truncate">{pl.name}</span>
                            {justAddedTo === pl.id && <Check size={12} className="text-green-400" />}
                          </button>
                        ))
                      )}
                      
                      <div className="h-px bg-white/5 my-1" />

                      <form onSubmit={handleCreateAndAdd} className="flex gap-1.5 p-1 mt-0.5">
                        <input
                          type="text"
                          placeholder="New playlist..."
                          value={newPlaylistName}
                          onChange={(e) => setNewPlaylistName(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--accent)] w-28"
                        />
                        <button
                          type="submit"
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all"
                        >
                          Create
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
              <span className="text-xl">🎵</span>
            </div>
            <span className="text-sm">No track playing</span>
          </div>
        )}
      </div>

      {/* Mobile controls (visible on mobile, hidden on desktop) */}
      <div className="flex md:hidden items-center gap-3 shrink-0">
        <button
          onClick={togglePlay}
          disabled={!currentTrack || isLoadingStream}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-[var(--accent)]"
        >
          {isLoadingStream ? (
            <Loader2 size={16} className="animate-spin-slow text-white" />
          ) : isPlaying ? (
            <Pause size={16} fill="white" className="text-white" />
          ) : (
            <Play size={16} fill="white" className="text-white ml-0.5" />
          )}
        </button>
        <button
          onClick={next}
          disabled={!currentTrack}
          className="p-2 transition-all text-white"
          style={{ color: 'var(--text-primary)' }}
        >
          <SkipForward size={20} fill="currentColor" />
        </button>
      </div>

      {/* Center Controls */}
      <div className="hidden md:flex flex-col items-center gap-3 flex-1 min-w-0">
        {/* Buttons */}
        <div className="flex items-center gap-5 neumorphic-out px-6 py-1.5 rounded-full">
          <button
            onClick={toggleShuffle}
            title="Shuffle"
            className="p-1.5 rounded-full transition-all"
            style={{ color: isShuffle ? 'var(--accent-light)' : 'var(--text-secondary)' }}
          >
            <Shuffle size={16} />
          </button>

          <button
            onClick={previous}
            className="p-2 rounded-full transition-all hover:scale-110"
            style={{ color: 'var(--text-primary)' }}
            disabled={!currentTrack}
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!currentTrack || isLoadingStream}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 disabled:opacity-50"
            style={{ background: 'var(--accent)', boxShadow: '0 0 20px var(--accent-glow)' }}
          >
            {isLoadingStream ? (
              <Loader2 size={18} className="animate-spin-slow text-white" />
            ) : isPlaying ? (
              <Pause size={18} fill="white" className="text-white" />
            ) : (
              <Play size={18} fill="white" className="text-white ml-0.5" />
            )}
          </button>

          <button
            onClick={next}
            className="p-2 rounded-full transition-all hover:scale-110"
            style={{ color: 'var(--text-primary)' }}
            disabled={!currentTrack}
          >
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button
            onClick={toggleRepeat}
            title={`Repeat: ${repeatMode}`}
            className="p-1.5 rounded-full transition-all"
            style={{ color: repeatMode !== 'none' ? 'var(--accent-light)' : 'var(--text-secondary)' }}
          >
            <RepeatIcon size={16} />
          </button>
        </div>

        {/* Seek bar */}
        <div className="flex items-center gap-2 w-full max-w-lg">
          <span className="text-xs tabular-nums w-9 text-right" style={{ color: 'var(--text-secondary)' }}>
            {formatTime(progress)}
          </span>
          <div className="relative flex-1 h-1 group">
            <div
              className="absolute inset-y-0 left-0 rounded-full pointer-events-none transition-all"
              style={{ width: `${progressPercent}%`, background: 'var(--accent-light)' }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={progress}
              onChange={handleSeekChange}
              onMouseUp={handleSeekCommit}
              onTouchEnd={handleSeekCommit}
              disabled={!currentTrack || !streamUrl}
              className="w-full opacity-0 absolute inset-0 cursor-pointer"
              style={{ height: '4px' }}
            />
            <div
              className="h-1 rounded-full"
              style={{ background: 'var(--bg-elevated)' }}
            />
          </div>
          <span className="text-xs tabular-nums w-9" style={{ color: 'var(--text-secondary)' }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Stream error */}
        {streamError && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={12} />
            <span className="truncate max-w-xs">{streamError}</span>
          </div>
        )}
      </div>

      {/* Volume + Panel Toggles */}
      <div className="hidden md:flex items-center gap-4 w-60 shrink-0 neumorphic-out p-3 rounded-2xl">
        {/* Volume */}
        <div className="flex items-center gap-2 flex-1">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="p-1 transition-all"
            style={{ color: 'var(--text-secondary)' }}
          >
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <div className="relative flex-1 h-1">
            <div
              className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
              style={{ width: `${volume * 100}%`, background: 'var(--accent-light)' }}
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full opacity-0 absolute inset-0 cursor-pointer"
              style={{ height: '4px' }}
            />
            <div className="h-1 rounded-full" style={{ background: 'var(--bg-elevated)' }} />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-5 shrink-0" style={{ background: 'var(--border)' }} />

        {/* Lyrics toggle */}
        <button
          onClick={toggleLyrics}
          title="Lyrics"
          className="p-1.5 rounded-lg transition-all hover:scale-110"
          style={{
            color: isLyricsOpen ? 'var(--accent-light)' : 'var(--text-secondary)',
            background: isLyricsOpen ? 'rgba(124,58,237,0.15)' : 'transparent',
          }}
        >
          <Mic2 size={15} />
        </button>

        {/* Queue toggle */}
        <button
          onClick={toggleQueue}
          title="Queue"
          className="p-1.5 rounded-lg transition-all hover:scale-110"
          style={{
            color: isQueueOpen ? 'var(--accent-light)' : 'var(--text-secondary)',
            background: isQueueOpen ? 'rgba(124,58,237,0.15)' : 'transparent',
          }}
        >
          <ListMusic size={15} />
        </button>
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </footer>
  );
}
