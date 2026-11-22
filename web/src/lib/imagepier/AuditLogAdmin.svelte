<script lang="ts">
  import {
    ASSIGNABLE_ROLES,
    AUDIT_ACTIONS,
    getAuditLog,
    getAuditSettings,
    getAuditUsers,
    updateAuditSettings,
    type AuditAction,
    type AuditFilter,
    type AuditItem,
    type AuditSettings,
  } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { Route } from '#lib/route.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { downloadBlob } from '#lib/utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import {
    Button,
    DatePicker,
    Field,
    HelperText,
    Select,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
    Text,
    toastManager,
  } from '@immich/ui';
  import { mdiDownload } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount } from 'svelte';

  const PAGE_SIZE = 100;
  const EXPORT_LIMIT = 10_000;
  const RETENTION_OPTIONS = [30, 90, 180, 365, 730, 1095, 1825, 3650];

  let settings = $state<AuditSettings>();
  let users = $state<Array<{ userId: string; userName: string | null }>>([]);
  let items = $state<AuditItem[]>([]);
  let total = $state(0);
  let failed = $state(false);
  let loading = $state(false);

  let action = $state('');
  let userId = $state('');
  let from = $state<DateTime>();
  let to = $state<DateTime>();

  const getFilter = (offset: number, limit: number): AuditFilter => ({
    action: (AUDIT_ACTIONS as readonly string[]).includes(action) ? (action as AuditAction) : undefined,
    userId: userId || undefined,
    from: from?.startOf('day').toISO() ?? undefined,
    to: to?.endOf('day').toISO() ?? undefined,
    limit,
    offset,
  });

  const load = async (append = false) => {
    loading = true;
    try {
      const result = await getAuditLog(getFilter(append ? items.length : 0, PAGE_SIZE));
      items = append ? [...items, ...result.items] : result.items;
      total = result.total;
      failed = false;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  };

  onMount(() => {
    void load();
    void getAuditSettings()
      .then((value) => (settings = value))
      .catch(() => (failed = true));
    void getAuditUsers()
      .then((value) => (users = value))
      .catch(() => (users = []));
  });

  const saveSettings = async (patch: Partial<AuditSettings>) => {
    try {
      settings = await updateAuditSettings(patch);
      toastManager.primary($ipt('audit_settings_saved'));
    } catch (error) {
      handleError(error, $ipt('audit_settings_failed'));
    }
  };

  const getRetention = () => String(settings?.retentionDays ?? 365);
  const setRetention = (value: string) => void saveSettings({ retentionDays: Number(value) });
  const getDownloadsWithUser = () => settings?.downloadsWithUser ?? false;
  const setDownloadsWithUser = (value: boolean) => void saveSettings({ downloadsWithUser: value });
  const getLogins = () => settings?.logins ?? false;
  const setLogins = (value: boolean) => void saveSettings({ logins: value });

  const getAction = () => action;
  const setAction = (value: string) => {
    action = value;
    void load();
  };
  const getUser = () => userId;
  const setUser = (value: string) => {
    userId = value;
    void load();
  };
  const setFrom = (date?: DateTime | null) => {
    from = date ?? undefined;
    void load();
  };
  const setTo = (date?: DateTime | null) => {
    to = date ?? undefined;
    void load();
  };

  const retentionOptions = $derived(
    RETENTION_OPTIONS.map((days) => ({ label: $ipt('audit_retention_days', { count: days }), value: String(days) })),
  );
  const actionOptions = $derived([
    { label: $ipt('any'), value: '' },
    ...AUDIT_ACTIONS.map((item) => ({ label: $ipt(`audit.${item}`), value: item })),
  ]);
  const userOptions = $derived([
    { label: $ipt('any'), value: '' },
    ...users.map((user) => ({ label: user.userName ?? user.userId, value: user.userId })),
  ]);

  const formatTime = (value: string) =>
    DateTime.fromISO(value).toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS, { locale: $locale });

  const formatPerson = (item: AuditItem) =>
    item.userName ?? (item.action === 'download' && !item.userId ? $ipt('audit_anonymous') : '–');

  const toText = (value: unknown) => (Array.isArray(value) ? value.join(', ') : String(value));
  const yesNo = (value: unknown) => $ipt(value ? 'audit_yes' : 'audit_no');
  const formatRole = (value: unknown) => {
    const role = ASSIGNABLE_ROLES.find((item) => item === value);
    return role ? $ipt(`role.${role}`) : toText(value);
  };

  /** Readable details; technical ids are left out. */
  const formatDetail = (key: string, value: unknown) => {
    switch (key) {
      case 'kind': {
        return value === 'archive' ? $ipt('audit_kind_archive') : $ipt('audit_kind_original');
      }
      case 'sharedLink': {
        return value ? $ipt('audit_shared_link') : undefined;
      }
      case 'deviceType':
      case 'deviceOS': {
        return toText(value);
      }
      case 'account': {
        return `${$ipt('audit_account')}: ${toText(value)}`;
      }
      case 'role': {
        return `${$ipt('role')}: ${formatRole(value)}`;
      }
      case 'canUpload': {
        return `${$ipt('can_upload')}: ${yesNo(value)}`;
      }
      case 'canDownload': {
        return `${$ipt('can_download')}: ${yesNo(value)}`;
      }
      case 'area': {
        return `${$ipt('area')}: ${toText(value)}`;
      }
      case 'areas': {
        return `${$ipt('areas')}: ${toText(value)}`;
      }
      case 'areaNames': {
        return `${$ipt('responsible_areas')}: ${toText(value)}`;
      }
      default: {
        return;
      }
    }
  };

  const formatDetails = (item: AuditItem) =>
    Object.entries(item.details ?? {})
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => formatDetail(key, value))
      .filter((text) => !!text)
      .join(' · ');

  const formatAsset = (item: AuditItem) => {
    if (!item.assetName) {
      return '';
    }
    const more = item.assetCount - 1;
    return more > 0 ? `${item.assetName} ${$ipt('audit_more', { count: more })}` : item.assetName;
  };

  const csvValue = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

  const exportCsv = async () => {
    try {
      const result = await getAuditLog(getFilter(0, EXPORT_LIMIT));
      const header = [
        $ipt('audit_time'),
        $ipt('audit_person'),
        $ipt('audit_action'),
        $ipt('audit_asset'),
        $ipt('audit_count'),
        $ipt('audit_details'),
        'Asset IDs',
      ];
      const rows = result.items.map((item) => [
        formatTime(item.createdAt),
        formatPerson(item),
        $ipt(`audit.${item.action}`),
        formatAsset(item),
        item.assetCount,
        formatDetails(item),
        item.assetIds.join(' '),
      ]);
      const csv = [header, ...rows].map((row) => row.map((value) => csvValue(value)).join(';')).join('\r\n');
      const date = DateTime.now().toISODate();
      downloadBlob(new Blob([`\u{FEFF}${csv}`], { type: 'text/csv;charset=utf-8' }), `imagepier-audit-${date}.csv`);
    } catch (error) {
      handleError(error, $ipt('audit_load_failed'));
    }
  };
