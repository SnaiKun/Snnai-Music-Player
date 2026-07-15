
import { Music2, Play } from 'lucide-react';
import { useAppStore, usePlayerStore } from '../store';
import TrackRow from './TrackRow';

export default function PlaylistView() {
  const { playlists, activePlaylistId, removeTrackFromPlaylist } = useAppStore();
  const { playTrack } = usePlayerStore();

  const playlist = playlists.find((p) => p.id === activePlaylistId);

  if (!playlist) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <p>Select a playlist from the sidebar</p>
      </div>
    );
  }

  const handleRemove = async (trackId: string) => {
    if (!playlist) return;
    try {
      await removeTrackFromPlaylist(playlist.id, trackId);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-4 md:px-8 pt-8 pb-6"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 text-center sm:text-left">
          {/* Playlist Art — grid of track artworks */}
          <div
            className="w-36 h-36 rounded-2xl overflow-hidden shrink-0 flex-wrap flex"
            style={{ background: 'var(--bg-elevated)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
          >
            {playlist.tracks.slice(0, 4).length > 0 ? (
              playlist.tracks.slice(0, 4).map((t) => (
                <img
                  key={t.id}
                  src={t.artworkUrl}
                  alt=""
                  className="w-1/2 h-1/2 object-cover"
                />
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music2 size={40} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
          </div>

          <div className="flex flex-col items-center sm:items-start gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Playlist
            </span>
            <h2 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {playlist.name}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
            </p>

            {playlist.tracks.length > 0 && (
              <button
                onClick={() => playTrack(playlist.tracks[0], playlist.tracks)}
                className="mt-2 flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all hover:opacity-90 w-fit"
                style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 16px var(--accent-glow)' }}
              >
                <Play size={16} fill="white" />
                Play
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
        {playlist.tracks.length === 0 ? (
          <div className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>
            <Music2 size={48} className="mx-auto mb-3 opacity-30" />
            <p>This playlist is empty</p>
            <p className="text-sm mt-1">Search for tracks and add them here</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Column headers */}
            <div
              className="flex items-center gap-4 px-3 py-1 mb-1 text-xs font-semibold uppercase tracking-wider"
              style={{
                color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '8px',
              }}
            >
              <div className="w-6">#</div>
              <div className="w-10" />
              <div className="flex-1">Title</div>
              <div className="w-40 hidden md:block">Album</div>
              <div className="w-10 text-right">Time</div>
              <div className="w-6" />
            </div>

            {playlist.tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i + 1}
                playlistId={playlist.id}
                onRemove={() => handleRemove(track.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
