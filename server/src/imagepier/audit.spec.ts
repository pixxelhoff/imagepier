import type { AuthDto } from 'src/dtos/auth.dto.js';
import {
  AuditEntry,
  DEFAULT_AUDIT_SETTINGS,
  MAX_AUDIT_ASSET_IDS,
  applyAuditSettings,
  parseAuditSettings,
  recordDownload,
  setAuditSink,
} from 'src/imagepier/audit.js';

describe('ImagePier audit log', () => {
  afterEach(() => {
    setAuditSink(undefined);
  });

  describe('parseAuditSettings', () => {
    it('should use the defaults', () => {
      expect(parseAuditSettings(undefined)).toEqual(DEFAULT_AUDIT_SETTINGS);
      expect(DEFAULT_AUDIT_SETTINGS.retentionDays).toBe(365);
    });

    it('should limit the retention period', () => {
      expect(parseAuditSettings({ retentionDays: 0 }).retentionDays).toBe(1);
      expect(parseAuditSettings({ retentionDays: 99_999 }).retentionDays).toBe(3650);
      expect(parseAuditSettings({ retentionDays: 'x' }).retentionDays).toBe(365);
    });
  });

  describe('applyAuditSettings', () => {
    const download: AuditEntry = { action: 'download', userId: 'user-1', userName: 'Jane', assetIds: ['a'] };

    it('should only count downloads by default', () => {
      expect(applyAuditSettings(download, DEFAULT_AUDIT_SETTINGS)).toEqual({
        ...download,
        userId: null,
        userName: null,
      });
    });

    it('should keep the person of downloads if enabled', () => {
      const settings = { ...DEFAULT_AUDIT_SETTINGS, downloadsWithUser: true };
      expect(applyAuditSettings(download, settings)).toEqual(download);
    });

    it('should skip logins unless enabled', () => {
      const login: AuditEntry = { action: 'login', userId: 'user-1' };
      expect(applyAuditSettings(login, DEFAULT_AUDIT_SETTINGS)).toBeUndefined();
      expect(applyAuditSettings(login, { ...DEFAULT_AUDIT_SETTINGS, logins: true })).toEqual({
        ...login,
        assetIds: [],
      });
    });

    it('should limit the stored asset ids', () => {
      const assetIds = Array.from({ length: MAX_AUDIT_ASSET_IDS + 5 }, (_, index) => `asset-${index}`);
      const result = applyAuditSettings({ action: 'trash', userId: 'user-1', assetIds }, DEFAULT_AUDIT_SETTINGS);
      expect(result?.assetIds).toHaveLength(MAX_AUDIT_ASSET_IDS);
    });
  });

  describe('recordDownload', () => {
    it('should report downloads to the sink', () => {
      const entries: AuditEntry[] = [];
      setAuditSink((entry) => {
        entries.push(entry);
      });

      recordDownload({ user: { id: 'user-1', name: 'Jane' } } as AuthDto, ['a', 'b'], 'archive');

      expect(entries).toEqual([
        {
          action: 'download',
          userId: 'user-1',
          userName: 'Jane',
          assetIds: ['a', 'b'],
          details: { kind: 'archive', sharedLink: false },
        },
      ]);
    });

    it('should do nothing without a sink', () => {
      expect(() =>
        recordDownload({ user: { id: 'user-1', name: 'Jane' } } as AuthDto, ['a'], 'original'),
      ).not.toThrow();
    });
  });
});
