import { ipt } from '#lib/imagepier/i18n.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: management of the public website galleries. */
export const load = (async ({ url }) => {
  await authenticate(url);

  return {
    meta: {
      title: get(ipt)('website_galleries'),
    },
  };
}) satisfies PageLoad;
