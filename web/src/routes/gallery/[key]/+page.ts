import { ipt } from '#lib/imagepier/i18n.ts';
import { get } from 'svelte/store';
import type { PageLoad } from './$types';

/** ImagePier: public website gallery, no login required. */
export const load = (({ params }) => ({
  key: params.key,
  meta: {
    title: get(ipt)('website_gallery'),
  },
})) satisfies PageLoad;