</script>

<Stack gap={4}>
  <Text color="muted">{$ipt('audit_description')}</Text>

  {#if settings}
    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Field label={$ipt('audit_retention')}>
        <Select options={retentionOptions} bind:value={getRetention, setRetention} />
      </Field>
      <div>
        <Field label={$ipt('audit_downloads_with_user')}>
          <Switch bind:checked={getDownloadsWithUser, setDownloadsWithUser} />
        </Field>
        <Text size="small" color="muted">{$ipt('audit_downloads_with_user_hint')}</Text>
      </div>
      <Field label={$ipt('audit_logins')}>
        <Switch bind:checked={getLogins, setLogins} />
      </Field>
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
    <Field label={$ipt('audit_action')}>
      <Select options={actionOptions} bind:value={getAction, setAction} />
    </Field>
    <Field label={$ipt('audit_person')}>
      <Select options={userOptions} bind:value={getUser, setUser} />
    </Field>
    <Field label={$ipt('audit_from')}>
      <DatePicker value={from} onChange={setFrom} />
    </Field>
    <Field label={$ipt('audit_to')}>
      <DatePicker value={to} onChange={setTo} />
    </Field>
  </div>

  {#if failed}
    <HelperText color="danger">{$ipt('audit_load_failed')}</HelperText>
  {:else}
    <div class="flex items-center justify-between gap-2">
      <Text size="small" color="muted">{$ipt('audit_total', { count: total })}</Text>
      <Button size="small" variant="ghost" leadingIcon={mdiDownload} onclick={exportCsv} disabled={total === 0}>
        {$ipt('audit_export')}
      </Button>
    </div>

    {#if items.length === 0}
      <Text color="muted">{$ipt('audit_empty')}</Text>
    {:else}
      <Table striped>
        <TableHeader>
          <TableHeading>{$ipt('audit_time')}</TableHeading>
          <TableHeading>{$ipt('audit_person')}</TableHeading>
          <TableHeading>{$ipt('audit_action')}</TableHeading>
          <TableHeading>{$ipt('audit_asset')}</TableHeading>
          <TableHeading>{$ipt('audit_count')}</TableHeading>
          <TableHeading>{$ipt('audit_details')}</TableHeading>
        </TableHeader>
        <TableBody>
          {#each items as item (item.id)}
            <TableRow>
              <TableCell>{formatTime(item.createdAt)}</TableCell>
              <TableCell>{formatPerson(item)}</TableCell>
              <TableCell>{$ipt(`audit.${item.action}`)}</TableCell>
              <TableCell>
                {#if item.assetName && item.assetIds[0]}
                  <a href={Route.viewAsset({ id: item.assetIds[0] })} class="text-primary underline">
                    {formatAsset(item)}
                  </a>
                {/if}
              </TableCell>
              <TableCell>{item.assetCount > 0 ? item.assetCount : ''}</TableCell>
              <TableCell>{formatDetails(item)}</TableCell>
            </TableRow>
          {/each}
        </TableBody>
      </Table>

      {#if items.length < total}
        <div>
          <Button variant="ghost" onclick={() => load(true)} {loading}>{$ipt('audit_load_more')}</Button>
        </div>
      {/if}
    {/if}

    <Text size="small" color="muted">{$ipt('audit_original_hint')}</Text>
  {/if}
</Stack>
