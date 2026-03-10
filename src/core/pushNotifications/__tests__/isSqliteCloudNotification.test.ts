import {
  isForegroundSqliteCloudNotification,
  isSqliteCloudNotification,
} from '../isSqliteCloudNotification';

const ARTIFACT_URI = 'https://sqlite.ai';

describe('isForegroundSqliteCloudNotification', () => {
  it('returns true for valid foreground notification', () => {
    expect(
      isForegroundSqliteCloudNotification({
        request: { content: { data: { artifactURI: ARTIFACT_URI } } },
      })
    ).toBe(true);
  });

  it('returns false for wrong artifactURI', () => {
    expect(
      isForegroundSqliteCloudNotification({
        request: { content: { data: { artifactURI: 'https://other.com' } } },
      })
    ).toBe(false);
  });

  it('returns false for missing data', () => {
    expect(
      isForegroundSqliteCloudNotification({ request: { content: {} } })
    ).toBe(false);
  });

  it('returns false for null input', () => {
    expect(isForegroundSqliteCloudNotification(null)).toBe(false);
  });

  it('returns false for undefined input', () => {
    expect(isForegroundSqliteCloudNotification(undefined)).toBe(false);
  });
});

describe('isSqliteCloudNotification', () => {
  it('detects iOS background object body', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: { artifactURI: ARTIFACT_URI } },
      })
    ).toBe(true);
  });

  it('detects Android JSON string body', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: JSON.stringify({ artifactURI: ARTIFACT_URI }) },
      })
    ).toBe(true);
  });

  it('detects Android dataString fallback', () => {
    expect(
      isSqliteCloudNotification({
        data: { dataString: JSON.stringify({ artifactURI: ARTIFACT_URI }) },
      })
    ).toBe(true);
  });

  it('returns false for invalid JSON in body string', () => {
    expect(
      isSqliteCloudNotification({ data: { body: 'not-json' } })
    ).toBe(false);
  });

  it('falls through to foreground check', () => {
    expect(
      isSqliteCloudNotification({
        request: { content: { data: { artifactURI: ARTIFACT_URI } } },
      })
    ).toBe(true);
  });

  it('returns false for wrong artifactURI', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: { artifactURI: 'https://wrong.com' } },
      })
    ).toBe(false);
  });

  it('returns false for Android dataString with wrong URI', () => {
    expect(
      isSqliteCloudNotification({
        data: {
          dataString: JSON.stringify({
            artifactURI: 'https://wrong.com',
          }),
        },
      })
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSqliteCloudNotification(null)).toBe(false);
  });
});
