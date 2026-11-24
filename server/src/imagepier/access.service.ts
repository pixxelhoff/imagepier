import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from 'src/decorators.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { ImmichWorker, JobName, SystemMetadataKey, UserStatus } from 'src/enum.js';
import { getAccessForAuth, setAssetOwnerResolver, setAssetUploaderResolver } from 'src/imagepier/access-hook.js';
import {
  ACCESS_SETTINGS_KEY,
  AccessSettings,
  Area,
  SHARED_AREA_ID,
  StoredUserAccess,
  UPLOADED_BY_KEY,
  getAreaAccounts,
  getAreaLevel,
  getSharedAreaName,
  getUserAccess,
  isAtLeast,
  parseAccessSettings,
  parseStoredUserAccess,
  parseUploadedBy,
  setCachedAccessSettings,
} from 'src/imagepier/access-rules.js';
import { BaseService } from 'src/services/base.service.js';
import type { SystemMetadata } from 'src/types.js';
import { handlePromiseError } from 'src/utils/misc.js';

/** Every 15 minutes: re-read the settings and repair the media library sharing. */
const SYNC_CRON_NAME = 'ImagePierAccessSync';
const SYNC_CRON_EXPRESSION = '*/15 * * * *';

const settingsKey = ACCESS_SETTINGS_KEY as SystemMetadataKey;

const isGerman = () => (process.env.IMAGEPIER_LANGUAGE ?? 'en').toLowerCase().startsWith('de');

const getLibraryAccount = () => ({
  email: process.env.IMAGEPIER_LIBRARY_EMAIL ?? 'media-library@imagepier.local',
  name: process.env.IMAGEPIER_LIBRARY_NAME ?? (isGerman() ? 'Mediathek' : 'Media library'),
});

/** E-mail of an area account, derived from the media library e-mail: `media-library+<area id>@imagepier.local`. */
export const getAreaAccountEmail = (libraryEmail: string, areaId: string) => {
  const at = libraryEmail.lastIndexOf('@');
  return at > 0 ? `${libraryEmail.slice(0, at)}+${areaId}${libraryEmail.slice(at)}` : `${libraryEmail}+${areaId}`;
};

/** Display name of an area account, e.g. "Media library: Press". */
export const getAreaAccountName = (libraryName: string, areaName: string) => `${libraryName}: ${areaName}`;

/** One-time upgrades of media library assets; registered by the usage rights service. */
export type AreaMigrations = {
  /** Moves assets of earlier versions from the shared account to the account of their area. */
  moveAssets: () => Promise<number>;
  /** Moves files of assets assigned to areas into the folders of the area accounts. */
  moveFiles: () => Promise<number>;
};

let areaMigrations: AreaMigrations | undefined;

export const setAreaMigrations = (migrations: AreaMigrations | undefined) => {
  areaMigrations = migrations;
};

/**
Roles and the media library areas.

- Creates a technical account per area on startup (once an admin exists). The account of the shared area is the
  original media library account.
- Shares each area account with the users who have a level in the area (Immich partner sharing, shown in the timeline).
- Stores the role settings per account and keeps the in-memory copy used by the access checks up to date.
*/
@Injectable()
export class ImagePierAccessService extends BaseService {
  private settings: AccessSettings = { areas: [], users: {} };

  @OnEvent({ name: 'ConfigInit', workers: [ImmichWorker.Api] })
  async onConfigInit() {
    setAssetOwnerResolver((assetIds) => this.getAssetOwners(assetIds));
    setAssetUploaderResolver((assetIds) => this.getAssetUploaders(assetIds));
    await this.loadSettings();
    this.cronRepository.create({
      name: SYNC_CRON_NAME,
      expression: SYNC_CRON_EXPRESSION,
      start: true,
      onTick: () => handlePromiseError(this.setupLibrary(), this.logger),
    });
    handlePromiseError(this.setupLibrary(), this.logger);
  }

  @OnEvent({ name: 'UserCreate', workers: [ImmichWorker.Api] })
  async onUserCreate() {
    try {
      await this.syncLibrarySharing();
    } catch (error) {
      this.logger.warn(`Unable to share the media library with a new user: ${error}`);
    }
  }

  async loadSettings() {
    const value = await this.systemMetadataRepository.get(settingsKey);
    this.applySettings(parseAccessSettings(value, getSharedAreaName()));
    return this.settings;
  }

  private applySettings(settings: AccessSettings) {
    this.settings = settings;
    setCachedAccessSettings(settings);
  }

  private async saveSettings(settings: AccessSettings) {
    await this.systemMetadataRepository.set(settingsKey, settings as unknown as SystemMetadata[SystemMetadataKey]);
    this.applySettings(settings);
  }

  async setupLibrary() {
    await this.loadSettings();
    if (!(await this.ensureLibraryAccount())) {
      return;
    }
    await this.ensureAreaAccounts();
    await this.migrateAreaAssets();
    await this.syncLibrarySharing();
    await this.syncFaceClusterGroup();
  }

