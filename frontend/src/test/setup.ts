import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

HTMLFormElement.prototype.requestSubmit = function () {
  this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};
