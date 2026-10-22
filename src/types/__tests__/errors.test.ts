import { expect, test } from 'vitest';
import { NotImplementedError } from '../errors';

test('NotImplementedError names the stub and what replaces it', () => {
  const err = new NotImplementedError('MicInput.start', 'Phase 3, Module 3 lane');
  expect(err).toBeInstanceOf(Error);
  expect(err).toBeInstanceOf(NotImplementedError);
  expect(err.name).toBe('NotImplementedError');
  expect(err.message).toBe('MicInput.start is not implemented yet (Phase 3, Module 3 lane)');
  expect(err.replacedBy).toBe('Phase 3, Module 3 lane');
  expect(() => {
    throw err;
  }).toThrow(NotImplementedError);
});
