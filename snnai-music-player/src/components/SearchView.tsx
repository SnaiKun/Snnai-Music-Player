import React, { useState, useCallback, useRef } from 'react';
import { Search, X, Clock, Loader2, ArrowLeft, Play, Heart } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Track as TrackType, Album as AlbumType, Artist as ArtistType, SearchResults as SearchResultsType } from '../types';
import { usePlayerStore, useAppStore } from '../store';
import TrackRow from './TrackRow';
import RecommendationsSection from './RecommendationsSection';
import HistoryRecommendations from './HistoryRecommendations';
import { useHorizontalScroll } from '../hooks/useHorizontalScroll';

export default function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultsType>({ tracks: [], albums: [], artists: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchSource, setSearchSource] = useState<'all' | 'soundcloud'>('all');
  const debounceRef = useRef<number | undefined>(undefined);

  const artistsScrollRef = useHorizontalScroll();
  const albumsScrollRef = useHorizontalScroll();

  const { 
    recentSearches, 
    addRecentSearch, 
    selectedArtist, 
    selectedAlbum, 
    setSelectedArtist, 
    setSelectedAlbum 
  } = useAppStore();

  const [subViewTracks, setSubViewTracks] = useState<TrackType[]>([]);
  const [isSubViewLoading, setIsSubViewLoading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  const { playTrack, currentTrack } = usePlayerStore();

  // Automatically load tracks and check favorite status when selectedArtist changes
  React.useEffect(() => {
    if (selectedArtist) {
      setIsSubViewLoading(true);
      setSubViewTracks([]);
      invoke<TrackType[]>('lookup_artist', { artistId: selectedArtist.id })
        .then(setSubViewTracks)
        .catch((err) => console.error('Failed to lookup artist:', err))
        .finally(() => setIsSubViewLoading(false));

      invoke<boolean>('is_artist_favorited', { artistId: selectedArtist.id })
        .then(setIsFavorited)
        .catch((err) => console.error('Failed to check favorite status:', err));
    }
  }, [selectedArtist]);

  // Automatically load tracks when selectedAlbum changes
  React.useEffect(() => {
    if (selectedAlbum) {
      setIsSubViewLoading(true);
      setSubViewTracks([]);
      invoke<TrackType[]>('lookup_album', { albumId: selectedAlbum.id })
        .then(setSubViewTracks)
        .catch((err) => console.error('Failed to lookup album:', err))
        .finally(() => setIsSubViewLoading(false));
    }
  }, [selectedAlbum]);

  const handleToggleFavorite = async () => {
    if (!selectedArtist) return;
    try {
      const newStatus: boolean = await invoke('toggle_favorite_artist', {
        artistId: selectedArtist.id,
        name: selectedArtist.name,
        genre: selectedArtist.genre || null,
      });
      setIsFavorited(newStatus);
    } catch (err) {
      console.error('Failed to toggle artist favorite:', err);
    }
  };

  // doSearch definition replaced below

  const doSearch = useCallback(async (q: string, source: 'all' | 'soundcloud' = 'all') => {
    const term = q.trim();
    if (!term) {
      setResults({ tracks: [], albums: [], artists: [] });
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      if (source === 'soundcloud') {
        const tracks: TrackType[] = await invoke('search_soundcloud', {
          query: term,
          limit: 30,
        });
        setResults({ tracks, albums: [], artists: [] });
      } else {
        const raw: SearchResultsType = await invoke('search_all', { query: term });
        setResults(raw);
      }
      setHasSearched(true);
      setSelectedAlbum(null);
      setSelectedArtist(null);
      addRecentSearch(term);
      await invoke('save_search', { query: term }).catch(() => {});
    } catch (e: unknown) {
      setSearchError(String(e));
      setResults({ tracks: [], albums: [], artists: [] });
    } finally {
      setIsSearching(false);
    }
  }, [addRecentSearch, setSelectedAlbum, setSelectedArtist]);

  const handleSourceChange = (source: 'all' | 'soundcloud') => {
    setSearchSource(source);
    setResults({ tracks: [], albums: [], artists: [] });
    setSelectedAlbum(null);
    setSelectedArtist(null);
    if (query.trim()) {
      doSearch(query, source);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setResults({ tracks: [], albums: [], artists: [] });
      setHasSearched(false);
      setSearchError(null);
      setSelectedAlbum(null);
      setSelectedArtist(null);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(val, searchSource), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      clearTimeout(debounceRef.current);
      doSearch(query, searchSource);
    }
  };

  const handlePlayAll = () => {
    if (results.tracks.length > 0) playTrack(results.tracks[0], results.tracks);
  };

  const handleSelectAlbum = (album: AlbumType) => {
    setSelectedAlbum(album);
    setSelectedArtist(null);
  };

  const handleSelectArtist = (artist: ArtistType) => {
    setSelectedArtist(artist);
    setSelectedAlbum(null);
  };

  // ─── Sub-views ─────────────────────────────────────────────────────────────

  if (selectedAlbum) {
    return (
      <div className="flex flex-col h-full overflow-hidden animate-fade-in">
        {/* Sub-view Header */}
        <div className="px-4 md:px-8 pt-6 pb-4 shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setSelectedAlbum(null)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-white"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={16} />
            Back to search
          </button>
        </div>

        {/* Sub-view Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {/* Album Info Row */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-8 text-center sm:text-left">
            <img
              src={selectedAlbum.artworkUrl}
              alt={selectedAlbum.name}
              className="w-40 h-40 rounded-2xl object-cover shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="%231a1a28"/><text x="50%" y="55%" text-anchor="middle" dy=".1em" font-size="40">💿</text></svg>';
              }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Album</span>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white truncate mt-1 mb-2">
                {selectedAlbum.name}
              </h2>
              <p className="text-sm text-gray-300">
                <span className="font-semibold text-white transition-colors hover:underline hover:cursor-pointer" onClick={() => {
                  setQuery(selectedAlbum.artist);
                  doSearch(selectedAlbum.artist);
                }}>
                  {selectedAlbum.artist}
                </span>
                {selectedAlbum.genre && ` • ${selectedAlbum.genre}`}
                {selectedAlbum.trackCount > 0 && ` • ${selectedAlbum.trackCount} Songs`}
              </p>
              
              {subViewTracks.length > 0 && (
                <button
                  onClick={() => playTrack(subViewTracks[0], subViewTracks)}
                  className="mt-4 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 hover:brightness-110"
                  style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 16px var(--accent-glow)' }}
                >
                  <Play size={16} fill="white" />
                  Play Album
                </button>
              )}
            </div>
          </div>

          {/* Album Songs List */}
          {isSubViewLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={20} className="animate-spin-slow" />
              <span>Loading album songs…</span>
            </div>
          ) : subViewTracks.length > 0 ? (
            <div className="flex flex-col">
              {subViewTracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i + 1}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No tracks found in this album.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedArtist) {
    return (
      <div className="flex flex-col h-full overflow-hidden animate-fade-in">
        {/* Sub-view Header */}
        <div className="px-4 md:px-8 pt-6 pb-4 shrink-0 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setSelectedArtist(null)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:text-white"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={16} />
            Back to search
          </button>
        </div>

        {/* Sub-view Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
          {/* Artist Info Row */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 mb-8 text-center sm:text-left">
            <div
              className="w-32 h-32 rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 text-5xl font-extrabold text-white"
              style={{ 
                background: 'linear-gradient(135deg, var(--accent) 0%, #ec4899 100%)',
                boxShadow: 'inset 0 4px 8px rgba(255,255,255,0.2), 0 8px 32px var(--accent-glow)',
                textShadow: '0 4px 8px rgba(0,0,0,0.3)',
              }}
            >
              {selectedArtist.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Artist</span>
              <div className="flex items-center gap-4 mt-1 mb-2">
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white truncate">
                  {selectedArtist.name}
                </h2>
                <button
                  onClick={handleToggleFavorite}
                  className="p-2 rounded-full transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                  style={{ 
                    background: 'var(--bg-elevated)', 
                    border: '1px solid var(--border)',
                  }}
                  title={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                >
                  <Heart 
                    size={16} 
                    fill={isFavorited ? '#ec4899' : 'transparent'} 
                    className={isFavorited ? 'text-pink-500' : 'text-gray-400'} 
                  />
                </button>
              </div>
              <p className="text-sm text-gray-300">
                {selectedArtist.genre && `Genre: ${selectedArtist.genre}`}
              </p>
              
              {subViewTracks.length > 0 && (
                <button
                  onClick={() => playTrack(subViewTracks[0], subViewTracks)}
                  className="mt-4 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 hover:brightness-110"
                  style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 16px var(--accent-glow)' }}
                >
                  <Play size={16} fill="white" />
                  Play Songs
                </button>
              )}
            </div>
          </div>

          {/* Artist Songs List */}
          <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Popular Songs</h3>
          {isSubViewLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 size={20} className="animate-spin-slow" />
              <span>Loading artist songs…</span>
            </div>
          ) : subViewTracks.length > 0 ? (
            <div className="flex flex-col">
              {subViewTracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i + 1}
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No tracks found for this artist.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Standard View ─────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search Header */}
      <div
        className="px-4 md:px-8 pt-8 pb-6 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <h1 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
          Search
        </h1>
        <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center max-w-2xl">
          <div className="relative flex-1 w-full">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={query}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={searchSource === 'soundcloud' ? "Search SoundCloud..." : "Artist, song, or album..."}
              className="w-full pl-10 pr-10 py-3.5 rounded-full text-sm outline-none transition-all neumorphic-in"
              style={{
                color: 'var(--text-primary)',
                border: '1px solid transparent',
                paddingLeft: '2.75rem',
                paddingRight: '2.5rem',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--accent-light)';
                e.target.style.boxShadow = '0 0 15px var(--accent-glow) inset, 0 0 15px var(--accent-glow)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'transparent';
                e.target.style.boxShadow = 'var(--shadow-in)';
              }}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults({ tracks: [], albums: [], artists: [] });
                  setHasSearched(false);
                  setSelectedAlbum(null);
                  setSelectedArtist(null);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          {/* Search Source Switcher */}
          <div 
            className="flex p-1 rounded-full border shrink-0 animate-fade-in gap-1" 
            style={{ 
              background: 'rgba(255, 255, 255, 0.04)', 
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            }}
          >
            <button
              onClick={() => handleSourceChange('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all uppercase`}
              style={{
                background: searchSource === 'all' ? 'var(--accent)' : 'transparent',
                color: searchSource === 'all' ? 'white' : 'var(--text-secondary)',
                boxShadow: searchSource === 'all' ? '0 2px 8px var(--accent-glow)' : 'none',
              }}
            >
              All Music
            </button>
            <button
              onClick={() => handleSourceChange('soundcloud')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider transition-all uppercase`}
              style={{
                background: searchSource === 'soundcloud' ? '#ff5500' : 'transparent',
                color: searchSource === 'soundcloud' ? 'white' : 'var(--text-secondary)',
                boxShadow: searchSource === 'soundcloud' ? '0 2px 8px rgba(255,85,0,0.4)' : 'none',
              }}
            >
              SoundCloud
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
        {isSearching && (
          <div className="flex items-center gap-2 py-8 justify-center" style={{ color: 'var(--text-secondary)' }}>
            <Loader2 size={20} className="animate-spin-slow" />
            <span>Searching…</span>
          </div>
        )}

        {searchError && !isSearching && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            {searchError}
          </div>
        )}

        {/* Recent Searches */}
        {!hasSearched && !isSearching && !query && recentSearches.length > 0 && (
          <div className="animate-fade-in">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              Recent Searches
            </h3>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); doSearch(s); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all hover:text-white"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Clock size={12} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {hasSearched && !isSearching && results.tracks.length === 0 && results.albums.length === 0 && results.artists.length === 0 && !searchError && (
          <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
            <p className="text-lg mb-1">No results for "{query}"</p>
            <p className="text-sm">Try a different search term</p>
          </div>
        )}

        {!isSearching && hasSearched && (
          <div className="animate-fade-in flex flex-col gap-10">
            {/* Artists section */}
            {results.artists && results.artists.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Artists</h3>
                <div ref={artistsScrollRef} className="flex gap-4 overflow-x-auto pt-2 pb-3 px-1" style={{ scrollbarWidth: 'thin' }}>
                  {results.artists.map((artist) => (
                    <button
                      key={artist.id}
                      onClick={() => handleSelectArtist(artist)}
                      className="flex flex-col items-center gap-2 shrink-0 group transition-all hover:scale-105"
                      style={{ width: '100px' }}
                    >
                      <div 
                        className="w-20 h-20 rounded-full flex items-center justify-center relative overflow-hidden transition-all group-hover:shadow-[0_0_15px_var(--accent-glow)] text-2xl font-bold text-white shadow-inner"
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

            {/* Albums section */}
            {results.albums && results.albums.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Albums</h3>
                <div ref={albumsScrollRef} className="flex gap-4 overflow-x-auto pt-2 pb-3 px-1" style={{ scrollbarWidth: 'thin' }}>
                  {results.albums.map((album) => (
                    <button
                      key={album.id}
                      onClick={() => handleSelectAlbum(album)}
                      className="flex flex-col gap-1.5 shrink-0 rounded-xl overflow-hidden transition-all hover:scale-105 text-left group"
                      style={{
                        width: '120px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <div className="relative w-full aspect-square overflow-hidden">
                        <img
                          src={album.artworkUrl}
                          alt={album.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 130"><rect width="130" height="130" fill="%231a1a28"/><text x="50%" y="55%" text-anchor="middle" dy=".1em" font-size="30">💿</text></svg>';
                          }}
                        />
                      </div>
                      <div className="px-2 pb-2 min-w-0">
                        <p className="text-xs font-semibold truncate text-white group-hover:text-purple-400">
                          {album.name}
                        </p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {album.artist}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Songs section */}
            {results.tracks && results.tracks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Songs</h3>
                  <button
                    onClick={handlePlayAll}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all hover:opacity-90"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    Play All
                  </button>
                </div>
                <div className="flex flex-col">
                  {results.tracks.map((track, i) => (
                    <TrackRow
                      key={track.id}
                      track={track}
                      index={i + 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendations — shown when not actively searching */}
        {!query && !isSearching && (
          <>
            <HistoryRecommendations />
            {currentTrack && (
              <RecommendationsSection
                artist={currentTrack.artist}
                genre={currentTrack.genreName ?? ''}
                excludeId={currentTrack.id}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
