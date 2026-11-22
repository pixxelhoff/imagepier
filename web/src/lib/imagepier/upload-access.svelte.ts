import { moveToMediaLibrary } from '#lib/imagepier/access.ts';
import { ipt } from '#lib/imagepier/i18n.ts';
import { handleError } from '#lib/utils/handle-error.ts';
import { get } from 'svelte/store';

/** Area that uploads are assigned to; set by the view of an area while the user may upload into it. */
export type UploadTarget = { areaId: string; onAssigned: (count: number) => void };

/**
Whether the signed-in user may upload, and where uploads go. Set by the media library entry of the sidebar and by
the view of an area. The server checks the permissions in any case.
*/
class UploadAccess {
  allowed = $state(true);
  target = $state<UploadTarget>();
}

export const uploadAccess = new UploadAccess();

/**
Assigns uploaded assets to the area of the current view (upload button, drag and drop). Without an area view the
assets stay in the user's own photos.
*/
export const assignUploadsToArea = async (assetIds: string[]) => {
  const target = uploadAccess.target;
  if (!target || assetIds.length === 0) {
    return;
  }

  try {
    const { count } = await moveToMediaLibrary(assetIds, target.areaId);
    target.onAssigned(count);
  } catch (error) {
    handleError(error, get(ipt)('upload_to_area_failed'));
  }
};
