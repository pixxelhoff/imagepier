import { request } from '#lib/imagepier/access.ts';

/**
ImagePier keyword list (controlled vocabulary). Keep in sync with server/src/imagepier/keywords.ts.
A keyword is stored as the tag `Category/Keyword` of the account that owns the asset.
*/
export type Keyword = { category: string; name: string; description?: string; active: boolean };

export type KeywordGroup = { category: string; keywords: Keyword[] };

/** Result of the keyword dialog: keywords (`Category/Keyword`) to add and to remove. */
export type KeywordChange = { add: string[]; remove: string[] };

/** Result of the dialog to add or edit one keyword. */
export type KeywordEditResult = { action: 'save'; keyword: Keyword } | { action: 'delete' };

export const getKeywordValue = ({ category, name }: Pick<Keyword, 'category' | 'name'>) => `${category}/${name}`;

/** Splits a stored value `Category/Keyword` for display. */
export const splitKeywordValue = (value: string) => {
  const index = value.indexOf('/');
  return index === -1
    ? { category: '', name: value }
    : { category: value.slice(0, index), name: value.slice(index + 1) };
};

/** Keywords grouped by category, in the order of the list. */
export const groupKeywords = (keywords: Keyword[]): KeywordGroup[] => {
  const groups = new Map<string, Keyword[]>();
  for (const keyword of keywords) {
    groups.set(keyword.category, [...(groups.get(keyword.category) ?? []), keyword]);
  }
  return Array.from(groups, ([category, items]) => ({ category, keywords: items }));
};

const HEADER = /^(kategorie|category)$/i;

/** Rows pasted from a spreadsheet: category, keyword and description, separated by tabs. A header row is skipped. */
export const parseKeywordTable = (text: string): Keyword[] => {
  const keywords: Keyword[] = [];
  for (const line of text.split(/\r?\n/)) {
    const [category = '', name = '', description = ''] = line.split('\t').map((cell) => cell.trim());
    if (!category || !name || HEADER.test(category)) {
      continue;
    }
    keywords.push({ category, name, description: description || undefined, active: true });
  }
  return keywords;
};

/** Imported keywords are active; keywords missing in the import are kept, but deactivated. */
export const mergeKeywordImport = (current: Keyword[], imported: Keyword[]): Keyword[] => {
  const importedValues = new Set(imported.map((keyword) => getKeywordValue(keyword).toLowerCase()));
  const removed = current
    .filter((keyword) => !importedValues.has(getKeywordValue(keyword).toLowerCase()))
    .map((keyword) => ({ ...keyword, active: false }));
  return [...imported, ...removed];
};

export const getKeywords = async () => {
  const { keywords } = await request<{ keywords: Keyword[] }>('/imagepier/keywords');
  return keywords;
};

export const updateKeywordsAdmin = async (keywords: Keyword[]) => {
  const result = await request<{ keywords: Keyword[] }>('/admin/imagepier/keywords', {
    method: 'PUT',
    body: JSON.stringify({ keywords }),
  });
  return result.keywords;
};

const adminKeywordRequest = async (action: 'add' | 'edit' | 'delete', body: object) => {
  const result = await request<{ keywords: Keyword[] }>(`/admin/imagepier/keywords/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return result.keywords;
};

export const addKeywordAdmin = (keyword: Omit<Keyword, 'active'>) => adminKeywordRequest('add', keyword);

/** Changes a keyword; a new category or name renames the keyword on all assets. */
export const editKeywordAdmin = (value: string, keyword: Keyword) => adminKeywordRequest('edit', { value, ...keyword });

/** Deletes a keyword that is not assigned to any asset. */
export const deleteKeywordAdmin = (value: string) => adminKeywordRequest('delete', { value });

export const getAssetKeywords = async (assetId: string) => {
  const { values } = await request<{ values: string[] }>(`/imagepier/keywords/assets/${assetId}`);
  return values;
};

/** Keyword tags of the own account and of the accessible areas (one keyword can have one tag per account). */
export const getKeywordTags = async () => {
  const { tags } = await request<{ tags: Array<{ id: string; value: string }> }>('/imagepier/keywords/tags');
  return tags;
};

export const updateAssetKeywords = (assetIds: string[], add: string[], remove: string[]) =>
  request<{ count: number }>('/imagepier/keywords/assets', {
    method: 'PUT',
    body: JSON.stringify({ assetIds, add, remove }),
  });
