import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

// jsdom has no layout: the tour scrolls its target into view.
Element.prototype.scrollIntoView = function scrollIntoView() {};
