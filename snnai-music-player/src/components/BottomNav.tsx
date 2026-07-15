import { useState } from 'react';
import { Search, Library, Moon, Sun, LogIn, LogOut } from 'lucide-react';
import { useAppStore } from '../store';
import { supabase } from '../supabase';
import AuthModal from './AuthModal';

export default function BottomNav() {
  const {
    activeView,
    setActiveView,
    theme,
    toggleTheme,
    session,
  } = useAppStore();

  const [showAuthModal, setShowAuthModal] = useState(false);

  const navItem = (
    label: string,
    icon: React.ReactNode,
    view: 'search' | 'library' | 'playlist'
  ) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => setActiveView(view)}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95"
        style={{
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
        }}
      >
        <div className="relative">
          {icon}
          {isActive && (
            <div
              className="absolute -inset-1.5 rounded-full -z-10 opacity-20 blur-sm"
              style={{ background: 'var(--accent)' }}
            />
          )}
        </div>
        <span className="text-[10px] font-semibold tracking-wide">{label}</span>
      </button>
    );
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around z-50 md:hidden px-4"
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Search View Tab */}
        {navItem('Search', <Search size={20} />, 'search')}

        {/* Library View Tab */}
        {navItem('Library', <Library size={20} />, 'library')}

        {/* Theme Toggle Tab */}
        <button
          onClick={toggleTheme}
          className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95"
          style={{ color: 'var(--text-secondary)' }}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          <span className="text-[10px] font-semibold tracking-wide">Theme</span>
        </button>

        {/* Auth Tab */}
        {session ? (
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95 text-red-400"
          >
            <LogOut size={20} />
            <span className="text-[10px] font-semibold tracking-wide">Log Out</span>
          </button>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all active:scale-95"
            style={{ color: 'var(--text-secondary)' }}
          >
            <LogIn size={20} />
            <span className="text-[10px] font-semibold tracking-wide">Sign In</span>
          </button>
        )}
      </nav>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </>
  );
}
