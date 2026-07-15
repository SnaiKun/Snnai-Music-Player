import { useEffect, useRef } from 'react';
import { usePlayerStore } from '../store';

/**
 * Syncs the Web Media Session API with the Zustand player state.
 * This enables OS-level media controls: hardware media keys,
 * lock screen controls, and taskbar media overlay on Windows.
 */
export function useMediaSession() {
  const {
    currentTrack,
    isPlaying,
    duration,
    progress,
    togglePlay,
    next,
    previous,
  } = usePlayerStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Find the audio element created by PlayerBar
  useEffect(() => {
    audioRef.current = document.querySelector('audio');
  }, []);

  // Update metadata when track changes
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [
        {
          src: currentTrack.artworkUrl,
          sizes: '600x600',
          type: 'image/jpeg',
        },
      ],
    });
  }, [currentTrack]);

  // Sync playback state
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Sync position state (for seek UI in OS media overlays)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(progress, duration),
      });
    } catch {
      // setPositionState can throw if duration is invalid
    }
  }, [progress, duration]);

  // Register action handlers
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      ['play', () => { if (!isPlaying) togglePlay(); }],
      ['pause', () => { if (isPlaying) togglePlay(); }],
      ['stop', () => togglePlay()],
      ['nexttrack', () => next()],
      ['previoustrack', () => previous()],
      ['seekto', (details) => {
        if (details.seekTime != null) {
          const audio = document.querySelector('audio') as HTMLAudioElement | null;
          if (audio) audio.currentTime = details.seekTime;
          usePlayerStore.getState().setProgress(details.seekTime);
        }
      }],
      ['seekforward', (details) => {
        const audio = document.querySelector('audio') as HTMLAudioElement | null;
        if (audio) {
          const skip = details.seekOffset ?? 10;
          audio.currentTime = Math.min(audio.currentTime + skip, audio.duration);
        }
      }],
      ['seekbackward', (details) => {
        const audio = document.querySelector('audio') as HTMLAudioElement | null;
        if (audio) {
          const skip = details.seekOffset ?? 10;
          audio.currentTime = Math.max(audio.currentTime - skip, 0);
        }
      }],
    ];

    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers don't support all actions
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore
        }
      }
    };
  }, [isPlaying, togglePlay, next, previous]);
}
