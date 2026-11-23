/**
ImagePier keyword list: a controlled vocabulary of keywords grouped in categories (for example "Place" / "Harbour").

Immich tags belong to one account. A keyword therefore becomes the tag `Category/Keyword` of the account that owns
the asset (own photos or the account of an area), so everybody with access to the asset finds it under the same
keyword. The list is stored in `system_metadata` and maintained by administrators.
*/

export const KEYWORDS_KEY = 'imagepier.keywords';

export const MAX_KEYWORDS = 2000;

export type Keyword = { category: string; name: string; description?: string; active: boolean };

/** Slashes would create additional tag levels; whitespace is normalized. */
const cleanName = (value: unknown) =>
  typeof value === 'string' ? value.replaceAll('/', '-').replaceAll(/\s+/g, ' ').trim() : '';

export const getKeywordValue = ({ category, name }: Pick<Keyword, 'category' | 'name'>) => `${category}/${name}`;

const toKeyword = (item: unknown): Keyword | undefined => {
  if (!item || typeof item !== 'object') {
    return;
  }

  const { category, name, description, active } = item as Record<string, unknown>;
  const keyword: Keyword = {
    category: cleanName(category),
    name: cleanName(name),
    description: typeof description === 'string' && description.trim() ? description.trim() : undefined,
    active: active !== false,
  };
  return keyword.category && keyword.name ? keyword : undefined;
};

/** Valid, unique keywords (case-insensitive), at most MAX_KEYWORDS. */
export const normalizeKeywords = (items: unknown[]): Keyword[] => {
  const byValue = new Map<string, Keyword>();
  for (const item of items) {
    const keyword = toKeyword(item);
    const key = keyword ? getKeywordValue(keyword).toLowerCase() : undefined;
    if (keyword && key && !byValue.has(key)) {
      byValue.set(key, keyword);
    }
  }
  return byValue.values().take(MAX_KEYWORDS).toArray();
};

export const parseKeywordSettings = (value: unknown): Keyword[] => {
  const items = value && typeof value === 'object' ? (value as { keywords?: unknown }).keywords : undefined;
  return Array.isArray(items) ? normalizeKeywords(items) : [];
};

/** Once a keyword list exists, only administrators create tags; everybody else uses the keyword list. */
export const canCreateTags = (isAdmin: boolean, storedKeywords: unknown) =>
  isAdmin || parseKeywordSettings(storedKeywords).length === 0;
