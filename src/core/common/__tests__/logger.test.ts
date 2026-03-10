import { createLogger } from '../logger';

describe('createLogger', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('info calls console.log when debug=true', () => {
    createLogger(true).info('test');
    expect(console.log).toHaveBeenCalled();
  });

  it('warn calls console.warn when debug=true', () => {
    createLogger(true).warn('test');
    expect(console.warn).toHaveBeenCalled();
  });

  it('info does NOT call console.log when debug=false', () => {
    createLogger(false).info('test');
    expect(console.log).not.toHaveBeenCalled();
  });

  it('warn does NOT call console.warn when debug=false', () => {
    createLogger(false).warn('test');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('error calls console.error when debug=false', () => {
    createLogger(false).error('test');
    expect(console.error).toHaveBeenCalled();
  });

  it('error calls console.error when debug=true', () => {
    createLogger(true).error('test');
    expect(console.error).toHaveBeenCalled();
  });

  it('includes [SQLiteSync] prefix', () => {
    createLogger(true).info('test message');
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      '[SQLiteSync]',
      'test message'
    );
  });

  it('includes ISO timestamp', () => {
    createLogger(true).info('test');
    const timestamp = (console.log as jest.Mock).mock.calls[0][0];
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('defaults to debug=false when called without arguments', () => {
    createLogger().info('test');
    expect(console.log).not.toHaveBeenCalled();

    createLogger().error('test');
    expect(console.error).toHaveBeenCalled();
  });
});