  /**
  The media library and all area accounts share one face cluster group (an Immich feature), so a person is
  recognized across all areas. Accounts that join the group are recognized again once.
  */
  async syncFaceClusterGroup() {
    const { libraryUserId } = this.settings;
    if (!libraryUserId) {
      return;
    }

    const library = await this.userRepository.get(libraryUserId, {});
    if (!library) {
      return;
    }

    const clusterGroupId = library.clusterGroupId;
    let changed = false;
    for (const userId of getAreaAccounts(this.settings).keys()) {
      const user = await this.userRepository.get(userId, {});
      if (!user || user.clusterGroupId === clusterGroupId) {
        continue;
      }
      await this.personRepository.reassignCluster({ userId, newClusterId: clusterGroupId });
      await this.userRepository.update(userId, { clusterGroupId });
      changed = true;
    }

    if (!changed) {
      return;
    }

    this.logger.log('Area accounts joined the face cluster group of the media library');
    await this.jobRepository.queue({
      name: JobName.FacialRecognitionQueueAll,
      data: { clusterGroupId, force: true },
    });
  }

  /** Creates the media library account, or finds it again after it was deleted from the settings. */
  async ensureLibraryAccount() {
    const { libraryUserId } = this.settings;
    if (libraryUserId && (await this.userRepository.get(libraryUserId, {}))) {
      return libraryUserId;
    }

    const account = getLibraryAccount();
    let library = await this.userRepository.getByEmail(account.email);
    if (!library) {
      if (!(await this.userRepository.getAdmin())) {
        this.logger.debug('Media library account not created yet: no admin account exists');
        return;
      }

      library = await this.createUser({ email: account.email, name: account.name, isAdmin: false });
      this.logger.log(`Created media library account ${account.email}`);
    }

    await this.saveSettings(parseAccessSettings({ ...this.settings, libraryUserId: library.id }, getSharedAreaName()));
    return library.id;
  }

  /** Creates the account of every area that has none yet, and keeps the account names in line with the area names. */
  async ensureAreaAccounts() {
    const library = getLibraryAccount();
    const areas: Area[] = [];
    let changed = false;

    for (const area of this.settings.areas) {
      const name = getAreaAccountName(library.name, area.name);
      let user: { id: string; name: string } | undefined = area.userId
        ? await this.userRepository.get(area.userId, {})
        : undefined;
      if (!user && area.id !== SHARED_AREA_ID) {
        const email = getAreaAccountEmail(library.email, area.id);
        user = await this.userRepository.getByEmail(email);
        if (!user) {
          user = await this.createUser({ email, name, isAdmin: false });
          this.logger.log(`Created account ${email} for area ${area.name}`);
        }
        changed = true;
      }

      if (user && user.name !== name) {
        await this.userRepository.update(user.id, { name });
      }
      areas.push({ ...area, userId: user?.id ?? area.userId });
    }

    if (changed) {
      await this.saveSettings({ ...this.settings, areas });
    }
  }

  /** Runs once after upgrading: assets and their files move to the accounts of their areas. */
  private async migrateAreaAssets() {
    if (!areaMigrations) {
      return;
    }

    if (!this.settings.areaAssetsMigrated) {
      const count = await areaMigrations.moveAssets();
      this.logger.log(`Moved ${count} media library assets to the accounts of their areas`);
      await this.saveSettings({ ...this.settings, areaAssetsMigrated: true });
    }

    if (this.settings.areaFilesMoved) {
      return;
    }

    const count = await areaMigrations.moveFiles();
    this.logger.log(`Moved the files of ${count} media library assets to the folders of their areas`);
    await this.saveSettings({ ...this.settings, areaFilesMoved: true });
  }

  /** Shares every area account with the users who have a level in the area, and removes it from everybody else. */
  async syncLibrarySharing() {
    const accounts = getAreaAccounts(this.settings);
    if (!this.settings.libraryUserId || accounts.size === 0) {
      return;
    }

    const allUsers = await this.userRepository.getList();
    const users = allUsers
      .filter((user) => !accounts.has(user.id))
      .map((user) => ({ id: user.id, access: getUserAccess(this.settings, user) }));
    for (const [accountId, areaId] of accounts) {
      const partners = await this.partnerRepository.getAll(accountId);
      const sharedWith = new Map(
        partners
          .filter((partner) => partner.sharedById === accountId)
          .map((partner) => [partner.sharedWithId, partner]),
      );

      for (const user of users) {
        const canView = isAtLeast(getAreaLevel(user.access, areaId), 'viewer');
        const partner = sharedWith.get(user.id);
        const ids = { sharedById: accountId, sharedWithId: user.id };
        if (canView && !partner) {
          await this.partnerRepository.create({ ...ids, inTimeline: true });
        } else if (canView && partner && !partner.inTimeline) {
          // "All photos" always includes the areas; "My photos" hides them in the web app.
          await this.partnerRepository.update(ids, { inTimeline: true });
        } else if (!canView && partner) {
          await this.partnerRepository.remove(ids);
        }
      }
    }
  }

