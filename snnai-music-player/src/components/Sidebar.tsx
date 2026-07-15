import React, { useState } from 'react';
import {
  Search, Library, Plus, Trash2, ListMusic,
  AlertTriangle, Moon, Sun, LogIn, LogOut, Settings
} from 'lucide-react';
import { useAppStore, usePlayerStore } from '../store';
import { supabase } from '../supabase';
import AuthModal from './AuthModal';
import SettingsModal from './SettingsModal';

export default function Sidebar() {
  const {
    playlists, activeView, activePlaylistId,
    setActiveView, setActivePlaylistId, createPlaylist, deletePlaylist,
    isYtdlpAvailable, ytdlpVersion, theme, toggleTheme,
  } = useAppStore();

  const { currentTrack } = usePlayerStore();

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const { session } = useAppStore();

  const handleCreatePlaylist = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      await createPlaylist(name);
      setNewPlaylistName('');
      setShowNewInput(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlaylist = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('Delete this playlist?')) {
      await deletePlaylist(id);
      if (activePlaylistId === id) setActiveView('search');
    }
  };

  const navBtn = (
    label: string,
    icon: React.ReactNode,
    view: 'search' | 'library',
  ) => (
    <button
      onClick={() => setActiveView(view)}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
        activeView === view ? 'text-white shadow-lg' : 'hover:bg-[var(--bg-elevated)]'
      }`}
      style={{
        background: activeView === view ? 'var(--accent)' : 'transparent',
        color: activeView === view ? 'white' : 'var(--text-secondary)',
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <aside
      className="flex flex-col gap-1 py-6 px-4 shrink-0 overflow-y-auto neumorphic-out rounded-2xl relative"
      style={{ width: '260px' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 mb-6">
        <img
          src="/logo.png"
          className="w-8 h-8 rounded-lg object-contain"
          alt="Snnai Logo"
        />
        <span className="font-bold text-gradient text-base">Snnai</span>
      </div>

      {/* Nav */}
      <div className="flex flex-col gap-1 mb-4">
        {navBtn('Search', <Search size={16} />, 'search')}
        {navBtn('Library', <Library size={16} />, 'library')}
      </div>

      {/* Divider */}
      <div className="h-px mx-2 mb-3" style={{ background: 'var(--border)' }} />

      {/* Playlists */}
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Playlists
        </span>
        <button
          onClick={() => setShowNewInput((v) => !v)}
          className="p-0.5 rounded transition-colors hover:text-white"
          style={{ color: 'var(--text-secondary)' }}
          title="New playlist"
        >
          <Plus size={14} />
        </button>
      </div>

      {showNewInput && (
        <div className="flex items-center gap-1 px-2 mb-2 animate-fade-in">
          <input
            autoFocus
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreatePlaylist();
              if (e.key === 'Escape') setShowNewInput(false);
            }}
            placeholder="Playlist name…"
            className="flex-1 rounded px-2 py-1 text-xs outline-none"
            style={{
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />
          <button
            onClick={handleCreatePlaylist}
            disabled={isCreating || !newPlaylistName.trim()}
            className="px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            Add
          </button>
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="px-3 py-4 text-sm rounded-xl text-center font-medium neumorphic-out mb-2" style={{ color: 'var(--text-muted)' }}>
          {!session ? (
            <div className="flex flex-col gap-2 items-center">
              <span>Sign in to save playlists</span>
              <button 
                onClick={() => setShowAuthModal(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] text-white"
              >
                Sign In
              </button>
            </div>
          ) : (
            <span>No playlists yet</span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {playlists.map((pl) => (
            <div
              key={pl.id}
              onClick={() => {
                setActiveView('playlist');
                setActivePlaylistId(pl.id);
              }}
              className={`group flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all cursor-pointer ${
                activeView === 'playlist' && activePlaylistId === pl.id ? 'neumorphic-out font-semibold' : 'hover:bg-[var(--bg-elevated)]'
              }`}
              style={{
                color: activeView === 'playlist' && activePlaylistId === pl.id
                  ? 'var(--text-primary)'
                  : 'var(--text-secondary)',
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ListMusic size={14} className="shrink-0" />
                <span className="truncate">{pl.name}</span>
              </div>
              <button
                onClick={(e) => handleDeletePlaylist(e, pl.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-all"
                style={{ color: 'var(--text-muted)' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* yt-dlp status */}
      <div className="mt-auto pt-4 px-2">
        {isYtdlpAvailable ? (
          <div className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-full neumorphic-in w-fit" style={{ color: 'var(--text-secondary)' }}>
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>yt-dlp {ytdlpVersion}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs font-medium px-2 py-1.5 rounded-full neumorphic-in w-fit text-amber-500">
            <AlertTriangle size={14} />
            <span>yt-dlp not found</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="px-3 mt-4 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-full neumorphic-out transition-transform hover:scale-105 active:scale-95"
            style={{ color: 'var(--text-secondary)' }}
            title="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center justify-center w-8 h-8 rounded-full neumorphic-out transition-transform hover:scale-105 active:scale-95"
            style={{ color: 'var(--text-secondary)' }}
            title="Settings"
          >
            <Settings size={14} />
          </button>
        </div>

        {session ? (
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
            title="Sign Out"
          >
            <LogOut size={12} />
            Sign Out
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 0 10px var(--accent-glow)' }}
          >
            <LogIn size={12} />
            Sign In
          </button>
        )}
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}

      {/* Now Playing mini */}
      {currentTrack && (
        <div
          className="mt-2 p-2 rounded-lg flex items-center gap-2"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <img
            src={currentTrack.artworkUrl}
            className="w-8 h-8 rounded object-cover shrink-0"
            alt=""
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {currentTrack.title}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {currentTrack.artist}
            </p>
          </div>
          {/* Animated bars */}
          <div className="flex items-end gap-0.5 h-4 shrink-0">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-0.5 rounded-sm"
                style={{
                  background: 'var(--accent-light)',
                  animation: `pulse-dot 0.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                  height: '100%',
                }}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
