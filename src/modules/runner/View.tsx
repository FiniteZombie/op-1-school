/**
 * `/runner`, and `/` once registered (decision 9). Home (today's plan or the
 * open session) unless the URL says `?view=library`.
 */
import { useLocation } from '../../ui/navigation';
import { Home } from './Home';
import { Library } from './Library';
import { useRunnerData } from './useRunnerData';

export default function View() {
  const handle = useRunnerData();
  const { query } = useLocation();
  return (
    <main className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        {query.view === 'library' ? <Library attempts={handle.data.kind === 'ready' ? handle.data.attempts : []} /> : <Home handle={handle} />}
      </div>
    </main>
  );
}
