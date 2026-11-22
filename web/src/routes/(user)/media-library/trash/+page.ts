import { ipt } from '#lib/imagepier/i18n.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: trash of the media library areas where the user is editor or media manager. */
export const load = (async ({ url }) => {
  await authenticate(url);

  return {
    meta: {
      title: get(ipt)('library_trash_nav'),
    },
  };
}) satisfies PageLoad;
