import { ipt } from '#lib/imagepier/i18n.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: media library assets of one area. */
export const load = (async ({ params, url }) => {
  await authenticate(url);

  return {
    areaId: params.areaId,
    meta: {
      title: get(ipt)('media_library'),
    },
  };
}) satisfies PageLoad;
