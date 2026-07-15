import VocalRemoverWorker from './vocalRemover.worker?worker';

export interface SeparationProgress {
  state: 'decoding' | 'processing' | 'ready' | 'error';
  progress: number;
}

/**
 * Decodes a streaming audio URL, processes vocal removal in a background Web Worker,
 * and returns a local Blob URL representing the processed vocal-free WAV audio.
 */
export async function processVocalRemoval(
  streamUrl: string,
  onProgress?: (status: SeparationProgress) => void
): Promise<string> {
  try {
    if (onProgress) onProgress({ state: 'decoding', progress: 10 });

    // 1. Fetch the audio stream bytes via Rust backend to bypass CORS
    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<number[]>('fetch_audio_bytes', { url: streamUrl });
    const arrayBuffer = new Uint8Array(bytes).buffer;

    if (onProgress) onProgress({ state: 'decoding', progress: 60 });

    // 2. Decode the audio data using OfflineAudioContext (non-blocking file decoder)
    const OfflineAudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const tempCtx = new OfflineAudioContextClass(2, 44100, 44100);
    
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    } catch (decodeErr) {
      console.warn('First decoding attempt failed, trying fallback context', decodeErr);
      // Fallback: try default context
      const fallbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioBuffer = await fallbackCtx.decodeAudioData(arrayBuffer);
    }

    if (onProgress) onProgress({ state: 'processing', progress: 10 });

    const sampleRate = audioBuffer.sampleRate;
    const leftChannel = audioBuffer.getChannelData(0);
    // Handle mono fallback
    const rightChannel = audioBuffer.numberOfChannels > 1 
      ? audioBuffer.getChannelData(1) 
      : new Float32Array(leftChannel);

    // 3. Process in worker
    return new Promise<string>((resolve, reject) => {
      const worker = new VocalRemoverWorker();

      worker.onmessage = (event) => {
        const { wavBuffer } = event.data;
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        const objectUrl = URL.createObjectURL(blob);

        if (onProgress) onProgress({ state: 'ready', progress: 100 });
        worker.terminate();
        resolve(objectUrl);
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      // Clone buffers if transfer fails, or transfer directly for zero-copy speed
      try {
        worker.postMessage(
          {
            left: leftChannel,
            right: rightChannel,
            sampleRate,
          },
          [leftChannel.buffer, rightChannel.buffer]
        );
      } catch (transferErr) {
        // Fallback to copying if buffer is locked/shared
        worker.postMessage({
          left: leftChannel.slice(),
          right: rightChannel.slice(),
          sampleRate,
        });
      }
    });
  } catch (err) {
    if (onProgress) onProgress({ state: 'error', progress: 0 });
    throw err;
  }
}
