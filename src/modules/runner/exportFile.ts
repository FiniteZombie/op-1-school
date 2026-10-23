// Browser side of `export`: a download, and the clipboard. Thin on purpose;
// the text is `sessionMarkdown`'s.

export function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Resolves true when the clipboard took the text. Must be called inside the click, before any await. */
export function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}
