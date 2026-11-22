import { getLibraryTags, getMediaLibraryAccess, getVisibleAreas } from '#lib/imagepier/access.ts';
import { ipt } from '#lib/imagepier/i18n.ts';
import { getUsageRightsConfig } from '#lib/imagepier/usage-rights.ts';
import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

export type AreaView = { id: string; name: string; libraryUserId: string; tagId?: string };

const loadArea = async (areaId: string): Promise<AreaView | undefined> => {
  try {
    const access = await getMediaLibraryAccess(authManager.user.id);
    if (!access?.canViewLibrary || !access.libraryUserId) {
      return;
    }

    const area = getVisibleAreas(access).find((item) => item.id === areaId);
    if (!area) {
      return;
    }

    const [config, tags] = await Promise.all([getUsageRightsConfig(), getLibraryTags()]);
    const value = `${config.tags.area}/${area.name}`;
    const tagId = tags.find((tag) => tag.value === value)?.id;
    return { id: area.id, name: area.name, libraryUserId: access.libraryUserId, tagId };
  } catch {
    return;
  }
};

/**
ImagePier: media library assets of one area.
The area is loaded here, before the page is shown, so the timeline can restore its scroll position after navigation.
*/
export const load = (async ({ params, url }) => {
  await authenticate(url);
  const area = await loadArea(params.areaId);
  const $ipt = get(ipt);

  return {
    area,
    meta: {
      title: area ? $ipt('photos_area', { name: area.name }) : $ipt('media_library'),
    },
  };
}) satisfies PageLoad;
