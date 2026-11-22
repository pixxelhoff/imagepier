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

export const getUserAccessAdmin = (userId: string) =>
  request<UserAccessAdmin>(`/admin/imagepier/access/users/${userId}`);

export const updateUserAccessAdmin = (userId: string, dto: StoredUserAccess) =>
  request<UserAccessAdmin>(`/admin/imagepier/access/users/${userId}`, { method: 'PUT', body: JSON.stringify(dto) });
