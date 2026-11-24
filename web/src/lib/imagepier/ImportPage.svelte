<script lang="ts">
  import KeywordsModal from '#lib/imagepier/KeywordsModal.svelte';
  import UsageRightsModal from '#lib/imagepier/UsageRightsModal.svelte';
  import {
    ImagePierRequestError,
    canManageAreaOf,
    getAssignableAreas,
    getMediaLibraryAccess,
    type MyAccess,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    buildFileName,
    checkImport,
    getImportWarnings,
    hashFile,
    importAssets,
    readImageInfo,
    toImportCsv,
    toImportUsageRights,
    uploadImportFile,
    type FileNameParts,
    type ImageInfo,
    type ImportMatch,
    type ImportWarning,
  } from '#lib/imagepier/import.ts';
  import { getKeywords, type KeywordChange } from '#lib/imagepier/keywords.ts';
  import type { UsageRightsInput } from '#lib/imagepier/usage-rights.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { uploadManager } from '#lib/managers/upload-manager.svelte.ts';
  import { downloadBlob } from '#lib/utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import {
    Button,
    Checkbox,
    Field,
    HelperText,
    Input,
    Label,
    Select,
    Stack,
    Switch,
    Text,
    modalManager,
  } from '@immich/ui';
  import { mdiCopyright, mdiDownload, mdiFileMultiple, mdiFolderOpen, mdiTagMultipleOutline } from '@mdi/js';
  import { DateTime } from 'luxon';

  type Status = 'waiting' | 'uploading' | 'done' | 'error';

  type Item = {
    file: File;
    path: string;
    info: ImageInfo;
    checksum?: string;
    match?: ImportMatch;
    warnings: ImportWarning[];
    selected: boolean;
    status: Status;
    note?: string;
    newName?: string;
  };

  type Phase = 'select' | 'checking' | 'review' | 'running' | 'done';

  const CHECK_CHUNK_SIZE = 500;
  const IMPORT_CHUNK_SIZE = 20;
  const UPLOAD_CONCURRENCY = 2;

  let access = $state<MyAccess>();
  let phase = $state<Phase>('select');
  let items = $state<Item[]>([]);
  let unsupported = $state(0);
  let checked = $state(0);
  let checkTotal = $state(0);
  let checkFailed = $state(false);
  let processed = $state(0);

  let areaId = $state('');
  let keywords = $state<string[]>([]);
  let rightsInput = $state<UsageRightsInput>();
  let rename = $state(true);
  let nameParts = $state<FileNameParts>({ topic: '', subject: '', place: '', author: '' });

  const areas = $derived(access ? getAssignableAreas(access) : []);
  const areaOptions = $derived(areas.map((area) => ({ label: area.name, value: area.id })));
  const selectedItems = $derived(items.filter((item) => item.selected));
  const usageRights = $derived(rightsInput ? toImportUsageRights(rightsInput) : {});
  const rightsCount = $derived(Object.keys(usageRights).length);
  const rightsLabel = $derived(
    rightsCount > 0 ? $ipt('import_usage_rights_count', { count: rightsCount }) : $ipt('import_usage_rights_none'),
  );
  const keywordsLabel = $derived(keywords.length > 0 ? keywords.join(', ') : $ipt('import_keywords_none'));
  const doneCount = $derived(items.filter((item) => item.status === 'done').length);
  const failedCount = $derived(items.filter((item) => item.status === 'error').length);

  const loadAccess = async (userId: string) => {
    try {
      access = await getMediaLibraryAccess(userId);
      areaId = access ? (getAssignableAreas(access)[0]?.id ?? '') : '';
    } catch {
      access = undefined;
    }
  };

  $effect(() => {
    void loadAccess(authManager.user.id);
  });

  // A running import is lost when the tab is closed.
  $effect(() => {
    if (phase !== 'running') {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    globalThis.addEventListener('beforeunload', warn);
    return () => globalThis.removeEventListener('beforeunload', warn);
  });

  const getYear = (item: Item) => (item.info.takenAt ?? new Date(item.file.lastModified)).getFullYear();

  const getNewName = (item: Item, index: number) =>
    rename ? buildFileName(nameParts, getYear(item), index, item.file.name) : item.file.name;

  const example = $derived(selectedItems.length > 0 ? getNewName(selectedItems[0], 0) : '');

  const getAreaName = (id: string | null) =>
    id === null ? $ipt('import_own_photos') : (access?.allAreas.find((area) => area.id === id)?.name ?? id);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof ImagePierRequestError) {
      const body = (error.body ?? {}) as { message?: unknown };
      if (typeof body.message === 'string') {
        return body.message;
      }
    }
    return error instanceof Error ? error.message : String(error);
  };

  const pickFiles = (directory: boolean) =>
    new Promise<File[]>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.webkitdirectory = directory;
      input.hidden = true;
      input.addEventListener('change', () => {
        resolve(input.files ? [...input.files] : []);
        input.remove();
      });
      input.addEventListener('cancel', () => {
        resolve([]);
        input.remove();
      });
      document.body.append(input);
      input.click();
    });

  const checkFiles = async (files: File[]) => {
    const extensions = uploadManager.getExtensions();
    const supported = files.filter((file) =>
      extensions.some((extension) => file.name.toLowerCase().endsWith(extension)),
    );
    if (supported.length === 0) {
      return;
    }

    unsupported = files.length - supported.length;
    checked = 0;
    checkTotal = supported.length;
    checkFailed = false;
    phase = 'checking';

    const getPath = (file: File) => file.webkitRelativePath || file.name;
    const sorted = supported.toSorted((a, b) => getPath(a).localeCompare(getPath(b)));
    const list: Item[] = [];
    for (const file of sorted) {
      const info = await readImageInfo(file).catch((): ImageInfo => ({}));
      const checksum = await hashFile(file).catch(() => undefined);
      list.push({
        file,
        path: getPath(file),
        info,
        checksum,
        warnings: [],
        selected: false,
        status: 'waiting',
      });
      checked++;
    }

    const checksums = [
      ...new Set(list.map((item) => item.checksum).filter((checksum): checksum is string => !!checksum)),
    ];
    const matches = new Map<string, ImportMatch>();
    try {
      for (let index = 0; index < checksums.length; index += CHECK_CHUNK_SIZE) {
        const result = await checkImport(checksums.slice(index, index + CHECK_CHUNK_SIZE));
        for (const match of result) {
          matches.set(match.checksum, match);
        }
      }
    } catch {
      checkFailed = true;
    }

    const seen = new Set<string>();
    for (const item of list) {
      const duplicate = !!item.checksum && seen.has(item.checksum);
      if (item.checksum) {
        seen.add(item.checksum);
        item.match = matches.get(item.checksum);
      }
      item.warnings = getImportWarnings(item.info, duplicate, !!item.match);
      item.selected = item.warnings.length === 0;
    }

    items = list;
    phase = 'review';
  };

  const choose = async (directory: boolean) => {
    const files = await pickFiles(directory);
    await checkFiles(files);
  };

  const select = (mode: 'all' | 'none' | 'valid') => {
    for (const item of items) {
      item.selected = mode === 'all' || (mode === 'valid' && item.warnings.length === 0);
    }
  };

  const chooseKeywords = async () => {
    try {
      const all = await getKeywords();
      const change = (await modalManager.show(KeywordsModal, {
        keywords: all,
        selected: keywords,
        title: $ipt('import_keywords_choose'),
      })) as KeywordChange | undefined;
      if (change) {
        keywords = [...keywords.filter((value) => !change.remove.includes(value)), ...change.add];
      }
    } catch (error) {
      handleError(error, $ipt('keywords_save_failed'));
    }
  };

  const chooseUsageRights = async () => {
    const result = await modalManager.show(UsageRightsModal, {
      title: $ipt('import_usage_rights_set'),
      canRelease: !!access && canManageAreaOf(access, areaId),
    });
    if (!result) {
      return;
    }
    rightsInput = result;
    if (!nameParts.author && result.photographer) {
      nameParts.author = result.photographer;
    }
  };

  const runPool = async (list: Item[], task: (item: Item) => Promise<void>) => {
    let next = 0;
    const worker = async () => {
      while (next < list.length) {
        const item = list[next++];
        await task(item);
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, list.length) }, () => worker()));
  };

  const startImport = async () => {
    const list = selectedItems;
    if (list.length === 0 || !areaId) {
      return;
    }

    for (const [index, item] of list.entries()) {
      item.newName = getNewName(item, index);
      item.status = 'waiting';
      item.note = undefined;
    }
    processed = 0;
    phase = 'running';

    for (let index = 0; index < list.length; index += IMPORT_CHUNK_SIZE) {
      const chunk = list.slice(index, index + IMPORT_CHUNK_SIZE);
      const uploaded = new Map<Item, string>();

      await runPool(chunk, async (item) => {
        item.status = 'uploading';
        try {
          const response = await uploadImportFile(item.file, item.newName ?? item.file.name);
          uploaded.set(item, response.id);
        } catch (error) {
          item.status = 'error';
          item.note = getErrorMessage(error);
          processed++;
        }
      });

      const assetIds = [...uploaded.values()];
      if (assetIds.length > 0) {
        try {
          await importAssets({
            assetIds,
            areaId,
            keywords: keywords.length > 0 ? keywords : undefined,
            usageRights: rightsCount > 0 ? usageRights : undefined,
          });
          for (const item of uploaded.keys()) {
            item.status = 'done';
          }
        } catch (error) {
          const note = getErrorMessage(error);
          for (const item of uploaded.keys()) {
            item.status = 'error';
            item.note = note;
          }
        }
        processed += assetIds.length;
      }
    }

    phase = 'done';
  };

  const downloadLog = () => {
    const header = [
      $ipt('import_col_file'),
      $ipt('import_col_name'),
      $ipt('import_col_status'),
      $ipt('import_col_note'),
    ];
    const rows = items
      .filter((item) => item.selected)
      .map((item) => [item.path, item.newName ?? '', $ipt(`import_status.${item.status}`), item.note ?? '']);
    const csv = toImportCsv(header, rows);
    const date = DateTime.now().toISODate();
    downloadBlob(new Blob([`\u{FEFF}${csv}`], { type: 'text/csv;charset=utf-8' }), `imagepier-import-${date}.csv`);
  };

  const reset = () => {
    items = [];
    unsupported = 0;
    processed = 0;
    phase = 'select';
  };

  const formatSize = (info: ImageInfo) =>
    info.width && info.height ? `${info.width} × ${info.height}` : $ipt('import_size_unknown');

  const formatDate = (info: ImageInfo) =>
    info.takenAt ? DateTime.fromJSDate(info.takenAt).toFormat('dd.MM.yyyy') : '';

  const statusClass: Record<Status, string> = {
    waiting: 'text-gray-500',
    uploading: 'text-primary',
    done: 'text-green-700 dark:text-green-400',
    error: 'text-red-700 dark:text-red-400',
  };
