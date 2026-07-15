import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Loader2, ChevronRight } from 'lucide-react';
import { Track, Recommendations } from '../types';
import { usePlayerStore } from '../store';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';

// Recommendations payload uses camelCase natively thanks to Rust #[serde(rename_all = "camelCase")]
interface RecommendationCardProps {
  track: Track;
}

function RecommendationCard({ track }: RecommendationCardProps) {
  const { playTrack, currentTrack } = usePlayerStore();
  const isActive = currentTrack?.id === track.id;

  return (
    <button
      onClick={() => playTrack(track)}
      className="flex flex-col gap-1.5 shrink-0 rounded-xl overflow-hidden transition-all hover:scale-105 text-left"
      style={{
        width: '140px',
        background: 'var(--bg-elevated)',
        border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
        boxShadow: isActive ? '0 0 12px var(--accent-glow)' : 'none',
      }}
    >
      <div className="relative w-full aspect-square overflow-hidden">
        <img
          src={track.artworkUrl}
          alt={track.album}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140"><rect width="140" height="140" fill="%231a1a28"/><text x="50%" y="55%" text-anchor="middle" dy=".1em" font-size="40">🎵</text></svg>';
          }}
        />
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent)', boxShadow: '0 0 16px var(--accent-glow)' }}
          >
            <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="px-2 pb-2">
        <p className="text-xs font-semibold truncate" style={{ color: isActive ? 'var(--accent-light)' : 'var(--text-primary)' }}>
          {track.title}
        </p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {track.artist}
        </p>
      </div>
    </button>
  );
}

interface RecommendationsSectionProps {
  artist: string;
  genre: string;
  excludeId: string;
}

function RecommendationsSection({ artist, genre, excludeId }: RecommendationsSectionProps) {
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;
    if (!artist || !excludeId) return;
    setIsLoading(true);
    setRecs(null);

    invoke<Recommendations>('get_recommendations', {
      artist,
      genre: genre || 'pop',
      excludeId,
    })
      .then((data) => {
        if (isActive) {
          setRecs(data);
        }
      })
      .catch(() => {
        if (isActive) setRecs(null);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
      
    return () => { isActive = false; };
  }, [artist, excludeId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4" style={{ color: 'var(--text-muted)' }}>
        <Loader2 size={14} className="animate-spin-slow" />
        <span className="text-sm">Finding recommendations…</span>
      </div>
    );
  }

  if (!recs) return null;

  return (
    <div className="mt-6 animate-fade-in">
      <div className="h-px mb-6" style={{ background: 'var(--border)' }} />
      <Section title={`More by ${artist}`} tracks={recs.moreByArtist} />
      {genre && <Section title={`You might like · ${genre}`} tracks={recs.similarGenre} />}
    </div>
  );
}

interface SectionProps {
  title: string;
  tracks: Track[];
}

function Section({ title, tracks }: SectionProps) {
  const scrollRef = useHorizontalScroll();
  const { playTrack } = usePlayerStore();

  if (tracks.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <button
          onClick={() => playTrack(tracks[0], tracks)}
          className="flex items-center gap-1 text-xs transition-colors hover:text-white"
          style={{ color: 'var(--text-muted)' }}
        >
          Play all <ChevronRight size={12} />
        </button>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pt-2 pb-3 px-1" style={{ scrollbarWidth: 'thin' }}>
        {tracks.map((track) => (
          <RecommendationCard key={track.id} track={track} />
        ))}
      </div>
    </div>
  );
}

export default RecommendationsSection;
