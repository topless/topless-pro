import { useEffect } from 'react';

/**
 * Sets document.title imperatively. The Worker injects a server-side <title>
 * into the shell for crawlers; React 19's hoisted <title> would sit after it
 * and lose, so client-side navigation updates the existing element instead.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    if (title !== null) document.title = title;
  }, [title]);
}
