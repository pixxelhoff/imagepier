import { getKeywordValue, parseKeywordSettings } from 'src/imagepier/keywords.js';
import { getTagLabels, getTagPaths, type TagLabels } from 'src/imagepier/usage-rights-tags.js';

/**
Tags of an asset that ImagePier maintains and that are not stored in the file: keywords from the keyword list and
the usage rights tags. A new metadata extraction replaces the tags of an asset with the tags of the file, so these
tags are kept.
*/
export const getImagePierTagIds = (
  tags: Array<{ id: string; value: string }>,
  storedKeywords: unknown,
  labels: TagLabels = getTagLabels(),
) => {
  const keywords = new Set(parseKeywordSettings(storedKeywords).map((keyword) => getKeywordValue(keyword)));
  const usageRights = `${getTagPaths(labels).root}/`;
  return tags.filter((tag) => tag.value.startsWith(usageRights) || keywords.has(tag.value)).map((tag) => tag.id);
};
