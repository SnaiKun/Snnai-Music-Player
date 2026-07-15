import { useEffect, useRef, useState } from 'react';
import { X, Mic2, Loader2, AlertCircle, Music2 } from 'lucide-react';
import { useAppStore, usePlayerStore, useLyricsStore } from '../store';

export default function LyricsPanel() {
  const { isLyricsOpen, toggleLyrics } = useAppStore();
  const { currentTrack, progress } = usePlayerStore();
  const { 
    plainLyrics, 
    syncedLyrics, 
    romanizedPlainLyrics, 
    romanizedSyncedLyrics, 
    isRomanized, 
    toggleRomanize, 
    isLoading, 
    error 
  } = useLyricsStore();

  const displayedSynced = isRomanized && romanizedSyncedLyrics ? romanizedSyncedLyrics : syncedLyrics;
  const displayedPlain = isRomanized && romanizedPlainLyrics ? romanizedPlainLyrics : plainLyrics;

  const containerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLParagraphElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Track screen size for mobile responsive padding
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Find the current lyric line index based on playback position
  const progressMs = progress * 1000;
  let currentLineIndex = -1;
  if (syncedLyrics) {
    for (let i = syncedLyrics.length - 1; i >= 0; i--) {
      if (progressMs >= syncedLyrics[i].timeMs) {
        currentLineIndex = i;
        break;
      }
    }
  }

  // Auto-scroll to active lyric line
  useEffect(() => {
    if (activeLyricRef.current && isLyricsOpen) {
      activeLyricRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentLineIndex, isLyricsOpen]);

  return (
    <div
      className="fixed top-0 right-0 z-40 flex flex-col h-full transition-transform duration-300 ease-in-out w-full md:w-[340px]"
      style={{
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        paddingBottom: isMobile ? '8rem' : 'var(--player-height)',
        transform: isLyricsOpen ? 'translateX(0)' : 'translateX(100%)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Mic2 size={18} style={{ color: 'var(--accent-light)' }} />
          <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            Lyrics
          </h2>
          {syncedLyrics && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--accent-light)', border: '1px solid var(--accent)' }}
            >
              Synced
            </span>
          )}
          {(plainLyrics || syncedLyrics) && (
            <button
              onClick={toggleRomanize}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full transition-all border uppercase shrink-0"
              style={{
                background: isRomanized ? 'rgba(124,58,237,0.2)' : 'transparent',
                color: isRomanized ? 'var(--accent-light)' : 'var(--text-secondary)',
                borderColor: isRomanized ? 'var(--accent)' : 'var(--border)',
              }}
              title="Toggle Romanization (Romaji, Pinyin, etc.)"
            >
              Romaji
            </button>
          )}
        </div>
        <button
          onClick={toggleLyrics}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Track Info */}
      {currentTrack && (
        <div
          className="flex items-center gap-3 px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
        >
          <img
            src={currentTrack.artworkUrl}
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {currentTrack.title}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
              {currentTrack.artist}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-6">
        {!currentTrack && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-muted)' }}>
            <Music2 size={40} className="opacity-20" />
            <p className="text-sm">Play a track to see lyrics</p>
          </div>
        )}

        {currentTrack && isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={28} className="animate-spin-slow" />
            <p className="text-sm">Loading lyrics…</p>
          </div>
        )}

        {currentTrack && !isLoading && error && (
          <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-muted)' }}>
            <AlertCircle size={32} className="opacity-30" />
            <p className="text-sm">No lyrics found</p>
            <p className="text-xs text-center opacity-60">
              Try again or check the artist/title
            </p>
          </div>
        )}

        {/* Synced lyrics */}
        {currentTrack && !isLoading && displayedSynced && (
          <div className="flex flex-col gap-3 pb-20">
            {displayedSynced.map((line, i) => {
              const isActive = i === currentLineIndex;
              const isPast = i < currentLineIndex;
              return (
                <p
                  key={i}
                  ref={isActive ? activeLyricRef : undefined}
                  className="text-left leading-snug transition-all duration-300 cursor-default"
                  style={{
                    fontSize: isActive ? '1.15rem' : '0.95rem',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive
                      ? 'var(--text-primary)'
                      : isPast
                      ? 'var(--text-muted)'
                      : 'var(--text-secondary)',
                    opacity: isActive ? 1 : isPast ? 0.45 : 0.7,
                    transform: isActive ? 'scale(1.02)' : 'scale(1)',
                    transformOrigin: 'left center',
                    textShadow: isActive ? '0 0 20px var(--accent-glow)' : 'none',
                  }}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        )}

        {/* Plain lyrics fallback */}
        {currentTrack && !isLoading && !displayedSynced && displayedPlain && (
          <div
            className="text-sm leading-loose whitespace-pre-wrap"
            style={{ color: 'var(--text-secondary)' }}
          >
            {displayedPlain}
          </div>
        )}
      </div>
    </div>
  );
}
