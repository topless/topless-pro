import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Per-history-entry scroll positions. Browser scroll restoration cannot
// recover a position on a page whose content arrives asynchronously (the
// list is not there yet when the browser tries), so pages restore it
// themselves once their data has rendered.
const positions = new Map<string, number>();

export function rememberScroll(key: string): void {
  positions.set(key, window.scrollY);
}

/**
 * On Back/Forward, scroll to where the visitor left this history entry as
 * soon as the page reports its content is ready.
 */
export function useRestoreScroll(ready: boolean): void {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (!ready || navigationType !== 'POP') return;
    const y = positions.get(key);
    if (y !== undefined) window.scrollTo(0, y);
  }, [ready, navigationType, key]);
}
