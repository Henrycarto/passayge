// Tooltips that open on hover, keyboard focus and tap, close with Escape, stay open while the
// pointer is over them (WCAG 1.4.13), and are tied to their control with aria-describedby.

import { cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY_BY_ID } from '@passayge/core';

type AnyProps = Record<string, unknown> & { ref?: unknown };

/** `right` keeps the tooltip beside its control, for controls with content right below (the search box). */
export function Tip({ content, children, placement = 'below' }: { content: ReactNode; children: ReactElement<AnyProps>; placement?: 'below' | 'right' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement | null>(null);
  // The close timer lives in state, not a ref, so the handlers below never touch a ref during render.
  const [timer, setTimer] = useState<number>();
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  const show = () => {
    window.clearTimeout(timer);
    setTimer(undefined);
    setOpen(true);
  };
  const hideSoon = () => {
    window.clearTimeout(timer);
    setTimer(window.setTimeout(() => setOpen(false), 120));
  };
  const hide = useCallback(() => {
    setTimer((t) => {
      window.clearTimeout(t);
      return undefined;
    });
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!anchor?.contains(t) && !tip.current?.contains(t)) hide();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, hide, anchor]);

  useLayoutEffect(() => {
    if (!open || !anchor || !tip.current) return;
    const a = anchor.getBoundingClientRect();
    const t = tip.current.getBoundingClientRect();
    if (placement === 'right' && a.right + 8 + t.width < window.innerWidth) {
      setPos({ top: Math.max(8, Math.min(a.top, window.innerHeight - t.height - 8)), left: a.right + 8 });
      return;
    }
    const below = a.bottom + 8 + t.height < window.innerHeight;
    const top = below ? a.bottom + 8 : a.top - 8 - t.height;
    const left = Math.min(Math.max(8, a.left), window.innerWidth - t.width - 8);
    setPos({ top, left });
  }, [open, anchor, placement]);

  useEffect(() => () => window.clearTimeout(timer), [timer]);

  const p = children.props;
  const call = (name: string, e: unknown) => (p[name] as ((e: unknown) => void) | undefined)?.(e);
  const child = cloneElement(children, {
    ref: setAnchor,
    'aria-describedby': [p['aria-describedby'], id].filter(Boolean).join(' '),
    onMouseEnter: (e: unknown) => {
      call('onMouseEnter', e);
      show();
    },
    onMouseLeave: (e: unknown) => {
      call('onMouseLeave', e);
      hideSoon();
    },
    onFocus: (e: unknown) => {
      call('onFocus', e);
      show();
    },
    onBlur: (e: unknown) => {
      call('onBlur', e);
      hide();
    },
    onPointerDown: (e: { pointerType?: string }) => {
      call('onPointerDown', e);
      if (e.pointerType && e.pointerType !== 'mouse') setOpen((o) => !o);
    },
    onKeyDown: (e: { key: string }) => {
      call('onKeyDown', e);
      if (e.key === 'Escape') hide();
    },
  });

  return (
    <>
      {child}
      {createPortal(
        <div
          ref={tip}
          id={id}
          role="tooltip"
          className="tip"
          hidden={!open}
          style={{ top: pos.top, left: pos.left }}
          onMouseEnter={show}
          onMouseLeave={hideSoon}
        >
          {content}
        </div>,
        document.body,
      )}
    </>
  );
}

/** A glossary term in running text: dotted underline, explanation on hover, focus or tap. */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const t = GLOSSARY_BY_ID[id];
  if (!t) return <>{children}</>;
  return (
    <Tip
      content={
        <>
          <b>
            {t.term}
            {t.de ? <span className="de-tip"> ({t.de})</span> : null}
          </b>
          {t.explain}
        </>
      }
    >
      <button type="button" className="term">
        {children ?? t.term}
      </button>
    </Tip>
  );
}
