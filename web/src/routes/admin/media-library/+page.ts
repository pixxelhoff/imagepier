import { ipt } from '#lib/imagepier/i18n.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: administration of the media library areas. */
export const load = (async ({ url }) => {
  await authenticate(url, { admin: true });

  return {
    meta: {
      title: get(ipt)('areas'),
    },
  };
}) satisfies PageLoad;
