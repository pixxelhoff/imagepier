import { ipt } from '#lib/imagepier/i18n.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: import of many images into an area (editors and media managers). */
export const load = (async ({ url }) => {
  await authenticate(url);

  return {
    meta: {
      title: get(ipt)('import_title'),
    },
  };
}) satisfies PageLoad;
