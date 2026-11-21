import { defaults } from '@immich/sdk';

/**
ImagePier roles and the shared media library.
Keep in sync with server/src/imagepier/access-rules.ts.
*/
export const ASSIGNABLE_ROLES = ['manager', 'staff', 'external'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];
export type Role = 'admin' | AssignableRole;

export type UserAccess = {
  role: Role;
  canUpload: boolean;
  canDownload: boolean;
  canViewLibrary: boolean;
  canEditLibrary: boolean;
  canDeletePermanently: boolean;
};

export type MyAccess = UserAccess & { libraryUserId: string | null };

export type StoredUserAccess = { role?: AssignableRole; canUpload?: boolean; canDownload?: boolean };

export type UserAccessAdmin = { stored: StoredUserAccess; effective: UserAccess; isLibrary: boolean };

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

export const getUserAccessAdmin = (userId: string) =>
  request<UserAccessAdmin>(`/admin/imagepier/access/users/${userId}`);

export const updateUserAccessAdmin = (userId: string, dto: StoredUserAccess) =>
  request<UserAccessAdmin>(`/admin/imagepier/access/users/${userId}`, { method: 'PUT', body: JSON.stringify(dto) });
