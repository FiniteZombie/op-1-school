import { AppShell } from './ui/AppShell';
import { SpineProvider } from './ui/spine';

export default function App() {
  return (
    <SpineProvider>
      <AppShell />
    </SpineProvider>
  );
}
