// Web Worker to process vocal cancellation and compile WAV file off the main thread

self.onmessage = (e: MessageEvent) => {
  const { left, right, sampleRate } = e.data;

  // Process vocal cancellation with bass preservation
  const len = left.length;
  const mono = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    mono[i] = (left[i] + right[i]) / 2;
  }

  // Lowpass filter for bass (cutoff at 150Hz)
  const rc = 1.0 / (150 * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);
  const bass = new Float32Array(len);
  let y = 0;
  for (let i = 0; i < len; i++) {
    y = y + alpha * (mono[i] - y);
    bass[i] = y;
  }

  const outLeft = new Float32Array(len);
  const outRight = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const vocalCanceled = left[i] - right[i];
    // Mix and clamp
    outLeft[i] = (vocalCanceled * 0.7) + (bass[i] * 0.8);
    outRight[i] = (vocalCanceled * 0.7) + (bass[i] * 0.8);
  }

  // Convert to 16-bit Stereo WAV
  const length = len * 2 * 2; // 16-bit, 2 channels
  const wavBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(wavBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // raw PCM
  view.setUint16(22, 2, true); // stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < len; i++) {
    let sampleL = Math.max(-1, Math.min(1, outLeft[i]));
    view.setInt16(offset, sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7FFF, true);
    offset += 2;

    let sampleR = Math.max(-1, Math.min(1, outRight[i]));
    view.setInt16(offset, sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7FFF, true);
    offset += 2;
  }

  // Send back ArrayBuffer
  (self as any).postMessage({ wavBuffer }, [wavBuffer]);
};

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
export {};
