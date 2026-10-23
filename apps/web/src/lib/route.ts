// A small path router: four screens do not need a routing library.

import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'patient'; id: string }
  | { name: 'log'; tab: 'audit' | 'network' }
  | { name: 'about' };

export function parseRoute(pathname: string): Route {
  const m = /^\/patients\/([\w-]+)\/?$/.exec(pathname);
  if (m) return { name: 'patient', id: m[1]! };
  if (pathname.startsWith('/log/network')) return { name: 'log', tab: 'network' };
  if (pathname.startsWith('/log')) return { name: 'log', tab: 'audit' };
  if (pathname.startsWith('/about')) return { name: 'about' };
  return { name: 'home' };
}

const NAV = 'passayge:navigate';

export function navigate(path: string): void {
  if (location.pathname + location.search === path) return;
  history.pushState(null, '', path);
  window.dispatchEvent(new Event(NAV));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.pathname));
  useEffect(() => {
    const update = () => setRoute(parseRoute(location.pathname));
    window.addEventListener('popstate', update);
    window.addEventListener(NAV, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(NAV, update);
    };
  }, []);
  return route;
}

/** A link that navigates without reloading, but stays a real link for keyboard and screen readers. */
export function onLinkClick(path: string) {
  return (e: { preventDefault(): void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; button: number }) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    navigate(path);
  };
}