  /** Owner of each given asset, also for assets in the trash. */
  async getAssetOwners(assetIds: string[]) {
    const assets = await this.assetRepository.getByIds(assetIds);
    return new Map(assets.map((asset) => [asset.id, asset.ownerId]));
  }

  /** Who added each given asset to the media library (asset metadata `UPLOADED_BY_KEY`). */
  async getAssetUploaders(assetIds: string[]) {
    const uploaders = new Map<string, string>();
    for (const assetId of assetIds) {
      const item = await this.assetRepository.getMetadataByKey(assetId, UPLOADED_BY_KEY);
      const userId = parseUploadedBy(item?.value);
      if (userId) {
        uploaders.set(assetId, userId);
      }
    }
    return uploaders;
  }

  /** Number of assets of an account, including the trash. */
  private async countAssets(userId: string) {
    let total = 0;
    for (const isTrashed of [false, true]) {
      const stats = await this.assetRepository.getStatistics(userId, { isTrashed });
      for (const value of Object.values(stats)) {
        total += Number(value);
      }
    }
    return total;
  }

  /** Removes the account of a deleted area, like an administrator deleting a user. */
  private async removeAreaAccount(userId: string) {
    for (const partner of await this.partnerRepository.getAll(userId)) {
      if (partner.sharedById === userId) {
        await this.partnerRepository.remove({ sharedById: userId, sharedWithId: partner.sharedWithId });
      }
    }
    await this.userRepository.update(userId, { status: UserStatus.Deleted, deletedAt: new Date() });
  }

  getMyAccess(auth: AuthDto) {
    return {
      ...getAccessForAuth(auth),
      libraryUserId: this.settings.libraryUserId ?? null,
      allAreas: this.settings.areas,
    };
  }

  /** Areas with the number of media managers; every area should have at least one. */
  getAreas() {
    const levels = Object.values(this.settings.users).map((user) => user.areas ?? {});
    return this.settings.areas.map((area) => ({
      ...area,
      managers: levels.filter((areas) => areas[area.id] === 'manager').length,
    }));
  }

  /**
  Replaces the list of areas. Areas without id are created with their own account; the shared area always stays.
  Areas that still contain assets cannot be removed.
  */
  async updateAreas(areas: Array<{ id?: string; name: string }>) {
    await this.loadSettings();
    const result: Area[] = [];
    for (const area of areas) {
      const name = area.name.trim();
      const id = area.id ?? this.cryptoRepository.randomUUID();
      const existing = this.settings.areas.find((item) => item.id === id);
      if (name && result.every((item) => item.id !== id)) {
        result.push({ id, name, userId: existing?.userId });
      }
    }

    if (result.every((area) => area.id !== SHARED_AREA_ID)) {
      const shared = this.settings.areas.find((area) => area.id === SHARED_AREA_ID);
      result.unshift(shared ?? { id: SHARED_AREA_ID, name: getSharedAreaName() });
    }

    const removed = this.settings.areas.filter((area) => result.every((item) => item.id !== area.id));
    for (const area of removed) {
      if (area.userId && (await this.countAssets(area.userId)) > 0) {
        // `code` and `area` let the web app show a translated message.
        throw new BadRequestException({
          message: `The area "${area.name}" still contains assets`,
          code: 'area_not_empty',
          area: area.name,
        });
      }
    }

    await this.saveSettings({ ...this.settings, areas: result });
    for (const area of removed) {
      if (area.userId) {
        await this.removeAreaAccount(area.userId);
      }
    }

    if (this.settings.libraryUserId) {
      await this.ensureAreaAccounts();
      await this.syncLibrarySharing();
    }
    return this.getAreas();
  }

  /** Role of every account for the user list; area accounts are marked as `library`. */
  async getUserRolesAdmin() {
    const accounts = getAreaAccounts(this.settings);
    const users = await this.userRepository.getList({ withDeleted: true });
    return Object.fromEntries(
      users.map((user) => [user.id, accounts.has(user.id) ? 'library' : getUserAccess(this.settings, user).role]),
    );
  }

  async getUserAccessAdmin(userId: string) {
    const user = await this.userRepository.get(userId, { withDeleted: true });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return this.toAdminResponse(user);
  }

  async updateUserAccessAdmin(userId: string, dto: StoredUserAccess) {
    const user = await this.userRepository.get(userId, { withDeleted: true });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (getAreaAccounts(this.settings).has(user.id)) {
      throw new BadRequestException('Area accounts have no role');
    }

    await this.loadSettings();
    const users = {
      ...this.settings.users,
      [userId]: parseStoredUserAccess({ ...this.settings.users[userId], ...dto }),
    };
    await this.saveSettings({ ...this.settings, users });
    await this.syncLibrarySharing();

    return this.toAdminResponse(user);
  }

  private toAdminResponse(user: { id: string; isAdmin: boolean }) {
    return {
      stored: this.settings.users[user.id] ?? {},
      effective: getUserAccess(this.settings, user),
      isLibrary: getAreaAccounts(this.settings).has(user.id),
      allAreas: this.settings.areas,
    };
  }
}
