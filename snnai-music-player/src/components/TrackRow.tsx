import { useState } from 'react';
import { Play, Pause, MoreHorizontal, Plus, Check, Loader2, ListPlus } from 'lucide-react';
import { Track } from '../types';
import { usePlayerStore, useAppStore } from '../store';

interface TrackRowProps {
  track: Track;
  index: number;
  playlistId?: number;
  onRemove?: () => void;
}

function formatDuration(ms: number): string {
  if (!ms) return '--';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function TrackRow({ track, index, playlistId, onRemove }: TrackRowProps) {
  const { currentTrack, isPlaying, isLoadingStream, togglePlay, addToQueue } = usePlayerStore();
  const { playlists, addTrackToPlaylist } = useAppStore();
  const [showMenu, setShowMenu] = useState(false);
  const [addedTo, setAddedTo] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isCurrentTrack = currentTrack?.id === track.id;

  const handlePlay = () => {
    if (isCurrentTrack) {
      togglePlay();
    } else {
      usePlayerStore.getState().injectAndPlay(track);
    }
  };

  const handleAddToPlaylist = async (playlistId: number) => {
    setIsAdding(true);
    setErrorMsg(null);
    try {
      await addTrackToPlaylist(playlistId, track);
      setAddedTo(playlistId);
      setTimeout(() => { setAddedTo(null); setShowMenu(false); }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add track');
      setTimeout(() => setErrorMsg(null), 3000);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div
      className="group flex items-center gap-4 px-3 py-2 rounded-lg cursor-pointer transition-all"
      style={{
        background: isCurrentTrack ? 'var(--bg-elevated)' : 'transparent',
        borderLeft: isCurrentTrack ? '2px solid var(--accent)' : '2px solid transparent',
      }}
      onDoubleClick={handlePlay}
    >
      {/* Index / Play button */}
      <div className="w-6 h-6 flex items-center justify-center shrink-0">
        {isCurrentTrack ? (
          <button onClick={handlePlay} className="text-white">
            {isLoadingStream ? (
              <Loader2 size={14} className="animate-spin-slow" style={{ color: 'var(--accent-light)' }} />
            ) : isPlaying ? (
              <Pause size={14} fill="currentColor" style={{ color: 'var(--accent-light)' }} />
            ) : (
              <Play size={14} fill="currentColor" style={{ color: 'var(--accent-light)' }} />
            )}
          </button>
        ) : (
          <>
            <span
              className="text-xs tabular-nums group-hover:hidden"
              style={{ color: 'var(--text-muted)' }}
            >
              {index}
            </span>
            <button onClick={handlePlay} className="hidden group-hover:flex">
              <Play size={14} fill="currentColor" style={{ color: 'var(--text-primary)' }} />
            </button>
          </>
        )}
      </div>

      {/* Artwork */}
      <img
        src={track.artworkUrl}
        alt={track.album}
        className="w-10 h-10 rounded-md object-cover shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).src =
            'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%231a1a28" rx="6"/><text x="50%" y="55%" text-anchor="middle" dy=".1em" font-size="16">🎵</text></svg>';
        }}
      />

      {/* Title / Artist */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p
            className="text-sm font-medium truncate"
            style={{ color: isCurrentTrack ? 'var(--accent-light)' : 'var(--text-primary)' }}
          >
            {track.title}
          </p>
          {track.id.startsWith('soundcloud:') && track.previewUrl && (
            <a
              href={track.previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[#ff5500] hover:text-[#ff7700] transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="Listen on SoundCloud"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className="display-inline-block align-middle"><path d="M11.56 16.85a.76.76 0 0 1-.76-.76v-7.1a.76.76 0 0 1 1.52 0v7.1a.76.76 0 0 1-.76.76m-2.18-.76a.76.76 0 0 1-1.52 0V9.8a.76.76 0 0 1 1.52 0v6.29a.76.76 0 0 1 0 0zm4.35.76a.76.76 0 0 1-.76-.76v-8.3a.76.76 0 0 1 1.52 0v8.3a.76.76 0 0 1-.76.76m-6.52-.76a.76.76 0 0 1-1.52 0v-4.14a.76.76 0 0 1 1.52 0v4.14a.76.76 0 0 1 0 0zm8.7-.76a.76.76 0 0 1-1.52 0V6.76a.76.76 0 0 1 1.52 0V15.33zm-10.87-.76a.76.76 0 0 1-1.52 0v-2.14a.76.76 0 0 1 1.52 0v2.14a.76.76 0 0 1 0 0zm13.38.76H17.3c-.42 0-.76-.34-.76-.76V6.15c0-.42.34-.76.76-.76.42 0 .76.34.76.76v8.42h.3c1.47 0 2.66-1.2 2.66-2.66s-1.2-2.66-2.66-2.66c-.34 0-.67.06-.97.2a.76.76 0 0 1-1.02-.34.76.76 0 0 1 .34-1.02 4.2 4.2 0 0 1 5.48 2.37c.75 1.76.35 3.82-.96 5.15-.82.84-1.95 1.32-3.15 1.32zM.68 14.57A.76.76 0 0 1 0 13.8v-.95a.76.76 0 0 1 1.52 0v.95a.76.76 0 0 1-.84.76z"/></svg>
            </a>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
          {track.artist}
        </p>
      </div>

      {/* Album */}
      <span
        className="text-xs truncate hidden md:block w-40"
        style={{ color: 'var(--text-muted)' }}
      >
        {track.album}
      </span>

      {/* Duration */}
      <span className="text-xs tabular-nums w-10 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>
        {formatDuration(track.durationMs)}
      </span>

      {/* Menu & Queue */}
      <div className="relative flex items-center justify-end gap-1 w-16 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            addToQueue(track);
            // Optionally, we could show a tiny toast here, but for now just add.
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-[var(--bg-elevated)]"
          style={{ color: 'var(--text-secondary)' }}
          title="Add to Queue"
        >
          <ListPlus size={16} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-[var(--bg-elevated)]"
          style={{ color: 'var(--text-secondary)' }}
          title="More options"
        >
          <MoreHorizontal size={16} />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div
              className="absolute right-0 top-6 z-50 rounded-xl py-1 min-w-44 shadow-2xl animate-fade-in"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Add to playlist
              </div>
              {errorMsg && (
                <div className="px-3 py-1 text-xs text-red-400 font-medium animate-pulse">
                  {errorMsg}
                </div>
              )}
              {playlists.length === 0 ? (
                <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  No playlists yet
                </div>
              ) : (
                playlists.map((pl) => (
                  <button
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl.id)}
                    disabled={isAdding}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm transition-all hover:text-white"
                    style={{
                      color: addedTo === pl.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {addedTo === pl.id ? <Check size={12} /> : <Plus size={12} />}
                    {pl.name}
                  </button>
                ))
              )}
              {onRemove && playlistId != null && (
                <>
                  <div className="h-px mx-2 my-1" style={{ background: 'var(--border)' }} />
                  <button
                    onClick={() => { setShowMenu(false); onRemove(); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 transition-all"
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    Remove from playlist
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
