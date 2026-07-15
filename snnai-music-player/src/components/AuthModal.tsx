import { useState } from 'react';
import { supabase } from '../supabase';
import { X, Loader2 } from 'lucide-react';

interface AuthModalProps {
  onClose: () => void;
}

export default function AuthModal({ onClose }: AuthModalProps) {
  const [viewState, setViewState] = useState<'login' | 'signup' | 'forgot-password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (viewState === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else if (viewState === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        onClose();
      } else if (viewState === 'forgot-password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'http://localhost:5000/reset-password.html',
        });
        if (error) throw error;
        setSuccessMessage('Password reset link sent to your email!');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
        <div 
          className="pointer-events-auto flex flex-col w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                className="w-8 h-8 rounded-lg object-contain"
                alt="Snnai Logo"
              />
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {viewState === 'login' ? 'Welcome Back' : viewState === 'signup' ? 'Create Account' : 'Reset Password'}
              </h2>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg mb-4 text-sm font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div className="px-3 py-2 rounded-lg mb-4 text-sm font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5 ml-1" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input 
                type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-light)]"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                placeholder="you@example.com"
              />
            </div>
            
            {viewState !== 'forgot-password' && (
              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="block text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>Password</label>
                  <button 
                    type="button" 
                    onClick={() => {
                      setViewState('forgot-password');
                      setError(null);
                      setSuccessMessage(null);
                    }} 
                    className="text-xs font-semibold" 
                    style={{ color: 'var(--accent-light)' }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <input 
                  type="password" required minLength={6}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-light)]"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit" disabled={isLoading}
              className="mt-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 12px var(--accent-glow)' }}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : viewState === 'login' ? (
                'Sign In'
              ) : viewState === 'signup' ? (
                'Sign Up'
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
            {viewState === 'login' && (
              <>
                Don't have an account?{' '}
                <button type="button" onClick={() => { setViewState('signup'); setError(null); setSuccessMessage(null); }} className="font-semibold" style={{ color: 'var(--accent-light)' }}>
                  Sign up
                </button>
              </>
            )}
            {viewState === 'signup' && (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => { setViewState('login'); setError(null); setSuccessMessage(null); }} className="font-semibold" style={{ color: 'var(--accent-light)' }}>
                  Log in
                </button>
              </>
            )}
            {viewState === 'forgot-password' && (
              <button type="button" onClick={() => { setViewState('login'); setError(null); setSuccessMessage(null); }} className="font-semibold" style={{ color: 'var(--accent-light)' }}>
                Back to Sign In
              </button>
            )}
          </p>
        </div>
      </div>
    </>
  );
}
