import { Injectable } from '@nestjs/common';
import { sql, type Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { OnEvent } from 'src/decorators.js';
import { AssetStatus, ImmichWorker, SystemMetadataKey } from 'src/enum.js';
import { ACCESS_SETTINGS_KEY, getAreaAccounts, parseAccessSettings } from 'src/imagepier/access-rules.js';
import {
  AUDIT_SETTINGS_KEY,
  AuditAction,
  AuditEntry,
  AuditSettings,
  applyAuditSettings,
  parseAuditSettings,
  setAuditSink,
} from 'src/imagepier/audit.js';
import { CronRepository } from 'src/repositories/cron.repository.js';
import type { ArgOf } from 'src/repositories/event.repository.js';
import { LoggingRepository } from 'src/repositories/logging.repository.js';
import { SystemMetadataRepository } from 'src/repositories/system-metadata.repository.js';
import { UserRepository } from 'src/repositories/user.repository.js';
import type { DB } from 'src/schema/index.js';
import type { SystemMetadata } from 'src/types.js';
import { anyUuid } from 'src/utils/database.js';
import { handlePromiseError } from 'src/utils/misc.js';

const settingsKey = AUDIT_SETTINGS_KEY as SystemMetadataKey;

/** Every night at 03:41: remove entries older than the retention period. */
const CLEANUP_CRON_NAME = 'ImagePierAuditCleanup';
const CLEANUP_CRON_EXPRESSION = '41 3 * * *';

/** Settings are re-read after this time, so changes reach all workers. */
const SETTINGS_TTL_MS = 60_000;

export type AuditFilter = {
  from?: Date;
  to?: Date;
  userId?: string;
  action?: AuditAction;
  limit: number;
  offset: number;
};

export type AuditRow = {
  id: string;
  assetName: string | null;
  createdAt: Date;
  userId: string | null;
  userName: string | null;
  action: string;
  assetIds: string[];
  assetCount: number;
  details: Record<string, unknown> | null;
};

export type LibraryTrashItem = {
  id: string;
  originalFileName: string;
  type: string;
  deletedAt: Date;
  deletedBy: string | null;
};

/**
Audit log of ImagePier.

The table is created by ImagePier itself (`CREATE TABLE IF NOT EXISTS`) instead of an Immich migration:
Immich runs migrations strictly in order of their timestamps, so a migration of ours could block a later
Immich update. Immich's schema check ignores additional tables, and database backups include the table.
*/
@Injectable()
export class ImagePierAuditService {
  private tableReady?: Promise<void>;
  private settings?: { value: AuditSettings; loadedAt: number };

  constructor(
    @InjectKysely() private db: Kysely<DB>,
    private logger: LoggingRepository,
    private cronRepository: CronRepository,
    private systemMetadataRepository: SystemMetadataRepository,
    private userRepository: UserRepository,
  ) {
    this.logger.setContext(ImagePierAuditService.name);
    setAuditSink((entry) => handlePromiseError(this.record(entry), this.logger));
  }

  @OnEvent({ name: 'ConfigInit', workers: [ImmichWorker.Api] })
  async onConfigInit() {
    await this.ensureTable();
    this.cronRepository.create({
      name: CLEANUP_CRON_NAME,
      expression: CLEANUP_CRON_EXPRESSION,
      start: true,
      onTick: () => handlePromiseError(this.cleanup(), this.logger),
    });
  }

  @OnEvent({ name: 'AssetCreate' })
  onAssetCreate({ asset, file }: ArgOf<'AssetCreate'>) {
    if (file) {
      this.add({ action: 'upload', userId: asset.ownerId, assetIds: [asset.id] });
    }
  }

  @OnEvent({ name: 'AssetTrashAll' })
  onAssetTrashAll({ assetIds, userId }: ArgOf<'AssetTrashAll'>) {
    this.add({ action: 'trash', userId, assetIds });
  }

  @OnEvent({ name: 'AssetRestoreAll' })
  onAssetRestoreAll({ assetIds, userId }: ArgOf<'AssetRestoreAll'>) {
    this.add({ action: 'restore', userId, assetIds });
  }

  @OnEvent({ name: 'AssetDeleteAll' })
  onAssetDeleteAll({ assetIds, userId }: ArgOf<'AssetDeleteAll'>) {
    this.add({ action: 'delete', userId, assetIds });
  }

  @OnEvent({ name: 'UserCreate' })
  onUserCreate(user: ArgOf<'UserCreate'>) {
    this.add({ action: 'user_create', details: { account: user.name } });
  }

  @OnEvent({ name: 'UserTrash' })
  onUserTrash(user: ArgOf<'UserTrash'>) {
    this.add({ action: 'user_delete', details: { account: user.name } });
  }

  private add(entry: AuditEntry) {
    handlePromiseError(this.record(entry), this.logger);
  }

  private ensureTable() {
    this.tableReady ??= this.createTable().catch((error: unknown) => {
      this.tableReady = undefined;
      throw error;
    });
    return this.tableReady;
  }

  private async createTable() {
    await sql`
      CREATE TABLE IF NOT EXISTS imagepier_audit (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "userId" uuid,
        "userName" text,
        "action" text NOT NULL,
        "assetIds" uuid[] NOT NULL DEFAULT '{}',
        "assetCount" integer NOT NULL DEFAULT 0,
        "details" jsonb
      )
    `.execute(this.db);
    await sql`CREATE INDEX IF NOT EXISTS imagepier_audit_created_at_idx ON imagepier_audit ("createdAt")`.execute(
      this.db,
    );
    await sql`CREATE INDEX IF NOT EXISTS imagepier_audit_user_id_idx ON imagepier_audit ("userId")`.execute(this.db);
  }

  async getSettings() {
    if (this.settings && Date.now() - this.settings.loadedAt < SETTINGS_TTL_MS) {
      return this.settings.value;
    }

    const value = parseAuditSettings(await this.systemMetadataRepository.get(settingsKey));
    this.settings = { value, loadedAt: Date.now() };
    return value;
  }

  async updateSettings(dto: Partial<AuditSettings>) {
    const value = parseAuditSettings({ ...(await this.getSettings()), ...dto });
    await this.systemMetadataRepository.set(settingsKey, value as unknown as SystemMetadata[SystemMetadataKey]);
    this.settings = { value, loadedAt: Date.now() };
    return value;
  }

  async record(entry: AuditEntry) {
    try {
      const stored = applyAuditSettings(entry, await this.getSettings());
      if (!stored) {
        return;
      }

      let name = stored.userName ?? null;
      if (stored.userId && !name) {
        name = await this.getUserName(stored.userId);
      }

      // Changes of another account: store its name, the id alone is not readable in the log.
      const details = { ...stored.details };
      if (typeof details.userId === 'string' && !details.account) {
        details.account = await this.getUserName(details.userId);
      }

      await this.ensureTable();
      const assetIds = stored.assetIds ?? [];
      await sql`
        INSERT INTO imagepier_audit ("userId", "userName", "action", "assetIds", "assetCount", "details")
        VALUES (
          ${stored.userId ?? null},
          ${name},
          ${stored.action},
          ${`{${assetIds.join(',')}}`}::uuid[],
          ${entry.assetIds?.length ?? 0},
          ${stored.details ? JSON.stringify(details) : null}::text::jsonb
        )
      `.execute(this.db);
    } catch (error) {
      this.logger.warn(`Unable to write the audit log (${entry.action}): ${error}`);
    }
  }

  private async getUserName(userId: string) {
    const user = await this.userRepository.get(userId, { withDeleted: true });
    return user?.name ?? null;
  }

  async cleanup() {
    const { retentionDays } = await this.getSettings();
    await this.ensureTable();
    const result = await sql`
      DELETE FROM imagepier_audit WHERE "createdAt" < now() - make_interval(days => ${retentionDays}::int)
    `.execute(this.db);
    const count = Number(result.numAffectedRows ?? 0);
    if (count > 0) {
      this.logger.log(`Removed ${count} audit log entries older than ${retentionDays} days`);
    }
  }

  async list(filter: AuditFilter) {
    await this.ensureTable();
    const conditions = [sql`true`];
    if (filter.from) {
      conditions.push(sql`"createdAt" >= ${filter.from}`);
    }
    if (filter.to) {
      conditions.push(sql`"createdAt" <= ${filter.to}`);
    }
    if (filter.userId) {
      conditions.push(sql`"userId" = ${filter.userId}`);
    }
    if (filter.action) {
      conditions.push(sql`"action" = ${filter.action}`);
    }
    const where = sql.join(conditions, sql` AND `);

    const { rows } = await sql<AuditRow>`
      SELECT
        l."id",
        l."createdAt",
        l."userId",
        l."userName",
        l."action",
        l."assetIds",
        l."assetCount",
        CASE WHEN jsonb_typeof(l."details") = 'string' THEN (l."details" #>> '{}')::jsonb ELSE l."details" END
          AS "details",
        (SELECT a."originalFileName" FROM asset a WHERE a."id" = l."assetIds"[1]) AS "assetName"
      FROM imagepier_audit l
      WHERE ${where}
      ORDER BY "createdAt" DESC
      LIMIT ${filter.limit} OFFSET ${filter.offset}
    `.execute(this.db);
    const total = await sql<{ count: string }>`SELECT count(*) AS count FROM imagepier_audit WHERE ${where}`.execute(
      this.db,
    );

    return { items: rows, total: Number(total.rows[0]?.count ?? 0) };
  }

  /** People that appear in the audit log, for the filter of the admin view. */
  async getUsers() {
    await this.ensureTable();
    const { rows } = await sql<{ userId: string; userName: string | null }>`
      SELECT DISTINCT ON ("userId") "userId", "userName"
      FROM imagepier_audit
      WHERE "userId" IS NOT NULL
      ORDER BY "userId", "createdAt" DESC
      LIMIT 1000
    `.execute(this.db);
    return rows.toSorted((a, b) => (a.userName ?? '').localeCompare(b.userName ?? ''));
  }

  /** Media library assets in the trash, newest first, with the person who moved them there. */
  async getLibraryTrash(): Promise<LibraryTrashItem[]> {
    const settings = parseAccessSettings(
      await this.systemMetadataRepository.get(ACCESS_SETTINGS_KEY as SystemMetadataKey),
    );
    const accountIds = getAreaAccounts(settings).keys().toArray();
    if (!settings.libraryUserId || accountIds.length === 0) {
      return [];
    }

    await this.ensureTable();
    const { rows } = await sql<LibraryTrashItem>`
      SELECT
        a."id",
        a."originalFileName",
        a."type",
        a."deletedAt",
        (
          SELECT l."userName" FROM imagepier_audit l
          WHERE l."action" = 'trash' AND a."id" = ANY (l."assetIds")
          ORDER BY l."createdAt" DESC
          LIMIT 1
        ) AS "deletedBy"
      FROM asset a
      WHERE a."ownerId" = ${anyUuid(accountIds)} AND a."deletedAt" IS NOT NULL AND a."status" = ${AssetStatus.Trashed}
      ORDER BY a."deletedAt" DESC
      LIMIT 1000
    `.execute(this.db);
    return rows;
  }
}
