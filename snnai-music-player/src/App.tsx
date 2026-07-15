import { useEffect, useState } from 'react';
import { Artist } from './types';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from './store';
import { useMediaSession } from './hooks/useMediaSession';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import SearchView from './components/SearchView';
import PlaylistView from './components/PlaylistView';
import QueuePanel from './components/QueuePanel';
import LyricsPanel from './components/LyricsPanel';
import HistoryRecommendations from './components/HistoryRecommendations';
import BottomNav from './components/BottomNav';
import { ListMusic } from 'lucide-react';
import './index.css';
import { useHorizontalScroll } from './hooks/useHorizontalScroll';

export default function App() {
  // Activate OS media key support + lock screen controls
  useMediaSession();

  const {
    activeView,
    setYtdlp,
    loadPlaylists,
    initializeAuth,
    theme,
  } = useAppStore();

  const [isMobile, setIsMobile] = useState(false);

  // Sync theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Track screen size for layout padding
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // On mount: check yt-dlp availability and load playlists
  useEffect(() => {
    invoke<string>('check_ytdlp')
      .then((version) => setYtdlp(true, version))
      .catch(() => setYtdlp(false, null));

    loadPlaylists();
    initializeAuth();
  }, []);

  const renderMain = () => {
    switch (activeView) {
      case 'search':
        return <SearchView />;
      case 'playlist':
        return <PlaylistView />;
      case 'library':
        return <LibraryView />;
      default:
        return <SearchView />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden p-0 md:p-4 gap-0 md:gap-4" style={{ background: 'var(--bg-base)' }}>
      {/* Sidebar (desktop only) */}
      <div className="hidden md:flex md:w-[260px] shrink-0">
        <Sidebar />
      </div>

      {/* Main Content */}
      <main
        className="flex-1 overflow-hidden md:neumorphic-out md:rounded-2xl relative"
        style={{ paddingBottom: isMobile ? '8rem' : 'calc(var(--player-height) + 1rem)' }}
      >
        {renderMain()}
        <PlayerBar />
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Slide-in panels (fixed overlays from right side) */}
      <QueuePanel />
      <LyricsPanel />
    </div>
  );
}


// Library View — displays recent searches, favorite artists, playlists, and recommendations
function LibraryView() {
  const { recentSearches, setActiveView, setSelectedArtist, setSelectedAlbum, playlists, setActivePlaylistId } = useAppStore();
  const [favArtists, setFavArtists] = useState<Artist[]>([]);

  const playlistsScrollRef = useHorizontalScroll();
  const artistsScrollRef = useHorizontalScroll();

  useEffect(() => {
    invoke<Artist[]>('get_favorite_artists')
      .then(setFavArtists)
      .catch((err) => console.error('Failed to get favorite artists:', err));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 md:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
        Your Library
      </h1>

      {/* Welcome card */}
      <div
        className="rounded-2xl p-6 mb-6"
        style={{
          background: 'linear-gradient(135deg, var(--accent) 0%, #ec4899 100%)',
          boxShadow: '0 8px 32px rgba(124,58,237,0.3)',
        }}
      >
        <h2 className="text-xl font-bold text-white mb-1">Welcome to Snnai 🎵</h2>
        <p className="text-white/80 text-sm">
          Search for any song and play it instantly. All streams powered by yt-dlp + iTunes metadata.
        </p>
      </div>

      {/* Playlists */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Playlists
        </h3>
        {playlists.length === 0 ? (
          <p className="text-xs px-2 py-4 text-center rounded-xl bg-[var(--bg-elevated)]" style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)' }}>
            No playlists created yet.
          </p>
        ) : (
          <div ref={playlistsScrollRef} className="flex gap-4 overflow-x-auto pt-2 pb-3 px-1" style={{ scrollbarWidth: 'thin' }}>
            {playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => {
                  setActivePlaylistId(pl.id);
                  setActiveView('playlist');
                }}
                className="flex flex-col items-center gap-2 shrink-0 group transition-all hover:scale-105"
                style={{ width: '80px' }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden transition-all text-white shadow-md bg-[var(--bg-elevated)] border border-[var(--border)] hover:border-[var(--accent)]"
                >
                  <ListMusic size={24} className="text-[var(--accent)]" />
                </div>
                <span className="text-xs font-semibold text-center truncate w-full text-white group-hover:text-purple-400">
                  {pl.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Favorite Artists */}
      {favArtists.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Favorite Artists
          </h3>
          <div ref={artistsScrollRef} className="flex gap-4 overflow-x-auto pt-2 pb-3 px-1" style={{ scrollbarWidth: 'thin' }}>
            {favArtists.map((artist) => (
              <button
                key={artist.id}
                onClick={() => {
                  setSelectedArtist(artist);
                  setSelectedAlbum(null);
                  setActiveView('search');
                }}
                className="flex flex-col items-center gap-2 shrink-0 group transition-all hover:scale-105"
                style={{ width: '80px' }}
              >
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center relative overflow-hidden transition-all group-hover:shadow-[0_0_12px_var(--accent-glow)] text-lg font-bold text-white shadow-inner"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent) 0%, #ec4899 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2)',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {artist.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-center truncate w-full text-white group-hover:text-purple-400">
                  {artist.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Personalized Recommendations */}
      <div className="mb-6">
        <HistoryRecommendations />
      </div>

      {recentSearches.length > 0 && (
        <>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Recent Searches
          </h3>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s) => (
              <button
                key={s}
                onClick={() => setActiveView('search')}
                className="px-4 py-2 rounded-full text-sm transition-all hover:text-white"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
