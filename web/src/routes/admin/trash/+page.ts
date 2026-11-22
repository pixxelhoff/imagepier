import { ipt } from '#lib/imagepier/i18n.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: trash of all media library areas, filterable by area. Media managers use /media-library/trash. */
export const load = (async ({ url }) => {
  await authenticate(url, { admin: true });

  return {
    meta: {
      title: get(ipt)('admin_trash'),
    },
  };
}) satisfies PageLoad;
