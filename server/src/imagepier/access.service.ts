import { BadRequestException, Injectable } from '@nestjs/common';
import { OnEvent } from 'src/decorators.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { ImmichWorker, SystemMetadataKey } from 'src/enum.js';
import { getAccessForAuth } from 'src/imagepier/access-hook.js';
import {
  ACCESS_SETTINGS_KEY,
  AccessSettings,
  StoredUserAccess,
  getUserAccess,
  parseAccessSettings,
  setCachedAccessSettings,
} from 'src/imagepier/access-rules.js';
import { BaseService } from 'src/services/base.service.js';
import type { SystemMetadata } from 'src/types.js';
import { handlePromiseError } from 'src/utils/misc.js';

/** Every 15 minutes: re-read the settings and repair the media library sharing. */
const SYNC_CRON_NAME = 'ImagePierAccessSync';
const SYNC_CRON_EXPRESSION = '*/15 * * * *';

const settingsKey = ACCESS_SETTINGS_KEY as SystemMetadataKey;

const getLibraryAccount = () => {
  const language = (process.env.IMAGEPIER_LANGUAGE ?? 'en').toLowerCase();
  return {
    email: process.env.IMAGEPIER_LIBRARY_EMAIL ?? 'media-library@imagepier.local',
    name: process.env.IMAGEPIER_LIBRARY_NAME ?? (language.startsWith('de') ? 'Mediathek' : 'Media library'),
  };
};

/**
Roles and the shared media library.

- Creates the technical media library account on startup (once an admin exists).
- Shares the media library with all non-external users (Immich partner sharing, shown in the timeline).
- Stores the role settings per account and keeps the in-memory copy used by the access checks up to date.
*/
@Injectable()
export class ImagePierAccessService extends BaseService {
  private settings: AccessSettings = { users: {} };

  @OnEvent({ name: 'ConfigInit', workers: [ImmichWorker.Api] })
  async onConfigInit() {
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
    this.applySettings(parseAccessSettings(value));
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
    await this.ensureLibraryAccount();
    await this.syncLibrarySharing();
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

    await this.saveSettings({ ...this.settings, libraryUserId: library.id });
    return library.id;
  }

  /** Shares the media library with every user who may see it, and removes it from everybody else. */
  async syncLibrarySharing() {
    const { libraryUserId } = this.settings;
    if (!libraryUserId) {
      return;
    }

    const partners = await this.partnerRepository.getAll(libraryUserId);
    const sharedWith = new Set(
      partners.filter((partner) => partner.sharedById === libraryUserId).map((partner) => partner.sharedWithId),
    );

    for (const user of await this.userRepository.getList()) {
      if (user.id === libraryUserId) {
        continue;
      }

      const { canViewLibrary } = getUserAccess(this.settings, user);
      if (canViewLibrary && !sharedWith.has(user.id)) {
        await this.partnerRepository.create({ sharedById: libraryUserId, sharedWithId: user.id, inTimeline: true });
      } else if (!canViewLibrary && sharedWith.has(user.id)) {
        await this.partnerRepository.remove({ sharedById: libraryUserId, sharedWithId: user.id });
      }
    }
  }

  getMyAccess(auth: AuthDto) {
    return { ...getAccessForAuth(auth), libraryUserId: this.settings.libraryUserId ?? null };
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

    if (user.id === this.settings.libraryUserId) {
      throw new BadRequestException('The media library account has no role');
    }

    await this.loadSettings();
    const users = { ...this.settings.users, [userId]: { ...this.settings.users[userId], ...dto } };
    await this.saveSettings({ ...this.settings, users });
    await this.syncLibrarySharing();

    return this.toAdminResponse(user);
  }

  private toAdminResponse(user: { id: string; isAdmin: boolean }) {
    return {
      stored: this.settings.users[user.id] ?? {},
      effective: getUserAccess(this.settings, user),
      isLibrary: user.id === this.settings.libraryUserId,
    };
  }
}