</script>

<Stack gap={6}>
  <Text color="muted">{$ipt('import_description')}</Text>

  {#if access && areas.length === 0}
    <HelperText color="danger">{$ipt('import_no_area')}</HelperText>
  {:else if phase === 'select'}
    <div class="flex flex-wrap gap-2">
      <Button leadingIcon={mdiFolderOpen} onclick={() => choose(true)} disabled={!access}>
        {$ipt('import_choose_folder')}
      </Button>
      <Button variant="ghost" leadingIcon={mdiFileMultiple} onclick={() => choose(false)} disabled={!access}>
        {$ipt('import_choose_files')}
      </Button>
    </div>
  {:else if phase === 'checking'}
    <Text>{$ipt('import_checking', { done: checked, total: checkTotal })}</Text>
  {:else}
    <div class="flex flex-wrap items-center justify-between gap-2">
      <Text size="small">{$ipt('import_files', { count: items.length, selected: selectedItems.length })}</Text>
      {#if phase === 'review'}
        <div class="flex flex-wrap gap-2">
          <Button size="small" variant="ghost" onclick={() => select('valid')}>{$ipt('import_select_valid')}</Button>
          <Button size="small" variant="ghost" onclick={() => select('all')}>{$ipt('import_select_all')}</Button>
          <Button size="small" variant="ghost" onclick={() => select('none')}>{$ipt('import_select_none')}</Button>
        </div>
      {/if}
    </div>
    {#if unsupported > 0}
      <Text size="small" color="muted">{$ipt('import_unsupported', { count: unsupported })}</Text>
    {/if}
    {#if checkFailed}
      <HelperText color="danger">{$ipt('import_check_failed')}</HelperText>
    {/if}

    <div class="max-h-[28rem] overflow-y-auto rounded-xl border dark:border-gray-700">
      <table class="w-full text-start text-sm">
        <thead class="sticky top-0 bg-gray-100 dark:bg-gray-800">
          <tr>
            <th class="w-8 p-2"></th>
            <th class="p-2 text-start">{$ipt('import_col_file')}</th>
            <th class="p-2 text-start">{$ipt('import_col_note')}</th>
            <th class="p-2 text-start">{$ipt('import_col_status')}</th>
          </tr>
        </thead>
        <tbody>
          {#each items as item, index (item.path)}
            <tr class="border-t align-top dark:border-gray-700">
              <td class="p-2">
                <Checkbox
                  id="imagepier-import-{index}"
                  size="tiny"
                  checked={item.selected}
                  disabled={phase !== 'review'}
                  onCheckedChange={(value) => (item.selected = value)}
                />
              </td>
              <td class="p-2">
                <label for="imagepier-import-{index}" class="break-all">{item.path}</label>
                {#if item.newName && item.newName !== item.file.name}
                  <div class="text-xs text-gray-500">→ {item.newName}</div>
                {/if}
                <div class="text-xs text-gray-500">{formatSize(item.info)} {formatDate(item.info)}</div>
              </td>
              <td class="p-2 text-xs">
                {#each item.warnings as warning (warning)}
                  <div class="text-amber-700 dark:text-amber-400">
                    {warning === 'exists' && item.match
                      ? $ipt('import_exists_in', { area: getAreaName(item.match.areaId) })
                      : $ipt(`import_warning.${warning}`)}
                  </div>
                {/each}
                {#if item.note}
                  <div class="text-red-700 dark:text-red-400">{item.note}</div>
                {/if}
              </td>
              <td class="p-2 text-xs {statusClass[item.status]}">
                {item.selected && phase !== 'review' ? $ipt(`import_status.${item.status}`) : ''}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if phase === 'review'}
      <Stack gap={4}>
        <Label label={$ipt('import_details')} />
        <Field label={$ipt('area')}>
          <Select options={areaOptions} bind:value={areaId} />
        </Field>

        <div class="flex flex-wrap items-center gap-3">
          <Button size="small" variant="ghost" leadingIcon={mdiTagMultipleOutline} onclick={chooseKeywords}>
            {$ipt('import_keywords_choose')}
          </Button>
          <Text size="small" color="muted">{keywordsLabel}</Text>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <Button size="small" variant="ghost" leadingIcon={mdiCopyright} onclick={chooseUsageRights}>
            {$ipt('import_usage_rights_set')}
          </Button>
          <Text size="small" color="muted">{rightsLabel}</Text>
        </div>

        <Field label={$ipt('import_rename')}>
          <Switch bind:checked={rename} />
        </Field>
        {#if rename}
          <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label={$ipt('import_name_topic')}><Input bind:value={nameParts.topic} /></Field>
            <Field label={$ipt('import_name_subject')}><Input bind:value={nameParts.subject} /></Field>
            <Field label={$ipt('import_name_place')}><Input bind:value={nameParts.place} /></Field>
            <Field label={$ipt('import_name_author')}><Input bind:value={nameParts.author} /></Field>
          </div>
        {/if}
        {#if example}
          <Text size="small" color="muted">{$ipt('import_name_example', { name: example })}</Text>
        {/if}

        <div class="flex flex-wrap gap-2">
          <Button onclick={startImport} disabled={selectedItems.length === 0 || !areaId}>
            {$ipt('import_start', { count: selectedItems.length })}
          </Button>
          <Button variant="ghost" onclick={reset}>{$ipt('import_new')}</Button>
        </div>
      </Stack>
    {:else if phase === 'running'}
      <Text>{$ipt('import_running', { done: processed, total: selectedItems.length })}</Text>
      <Text size="small" color="muted">{$ipt('import_keep_open')}</Text>
    {:else}
      <Text>{$ipt('import_done', { count: doneCount, failed: failedCount })}</Text>
      <div class="flex flex-wrap gap-2">
        <Button variant="ghost" leadingIcon={mdiDownload} onclick={downloadLog}>{$ipt('import_log')}</Button>
        <Button onclick={reset}>{$ipt('import_new')}</Button>
      </div>
    {/if}
  {/if}
</Stack>
