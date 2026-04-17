import { vi, beforeEach, afterEach } from 'vitest';

/**
 * Test-Setup: unterdrückt Console-Ausgaben, damit Testlogs übersichtlich bleiben.
 */
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
