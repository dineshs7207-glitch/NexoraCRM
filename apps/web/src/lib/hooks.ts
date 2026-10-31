import { useSyncExternalStore } from 'react';

/** Matches the CSS breakpoint where the app switches to its phone layout. */
export const MOBILE_QUERY = '(max-width: 760px)';

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
  );
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}
