import { PartnerDirection, defaults, getPartners } from '@immich/sdk';

/**
ImagePier roles, areas and access levels.
Keep in sync with server/src/imagepier/access-rules.ts.
*/
export const ASSIGNABLE_ROLES = ['staff', 'external'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export type Role = 'admin' | AssignableRole;

/** Access levels per area, from lowest to highest. */
export const AREA_LEVELS = ['viewer', 'standard', 'editor', 'manager'] as const;
export type AreaLevel = (typeof AREA_LEVELS)[number];

/** Area that existed before areas were introduced; assets without an area belong to it. */
export const SHARED_AREA_ID = 'shared';

export type Area = {
  id: string;
  name: string;
  /** Technical account that owns the assets of the area */
  userId?: string;
};

/** Area in the administration, with the number of media managers. */
export type AreaAdmin = Area & { managers?: number };

export type UserAccess = {
  role: Role;
  /** Level per area id; areas without access are missing. */
  areas: Record<string, AreaLevel>;
  canViewLibrary: boolean;
  canEditLibrary: boolean;
};

export type MyAccess = UserAccess & { libraryUserId: string | null; allAreas: Area[] };

export type StoredUserAccess = {
  role?: AssignableRole;
  areas?: Record<string, AreaLevel>;
};

export type UserAccessAdmin = { stored: StoredUserAccess; effective: UserAccess; isLibrary: boolean; allAreas: Area[] };

/** Failed ImagePier request; `body` is the error response of the server, if any. */
export class ImagePierRequestError extends Error {
  readonly body: unknown;

  constructor(message: string, body: unknown) {
    super(message);
    this.name = 'ImagePierRequestError';
    this.body = body;
  }
}

const request = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${defaults.baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...defaults.headers },
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => undefined);
    throw new ImagePierRequestError(`ImagePier request failed: ${response.status} ${response.statusText}`, body);
  }
  return (await response.json()) as T;
};

/** Name of the area that could not be removed because it still contains assets. */
export const getAreaNotEmptyName = (error: unknown) => {
  if (!(error instanceof ImagePierRequestError)) {
    return;
  }
  const body = (error.body ?? {}) as { code?: unknown; area?: unknown };
  return body.code === 'area_not_empty' && typeof body.area === 'string' ? body.area : undefined;
};

let myAccess: { userId: string; promise: Promise<MyAccess> } | undefined;

/** Access of the signed-in user; cached per user. */
export const getMyAccess = (userId: string) => {
  if (myAccess?.userId !== userId) {
    const promise = request<MyAccess>('/imagepier/access/me').catch((error: unknown) => {
      myAccess = undefined;
      throw error;
    });
    myAccess = { userId, promise };
  }
  return myAccess.promise;
};

/**
Access of the signed-in user, or undefined if the media library is not shared with the user.
The media library is shared as partner; without partners no ImagePier request is needed.
*/
export const getMediaLibraryAccess = async (userId: string) => {
  const partners = await getPartners({ direction: PartnerDirection.SharedWith });
  return partners.length > 0 ? await getMyAccess(userId) : undefined;
};

/** Whether a level includes the rights of another level. */
export const isAtLeast = (level: AreaLevel | undefined, minimum: AreaLevel) =>
  !!level && AREA_LEVELS.indexOf(level) >= AREA_LEVELS.indexOf(minimum);

/** Areas the user can see. */
export const getVisibleAreas = (access: MyAccess) =>
  access.allAreas.filter((area) => isAtLeast(access.areas[area.id], 'viewer'));

/** Areas the user can upload into and assign to assets (level editor or higher). */
export const getAssignableAreas = (access: MyAccess) =>
  access.allAreas.filter((area) => isAtLeast(access.areas[area.id], 'editor'));

/** Whether the user may edit media library assets of the given area; keep in sync with the server rules. */
export const canEditAreaOf = (access: UserAccess, areaId: string | undefined) =>
  isAtLeast(access.areas[areaId ?? SHARED_AREA_ID], 'editor');

/** Whether the user may confirm usage rights and permanently delete assets of the given area. */
export const canManageAreaOf = (access: UserAccess, areaId: string | undefined) =>
  access.role === 'admin' || isAtLeast(access.areas[areaId ?? SHARED_AREA_ID], 'manager');

