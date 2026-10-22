/** placeholder: the theme toggle, labelled with the theme it switches to. Saves through settings. */
import { COPY } from './copy';
import { useSetting, useSpine } from './spine';
import { otherTheme } from './theme';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { settings } = useSpine();
  const theme = useSetting('theme');
  return (
    <button
      type="button"
      data-theme-toggle={theme}
      onClick={() => settings.save({ theme: otherTheme(theme) })}
      className={`rounded-md border border-line px-3 py-1 text-sm text-text ${className}`}
    >
      {COPY.themeToggle[theme]}
    </button>
  );
}
