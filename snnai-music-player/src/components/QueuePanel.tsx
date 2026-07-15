import { useEffect, useRef, useState } from 'react';
import { X, ListMusic, GripVertical, Play, Radio } from 'lucide-react';
import { usePlayerStore, useAppStore } from '../store';

function formatDuration(ms: number): string {
  if (!ms) return '--';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export default function QueuePanel() {
  const { isQueueOpen, toggleQueue, isAutoplayEnabled, toggleAutoplay } = useAppStore();
  const { queue, queueIndex, currentTrack, removeFromQueue, jumpToQueueIndex, clearQueue } = usePlayerStore();
  const activeRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Track screen size for mobile adaptation
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Scroll active track into view when panel opens
  useEffect(() => {
    if (isQueueOpen && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isQueueOpen]);

  const upcoming = queue.slice(queueIndex + 1);
  const played = queue.slice(0, queueIndex);

  return (
    <>
      {/* Backdrop */}
      {isQueueOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={toggleQueue}
          style={{ background: 'transparent' }}
        />
      )}

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-40 flex flex-col h-full transition-transform duration-300 ease-in-out w-full md:w-[320px]"
        style={{
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          paddingBottom: isMobile ? '8rem' : 'var(--player-height)',
          transform: isQueueOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <ListMusic size={18} style={{ color: 'var(--accent-light)' }} />
            <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Queue
            </h2>
            <span
              className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              {queue.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAutoplay}
              title="Autoplay similar songs when queue ends"
              className="p-1.5 rounded-lg transition-all flex items-center gap-1.5 hover:bg-[var(--bg-elevated)]"
              style={{
                color: isAutoplayEnabled ? 'var(--accent-light)' : 'var(--text-muted)',
                background: isAutoplayEnabled ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                border: isAutoplayEnabled ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid transparent',
              }}
            >
              <Radio size={13} className={isAutoplayEnabled ? 'animate-pulse' : ''} />
              <span className="text-[10px] font-medium">Autoplay</span>
            </button>
            {queue.length > 0 && (
              <button
                onClick={clearQueue}
                className="text-xs px-2 py-1 rounded transition-colors hover:text-red-400"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear
              </button>
            )}
            <button
              onClick={toggleQueue}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-muted)' }}>
              <ListMusic size={40} className="opacity-20" />
              <p className="text-sm">Queue is empty</p>
              <p className="text-xs">Search for tracks to add them</p>
            </div>
          ) : (
            <>
              {/* Now Playing */}
              {currentTrack && (
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Now Playing
                  </p>
                  <div
                    ref={activeRef}
                    className="flex items-center gap-3 p-2 rounded-xl"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent)', boxShadow: '0 0 12px var(--accent-glow)' }}
                  >
                    <img
                      src={currentTrack.artworkUrl}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--accent-light)' }}>
                        {currentTrack.title}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {currentTrack.artist}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcoming.length > 0 && (
                <div className="px-4 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Next Up — {upcoming.length} tracks
                  </p>
                  {upcoming.map((track, i) => {
                    const absoluteIndex = queueIndex + 1 + i;
                    return (
                      <div
                        key={`${track.id}-${absoluteIndex}`}
                        className="group flex items-center gap-2 py-2 px-1 rounded-lg cursor-pointer transition-all"
                        onDoubleClick={() => jumpToQueueIndex(absoluteIndex)}
                        style={{ color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <GripVertical size={12} className="shrink-0 opacity-30" />
                        <img src={track.artworkUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {track.title}
                          </p>
                          <p className="text-xs truncate">{track.artist}</p>
                        </div>
                        <span className="text-xs tabular-nums shrink-0">{formatDuration(track.durationMs)}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); jumpToQueueIndex(absoluteIndex); }}
                            className="p-1 rounded hover:text-white"
                          >
                            <Play size={11} fill="currentColor" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromQueue(absoluteIndex); }}
                            className="p-1 rounded hover:text-red-400"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Autoplay Status Card */}
              {isAutoplayEnabled && currentTrack && (
                <div className="mx-4 mt-3 mb-2 p-3 rounded-xl flex items-center gap-3 border border-dashed transition-all"
                  style={{
                    background: 'rgba(168, 85, 247, 0.05)',
                    borderColor: 'rgba(168, 85, 247, 0.2)',
                  }}
                >
                  <Radio size={14} className="text-purple-400 animate-pulse shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>
                      Autoplay is active
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      Playing similar tracks next
                    </p>
                  </div>
                </div>
              )}

              {/* Played History */}
              {played.length > 0 && (
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    History
                  </p>
                  {played.map((track, i) => (
                    <div
                      key={`${track.id}-played-${i}`}
                      className="group flex items-center gap-2 py-1.5 px-1 rounded-lg cursor-pointer opacity-40 hover:opacity-70 transition-all"
                      onDoubleClick={() => jumpToQueueIndex(i)}
                    >
                      <img src={track.artworkUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{track.title}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{track.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
