import { useState } from 'react';
import { useAppStore } from '../store';
import { invoke } from '@tauri-apps/api/core';
import { X, Loader2, Settings, ShieldAlert, CheckCircle, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { soundcloudClientId, soundcloudClientSecret, setSoundCloudCredentials } = useAppStore();

  const [clientId, setClientId] = useState(soundcloudClientId || '');
  const [clientSecret, setClientSecret] = useState(soundcloudClientSecret || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setTestResult({ success: false, message: 'Please enter both Client ID and Client Secret.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      await invoke('test_soundcloud_credentials', {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
      });
      setTestResult({ success: true, message: 'Connection successful! Credentials are valid.' });
    } catch (err: unknown) {
      setTestResult({ success: false, message: String(err) });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    setSoundCloudCredentials(
      clientId.trim() ? clientId.trim() : null,
      clientSecret.trim() ? clientSecret.trim() : null
    );
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none">
        <div 
          className="pointer-events-auto flex flex-col w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
                <Settings size={16} className="text-white" />
              </div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Settings & API
              </h2>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)]" style={{ color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>

          {/* Description */}
          <div className="mb-5 text-xs text-gray-300 leading-relaxed bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border)]">
            <p className="mb-2 font-semibold text-white">Official SoundCloud API Integration</p>
            <p className="mb-3">
              Configure your API keys to get instant, high-quality search results instead of slow scraping.
            </p>
            <a 
              href="https://soundcloud.com/you/apps" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300 font-semibold hover:underline"
            >
              Get SoundCloud API Keys
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Form */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5 ml-1" style={{ color: 'var(--text-muted)' }}>
                SoundCloud Client ID
              </label>
              <input 
                type="text" 
                value={clientId} 
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-light)]"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                placeholder="Paste Client ID..."
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase mb-1.5 ml-1" style={{ color: 'var(--text-muted)' }}>
                SoundCloud Client Secret
              </label>
              <input 
                type="password" 
                value={clientSecret} 
                onChange={(e) => setClientSecret(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-light)]"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                placeholder="Paste Client Secret..."
              />
            </div>

            {/* Test connection result */}
            {testResult && (
              <div 
                className="px-4 py-3 rounded-xl text-xs flex gap-2 items-start" 
                style={{ 
                  background: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', 
                  color: testResult.success ? '#4ade80' : '#f87171', 
                  border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` 
                }}
              >
                {testResult.success ? <CheckCircle size={14} className="shrink-0 mt-0.5" /> : <ShieldAlert size={14} className="shrink-0 mt-0.5" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                type="button" 
                onClick={handleTestConnection}
                disabled={testing}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all border flex items-center justify-center gap-2 hover:bg-[var(--bg-elevated)] disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                {testing ? <Loader2 size={16} className="animate-spin" /> : 'Test Connection'}
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 12px var(--accent-glow)' }}
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
