import { vi } from 'vitest';

export const mockQueue = {
  add: vi.fn(() => Promise.resolve({ id: 'mock-job-id' })),
  close: vi.fn(() => Promise.resolve()),
};

export const mockWorker = {
  on: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
};
