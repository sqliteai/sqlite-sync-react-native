import {
  isForegroundSqliteCloudNotification,
  isSqliteCloudNotification,
} from '../isSqliteCloudNotification';

describe('isSqliteCloudNotification', () => {
  it('detects foreground apply notifications', () => {
    expect(
      isForegroundSqliteCloudNotification({
        request: { content: { data: { cloudSyncEvent: 'apply' } } },
      })
    ).toBe(true);
  });

  it('detects foreground check notifications', () => {
    expect(
      isForegroundSqliteCloudNotification({
        request: {
          content: {
            data: { cloudSyncEvent: 'check', artifactURI: 's3://artifact' },
          },
        },
      })
    ).toBe(true);
  });

  it('detects iOS background notifications', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: { cloudSyncEvent: 'apply' } },
      })
    ).toBe(true);
  });

  it('detects Android background notifications from body JSON', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: '{"cloudSyncEvent":"check","artifactURI":"s3://..."}' },
      })
    ).toBe(true);
  });

  it('detects Android background notifications from dataString JSON', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: '{}', dataString: '{"cloudSyncEvent":"apply"}' },
      })
    ).toBe(true);
  });

  it('rejects notifications without cloudSyncEvent', () => {
    expect(
      isSqliteCloudNotification({
        data: { body: '{}', dataString: '{}' },
      })
    ).toBe(false);
  });
});
