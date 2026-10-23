import { useEffect, useState, type RefObject } from 'react';

/** Which edges of a horizontally scrolling element hide more content, for an edge fade. */
export function useEdgeFade(ref: RefObject<HTMLElement | null>): { left: boolean; right: boolean } {
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
    };
    const frame = requestAnimationFrame(measure);
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    ro?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
    };
  }, [ref]);
  return edges;
}