/**
Whether the user may edit and trash a media library asset: editors of its area; externals only assets they added.
Keep in sync with the server rules.
*/
export const canEditLibraryAssetOf = (
  access: UserAccess,
  userId: string,
  areaId: string,
  uploadedBy: string | undefined,
) => canEditAreaOf(access, areaId) && (access.role !== 'external' || uploadedBy === userId);

/** Whether the user may publish website galleries (editors and media managers, not externals). */
export const canPublishGalleries = (access: UserAccess) =>
  access.role === 'admin' || (access.role === 'staff' && access.canEditLibrary);

/** Area whose account owns assets of the given owner; undefined for regular users. */
export const getAreaOfOwner = (access: MyAccess, ownerId: string) =>
  access.allAreas.find((area) => !!area.userId && area.userId === ownerId);

/** Whether the media library is set up and the user is a regular user (not an area account). */
export const isLibraryUser = (access: MyAccess, userId: string) =>
  !!access.libraryUserId && !getAreaOfOwner(access, userId);

export const moveToMediaLibrary = (assetIds: string[], areaId: string) =>
  request<{ count: number }>('/imagepier/usage-rights/library', {
    method: 'POST',
    body: JSON.stringify({ assetIds, areaId }),
  });

export type LibraryTag = { id: string; value: string };

/** Usage rights tag of an area account. */
export type AreaTag = LibraryTag & { areaId: string };

/** Usage rights tags of the areas the user can see; tags belong to the account that owns the assets. */
export const getLibraryTags = () => request<AreaTag[]>('/imagepier/usage-rights/library-tags');

export const getAreasAdmin = () => request<AreaAdmin[]>('/admin/imagepier/access/areas');

export const updateAreasAdmin = (areas: Array<{ id?: string; name: string }>) =>
  request<AreaAdmin[]>('/admin/imagepier/access/areas', { method: 'PUT', body: JSON.stringify({ areas }) });

/** Role of every account; area accounts are marked as `library`. */
export type UserListRole = Role | 'library';

export const getUserRolesAdmin = () => request<Record<string, UserListRole>>('/admin/imagepier/access/users');

export const getUserAccessAdmin = (userId: string) =>
  request<UserAccessAdmin>(`/admin/imagepier/access/users/${userId}`);

export const updateUserAccessAdmin = (userId: string, dto: StoredUserAccess) =>
  request<UserAccessAdmin>(`/admin/imagepier/access/users/${userId}`, { method: 'PUT', body: JSON.stringify(dto) });

export const AUDIT_ACTIONS = [
  'upload',
  'download',
  'usage_rights',
  'usage_rights_confirm',
  'library_move',
  'trash',
  'restore',
  'delete',
  'access',
  'areas',
  'user_create',
  'user_delete',
  'login',
  'gallery',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditSettings = { retentionDays: number; downloadsWithUser: boolean; logins: boolean };

export type AuditItem = {
  id: string;
  assetName: string | null;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  action: AuditAction;
  assetIds: string[];
  assetCount: number;
  details: Record<string, unknown> | null;
};

export type AuditFilter = {
  from?: string;
  to?: string;
  userId?: string;
  action?: AuditAction;
  limit: number;
  offset: number;
};

export type LibraryTrashItem = {
  id: string;
  ownerId: string;
  areaId?: string;
  originalFileName: string;
  type: string;
  deletedAt: string;
  deletedBy: string | null;
};

const toQuery = (filter: AuditFilter) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  return params.toString();
};

export const getAuditLog = (filter: AuditFilter) =>
  request<{ items: AuditItem[]; total: number }>(`/admin/imagepier/audit?${toQuery(filter)}`);

export const getAuditUsers = () =>
  request<Array<{ userId: string; userName: string | null }>>('/admin/imagepier/audit/users');

export const getAuditSettings = () => request<AuditSettings>('/admin/imagepier/audit/settings');

export const updateAuditSettings = (dto: Partial<AuditSettings>) =>
  request<AuditSettings>('/admin/imagepier/audit/settings', { method: 'PUT', body: JSON.stringify(dto) });

/** Media library assets in the trash of the areas where the user is editor or media manager. */
export const getLibraryTrash = () => request<LibraryTrashItem[]>('/imagepier/library/trash');
