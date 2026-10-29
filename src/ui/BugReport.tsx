/**
 * The bug button (in the nav, on every page) and its box: the owner's text,
 * plus the header and the diagnostics log as they were when the box opened,
 * sent by `copy` or as a prefilled GitHub new-issue page (`open on github`,
 * which the owner submits there). The text and URL are `bugReportText.ts`.
 */
import { useMemo, useRef, useState } from 'react';
import { getAudioContext } from '../audio/TransportEngine';
import { diagnostics } from '../state/diagnostics';
import { formatBugReport, issueLink, type BugReport as Report } from './bugReportText';
import { COPY } from './copy';
import { reportHeader } from './diagnosticsCapture';
import { useSpine } from './spine';

const buttonClass = 'rounded-md border border-line bg-bg px-4 py-2 text-sm text-text';

export function BugReport({ page }: { page: string }) {
  const { transport, midi, audio } = useSpine();
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState('');
  const [snapshot, setSnapshot] = useState<Omit<Report, 'message'> | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const report = useMemo(() => (snapshot ? { ...snapshot, message } : null), [snapshot, message]);
  const text = useMemo(() => (report ? formatBugReport(report) : ''), [report]);
  const link = useMemo(() => (report ? issueLink(report) : null), [report]);

  function open(): void {
    const header = reportHeader({ toneContext: getAudioContext(), transport, midi, gate: audio.state(), page });
    setSnapshot({ header, entries: diagnostics.snapshot() });
    setStatus(null);
    dialog.current?.showModal();
  }

  function copy(): void {
    // writeText must start inside the click, before any await.
    const write = navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('no clipboard'));
    write.then(
      () => setStatus({ ok: true, text: COPY.bug.copied }),
      () => setStatus({ ok: false, text: COPY.bug.copyFailed }),
    );
  }

  const cut = link !== null && (link.droppedEntries > 0 || link.messageCut);

  return (
    <>
      <button type="button" data-bug-button onClick={open} className="shrink-0 rounded-md border border-line px-3 py-1 text-sm text-text">
        {COPY.bug.button}
      </button>
      <dialog
        ref={dialog}
        data-bug-box
        aria-labelledby="bug-heading"
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-4 text-text backdrop:bg-bg/80"
      >
        <div className="flex flex-col gap-3">
          <h2 id="bug-heading" className="text-base font-semibold">
            {COPY.bug.heading}
          </h2>
          <p className="text-sm text-warn">{COPY.bug.publicNote}</p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted">{COPY.bug.field}</span>
            <textarea
              data-bug-message
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="rounded-md border border-line bg-bg p-2 text-sm text-text"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-bug-copy onClick={copy} className={buttonClass}>
              {COPY.bug.copy}
            </button>
            {link && (
              <a data-bug-github href={link.url} target="_blank" rel="noopener noreferrer" className={buttonClass}>
                {COPY.bug.github}
              </a>
            )}
            <button type="button" data-bug-close onClick={() => dialog.current?.close()} className={`ml-auto ${buttonClass}`}>
              {COPY.bug.close}
            </button>
          </div>
          {status && (
            <p data-bug-status role="status" className={`text-sm ${status.ok ? 'text-ok' : 'text-bad'}`}>
              {status.ok ? '✓ ' : '✗ '}
              {status.text}
            </p>
          )}
          {cut && (
            <p data-bug-cut className="text-sm text-warn">
              {COPY.bug.cut}
            </p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted">{COPY.bug.details}</summary>
            <pre data-bug-text className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg p-2 text-xs select-all">
              {text}
            </pre>
          </details>
        </div>
      </dialog>
    </>
  );
}
