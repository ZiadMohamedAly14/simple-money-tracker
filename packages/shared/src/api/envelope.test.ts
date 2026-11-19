import { isApiEnvelope } from './envelope';

describe('isApiEnvelope', () => {
  it('accepts a success envelope', () => {
    expect(isApiEnvelope({ message: 'ok', data: { status: 'ok' }, success: true })).toBe(true);
  });

  it('accepts an error envelope with null data', () => {
    expect(isApiEnvelope({ message: 'Not found', data: null, success: false })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', '<html>Bad gateway</html>'],
    ['a missing success flag', { message: 'ok', data: {} }],
    ['a non-string message', { message: 1, data: {}, success: true }],
    ['a missing data key', { message: 'ok', success: true }],
  ])('rejects %s', (_label, value) => {
    expect(isApiEnvelope(value)).toBe(false);
  });
});
