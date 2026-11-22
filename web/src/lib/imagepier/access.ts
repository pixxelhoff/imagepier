import { PartnerDirection, defaults, getPartners } from '@immich/sdk';

/**
ImagePier roles and the shared media library.
Keep in sync with server/src/imagepier/access-rules.ts.
*/
export const ASSIGNABLE_ROLES = ['manager', 'staff', 'external'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export type Role = 'admin' | AssignableRole;

export const SHARED_AREA_ID = 'shared';

export type Area = { id: string; name: string };

export type UserAccess = {
  role: Role;
  canUpload: boolean;
  canDownload: boolean;
  canViewLibrary: boolean;
  canEditLibrary: boolean;
  canDeletePermanently: boolean;
  /** Areas the user is responsible for (media managers) */
  areas: string[];
};

export type MyAccess = UserAccess & { libraryUserId: string | null; allAreas: Area[] };

export type StoredUserAccess = {
  role?: AssignableRole;
  canUpload?: boolean;
  canDownload?: boolean;
  areas?: string[];
};

export type UserAccessAdmin = { stored: StoredUserAccess; effective: UserAccess; isLibrary: boolean; allAreas: Area[] };

const request = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${defaults.baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...defaults.headers },
  });
  if (!response.ok) {
    throw new Error(`ImagePier request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
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

/** Areas a user may assign: media managers their own areas and the shared area, everybody else all areas. */
export const getAssignableAreas = (access: MyAccess) =>
  access.role === 'manager'
    ? access.allAreas.filter((area) => area.id === SHARED_AREA_ID || access.areas.includes(area.id))
    : access.allAreas;

/** Whether the user may edit media library assets of the given area; keep in sync with the server rules. */
export const canEditAreaOf = (access: UserAccess, areaId: string | undefined) =>
  access.role === 'admin' ||
  (access.canEditLibrary && (!areaId || areaId === SHARED_AREA_ID || access.areas.includes(areaId)));

/** Name of an area; assets without area belong to the shared area. */
export const getAreaName = (access: MyAccess, areaId: string | undefined) => {
  const area = access.allAreas.find((item) => item.id === (areaId ?? SHARED_AREA_ID));
  return (area ?? access.allAreas.find((item) => item.id === SHARED_AREA_ID))?.name;
};

export const moveToMediaLibrary = (assetIds: string[], areaId: string) =>
  request<{ count: number }>('/imagepier/usage-rights/library', {
    method: 'POST',
    body: JSON.stringify({ assetIds, areaId }),
  });

export type LibraryTag = { id: string; value: string };

/** Usage rights tags of the media library account; tags belong to the account that owns the assets. */
export const getLibraryTags = () => request<LibraryTag[]>('/imagepier/usage-rights/library-tags');

export const getAreasAdmin = () => request<Area[]>('/admin/imagepier/access/areas');

export const updateAreasAdmin = (areas: Array<{ id?: string; name: string }>) =>
  request<Area[]>('/admin/imagepier/access/areas', { method: 'PUT', body: JSON.stringify({ areas }) });

/** Role of every account; the media library account is marked as `library`. */
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

/** Media library assets in the trash; only for administrators. */
export const getLibraryTrash = () => request<LibraryTrashItem[]>('/admin/imagepier/library/trash');
