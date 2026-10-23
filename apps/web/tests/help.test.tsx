import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GLOSSARY_BY_ID } from '@passayge/core';
import { Glossary, HelpMenu } from '@/components/Help';
import { Status } from '@/components/Status';
import { Term, Tip } from '@/components/Tooltip';
import { STEPS, TOUR_KEY, Tour, readTourDone } from '@/components/Tour';

async function axeClean(container: Element) {
  const r = await axe.run(container, { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } });
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(' ')}`)).toEqual([]);
}

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('tooltips', () => {
  const setup = () =>
    render(
      <Tip content="Records a contact confirmation.">
        <button type="button">Insert e-card</button>
      </Tip>,
    );

  it('is tied to its control with aria-describedby and has the tooltip role', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Insert e-card' });
    const tip = document.getElementById(button.getAttribute('aria-describedby')!)!;
    expect(tip).toHaveAttribute('role', 'tooltip');
    expect(tip).toHaveTextContent('Records a contact confirmation.');
    expect(tip).not.toBeVisible();
    expect(button).toHaveAccessibleDescription('Records a contact confirmation.');
  });

  it('opens on keyboard focus and closes on Escape', async () => {
    setup();
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
  });

  it('opens on hover, stays while the pointer moves onto it, then closes', () => {
    vi.useFakeTimers();
    setup();
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    const tip = screen.getByRole('tooltip');
    expect(tip).toBeVisible();
    fireEvent.mouseLeave(button);
    fireEvent.mouseEnter(tip);
    act(() => vi.advanceTimersByTime(500));
    expect(tip).toBeVisible();
    fireEvent.mouseLeave(tip);
    act(() => vi.advanceTimersByTime(500));
    expect(tip).not.toBeVisible();
  });

  it('opens on tap and closes on a second tap', () => {
    setup();
    const button = screen.getByRole('button');
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    expect(screen.getByRole('tooltip')).toBeVisible();
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
  });

  it('keeps the control’s own handlers working', async () => {
    const onClick = vi.fn();
    render(
      <Tip content="x">
        <button type="button" onClick={onClick}>
          Go
        </button>
      </Tip>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('explains a glossary term with its German name, and passes axe', async () => {
    const { container } = render(
      <p>
        <Term id="contact-confirmation">Contact confirmation</Term>
      </p>,
    );
    const term = screen.getByRole('button', { name: 'Contact confirmation' });
    expect(term).toHaveAccessibleDescription(expect.stringContaining('(Kontaktbestätigung)'));
    expect(term).toHaveAccessibleDescription(expect.stringContaining(GLOSSARY_BY_ID['contact-confirmation']!.explain));
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Kontaktbestätigung');
    await axeClean(container);
  });

  it('explains every status in words, not colour alone', () => {
    render(
      <>
        <Status kind="granted" />
        <Status kind="denied" />
        <Status kind="expired" />
        <Status kind="void" />
      </>,
    );
    for (const word of ['Granted', 'Denied', 'Expired', 'Entered in error']) expect(screen.getByText(word)).toBeInTheDocument();
    expect(screen.getByText('Entered in error').closest('[aria-describedby]')).toHaveAccessibleDescription(GLOSSARY_BY_ID['entered-in-error']!.explain);
  });
});

describe('first-visit tour', () => {
  const targets = () =>
    render(
      <>
        {STEPS.map((s) => (
          <button key={s.target} type="button" data-tour={s.target}>
            {s.title} target
          </button>
        ))}
      </>,
    );

  it('shows five steps, never covers the page and moves focus to the step title', async () => {
    targets();
    const onClose = vi.fn();
    render(<Tour onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: STEPS[0]!.title });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(within(dialog).getByText('Step 1 of 5')).toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading'));
    // The rest of the page stays usable while the tour is open.
    await userEvent.click(screen.getByRole('button', { name: `${STEPS[3]!.title} target` }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('walks forward and back with the keyboard and marks done at the end', async () => {
    targets();
    const onClose = vi.fn();
    render(<Tour onClose={onClose} />);
    for (let i = 1; i < STEPS.length; i++) {
      await userEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText(`Step ${i + 1} of 5`)).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(readTourDone()).toBe(true);
  });

  it('can be skipped, and Escape skips it too', async () => {
    targets();
    const onClose = vi.fn();
    const { unmount } = render(<Tour onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(TOUR_KEY)).toBe('1');
    unmount();
    localStorage.clear();
    const onClose2 = vi.fn();
    render(<Tour onClose={onClose2} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose2).toHaveBeenCalledOnce();
  });

  it('highlights the control each step points at', async () => {
    targets();
    render(<Tour onClose={() => undefined} />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    });
    expect(document.querySelector(`[data-tour="${STEPS[0]!.target}"]`)).toHaveAttribute('data-tour-target', 'true');
  });

  it('is reopened from the help menu', async () => {
    const onTour = vi.fn();
    render(<HelpMenu onClose={() => undefined} onTour={onTour} onGlossary={() => undefined} />);
    expect(screen.getByRole('menuitem', { name: /Take the tour/ })).toHaveFocus();
    await userEvent.click(screen.getByRole('menuitem', { name: /Take the tour/ }));
    expect(onTour).toHaveBeenCalledOnce();
  });

  it('passes axe', async () => {
    targets();
    const { container } = render(<Tour onClose={() => undefined} />);
    await axeClean(container);
  });
});

describe('glossary panel', () => {
  it('lists every term with the official German term and filters as you type', async () => {
    const onClose = vi.fn();
    const { container } = render(<Glossary onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Glossary' })).toBeInTheDocument();
    expect(screen.getByText('(Kontaktbestätigung)')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Filter terms'), 'impf');
    expect(screen.getByText(/1 of \d+ terms/)).toBeInTheDocument();
    await axeClean(container);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
