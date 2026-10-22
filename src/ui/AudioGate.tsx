/**
 * The audio start / resume button. Renders nothing while audio runs. Put it
 * at the top of any page that plays sound; audio never starts without a tap.
 */
import { useState } from 'react';
import { COPY } from './copy';
import { useAudioState, useSpine } from './spine';

export function AudioGate({ className = '' }: { className?: string }) {
  const { audio } = useSpine();
  const state = useAudioState();
  const [busy, setBusy] = useState(false);
  if (state === 'running') return null;

  async function onClick(): Promise<void> {
    setBusy(true);
    try {
      await audio.start();
    } catch (err) {
      console.error('audio start failed', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      data-audio-gate={state}
      disabled={busy}
      onClick={() => void onClick()}
      className={`w-full rounded-lg border border-line bg-surface px-4 py-3 text-base font-medium text-text disabled:opacity-60 ${className}`}
    >
      {state === 'off' ? COPY.audioStart : COPY.audioResume}
    </button>
  );
}
