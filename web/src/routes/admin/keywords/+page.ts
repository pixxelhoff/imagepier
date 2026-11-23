import { ipt } from '#lib/imagepier/i18n.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: keyword list (controlled vocabulary). */
export const load = (async ({ url }) => {
  await authenticate(url, { admin: true });

  return {
    meta: {
      title: get(ipt)('keywords'),
    },
  };
}) satisfies PageLoad;
