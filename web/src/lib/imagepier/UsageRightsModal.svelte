<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    CHANNEL_VALUES,
    CHECK_VALUES,
    EDITING_OPTIONS,
    LICENSE_TYPES,
    RELEASE_STATUSES,
    RIGHTS_CHECKS,
    TERRITORIES,
    TRANSFER_OPTIONS,
    USAGE_RIGHTS_VERSION,
    getChannelValue,
    getChannels,
    type Channel,
    type ChannelValue,
    type CheckValue,
    type RightsCheck,
    type UsageRights,
    type UsageRightsInput,
  } from '#lib/imagepier/usage-rights.ts';
  import { Button, DatePicker, Field, FormModal, Input, Label, Select, Stack, Text, Textarea } from '@immich/ui';
  import { mdiCopyright } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount } from 'svelte';

  type Props = {
    rights?: UsageRights;
    title?: string;
    hint?: string;
    /** Whether the user may decide the release status (admins, media managers of the area, owners). */
    canRelease?: boolean;
    /** Several assets: the release status can be left unchanged. */
    bulk?: boolean;
    onClose: (rights?: UsageRightsInput) => void;
  };

  let { rights, title, hint, canRelease = true, bulk = false, onClose }: Props = $props();

  // Saving usage rights "in review" approves them by default, as media managers review them while editing.
  const getInitialStatus = () => {
    if (bulk) {
      return '';
    }
    if (rights?.status && rights.status !== 'suggested') {
      return rights.status;
    }
    return canRelease ? 'confirmed' : 'suggested';
  };

  let status = $state<string>(getInitialStatus());
  let restriction = $state(rights?.restriction ?? '');
  let photographer = $state(rights?.photographer ?? '');
  let copyrightHolder = $state(rights?.copyrightHolder ?? '');
  let licenseType = $state<string>(rights?.licenseType ?? '');
  let licenseSource = $state(rights?.licenseSource ?? '');
  let channels = $state<Channel[]>([]);
  // Several assets: channels without a value keep the value of each asset.
  let channelValues = $state<Record<string, ChannelValue | ''>>({});
  let usageNote = $state(rights?.usageNote ?? '');

  // Active channels, plus deactivated channels that this asset still uses.
  const shownChannels = $derived(
    channels.filter((channel) => channel.active || (!bulk && getChannelValue(rights, channel.id) !== 'no')),
  );
  const hasConditional = $derived(Object.values(channelValues).includes('conditional'));

  onMount(() => {
    getChannels()
      .then((items) => {
        channels = items;
        channelValues = Object.fromEntries(
          items.map((channel) => [channel.id, bulk ? '' : getChannelValue(rights, channel.id)]),
        );
      })
      .catch((error: unknown) => console.error(error));
  });

  const channelOptions = $derived([
    ...(bulk ? [{ label: $ipt('release_status_unchanged'), value: '' }] : []),
    ...CHANNEL_VALUES.map((value) => ({ label: $ipt(`channel_value.${value}`), value })),
  ]);
  let imageTitle = $state(rights?.title ?? '');
  let altText = $state(rights?.altText ?? '');
  let rightsDocument = $state(rights?.rightsDocument ?? '');
  let territory = $state<string>(rights?.territory ?? '');
  let territoryNote = $state(rights?.territoryNote ?? '');
  let editing = $state<string>(rights?.editing ?? '');
  let transfer = $state<string>(rights?.transfer ?? '');
  let exclusive = $state<string>(rights?.exclusive === undefined ? '' : rights.exclusive ? 'yes' : 'no');
  // Several assets: checks without a value keep the value of each asset.
  let checkValues = $state<Record<string, CheckValue | ''>>(
    Object.fromEntries(RIGHTS_CHECKS.map((check) => [check, bulk ? '' : (rights?.checks?.[check] ?? 'none')])),
  );

  // In the dialog for several assets an empty value keeps the current values, otherwise it means "not specified".
  const emptyOption = $derived({ label: bulk ? $ipt('release_status_unchanged') : $ipt('not_specified'), value: '' });
  const territoryOptions = $derived([
    emptyOption,
    ...TERRITORIES.map((item) => ({ label: $ipt(`territory.${item}`), value: item })),
  ]);
  const editingOptions = $derived([
    emptyOption,
    ...EDITING_OPTIONS.map((item) => ({ label: $ipt(`editing.${item}`), value: item })),
  ]);
  const transferOptions = $derived([
    emptyOption,
    ...TRANSFER_OPTIONS.map((item) => ({ label: $ipt(`transfer.${item}`), value: item })),
  ]);
  const exclusiveOptions = $derived([
    emptyOption,
    { label: $ipt('yes'), value: 'yes' },
    { label: $ipt('no'), value: 'no' },
  ]);
  const checkOptions = $derived([
    ...(bulk ? [{ label: $ipt('release_status_unchanged'), value: '' }] : []),
    ...CHECK_VALUES.map((value) => ({ label: $ipt(`check_value.${value}`), value })),
  ]);

  let validUntil = $state(rights?.validUntil ?? '');
  let creditLine = $state(rights?.creditLine ?? '');
  let notes = $state(rights?.notes ?? '');

  const statusOptions = $derived([
    ...(bulk ? [{ label: $ipt('release_status_unchanged'), value: '' }] : []),
    ...RELEASE_STATUSES.map((item) => ({ label: $ipt(`release_status.${item}`), value: item })),
  ]);

  const licenseOptions = $derived([
    { label: $ipt('not_specified'), value: '' },
    ...LICENSE_TYPES.map((type) => ({ label: $ipt(`license.${type}`), value: type })),
  ]);

  const onSubmit = () => {
    onClose({
      version: USAGE_RIGHTS_VERSION,
      status: canRelease ? RELEASE_STATUSES.find((item) => item === status) : rights?.status,
      restriction: status === 'restricted' ? restriction : undefined,
      photographer,
      copyrightHolder,
      licenseType: LICENSE_TYPES.find((type) => type === licenseType),
      licenseSource,
      permittedUsage: rights?.permittedUsage,
      conditionalUsage: rights?.conditionalUsage,
      channels: Object.fromEntries(
        Object.entries(channelValues).filter((entry): entry is [string, ChannelValue] => entry[1] !== ''),
      ),
      usageNote,
      title: imageTitle,
      altText,
      rightsDocument,
      territory: TERRITORIES.find((item) => item === territory),
      territoryNote,
      editing: EDITING_OPTIONS.find((item) => item === editing),
      transfer: TRANSFER_OPTIONS.find((item) => item === transfer),
      exclusive: exclusive === '' ? undefined : exclusive === 'yes',
      checkValues: Object.fromEntries(
        Object.entries(checkValues).filter((entry): entry is [RightsCheck, CheckValue] => entry[1] !== ''),
      ),
      validUntil: validUntil || undefined,
      creditLine,
      notes,
    });
  };
</script>

<FormModal
  title={title ?? $ipt('usage_rights_edit')}
  icon={mdiCopyright}
  onClose={() => onClose()}
  {onSubmit}
  size="medium"
>
  <Stack gap={4}>
    {#if hint}
      <Text size="small" color="muted">{hint}</Text>
    {/if}

    {#if canRelease}
      <Field label={$ipt('release_status')}>
        <Select bind:value={status} options={statusOptions} />
      </Field>
      {#if status === 'restricted'}
        <Field label={$ipt('release_restriction')}>
          <Input bind:value={restriction} placeholder={$ipt('release_restriction_placeholder')} />
        </Field>
      {/if}
    {:else}
      <Text size="small" color="muted">{$ipt('release_status_by_managers')}</Text>
    {/if}

    <Field label={$ipt('image_title')}>
      <Input bind:value={imageTitle} />
    </Field>

    <Field label={$ipt('alt_text')}>
      <Textarea bind:value={altText} rows={2} placeholder={$ipt('alt_text_placeholder')} />
    </Field>

    <Field label={$ipt('photographer')}>
      <Input bind:value={photographer} />
    </Field>

    <Field label={$ipt('copyright_holder')}>
      <Input bind:value={copyrightHolder} />
    </Field>

    <Field label={$ipt('credit_line')}>
      <Input bind:value={creditLine} placeholder={$ipt('credit_line_placeholder')} />
    </Field>

    <Field label={$ipt('license_type')}>
      <Select bind:value={licenseType} options={licenseOptions} />
    </Field>

    <Field label={$ipt('license_source')}>
      <Input bind:value={licenseSource} />
    </Field>

    <Field label={$ipt('rights_document')}>
      <Input bind:value={rightsDocument} placeholder={$ipt('rights_document_placeholder')} />
    </Field>

    <div>
      <Label label={$ipt('channels')} />
      <div class="mt-2 flex flex-col gap-2">
        {#each shownChannels as channel (channel.id)}
          <div class="flex items-center gap-3">
            <Text class="min-w-0 grow truncate">{channel.label}</Text>
            <div class="w-44 shrink-0">
              <Select
                options={channelOptions}
                bind:value={
                  () => channelValues[channel.id] ?? '',
                  (value) => (channelValues[channel.id] = value as ChannelValue | '')
                }
              />
            </div>
          </div>
        {/each}
      </div>
    </div>

    {#if hasConditional || usageNote}
      <Field label={$ipt('usage_note')}>
        <Input bind:value={usageNote} placeholder={$ipt('usage_note_placeholder')} />
      </Field>
    {/if}

    <div>
      <Label label={$ipt('rights_scope')} />
      <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label={$ipt('territory')}>
          <Select bind:value={territory} options={territoryOptions} />
        </Field>
        <Field label={$ipt('territory_note')}>
          <Input bind:value={territoryNote} placeholder={$ipt('territory_note_placeholder')} />
        </Field>
        <Field label={$ipt('editing')}>
          <Select bind:value={editing} options={editingOptions} />
        </Field>
        <Field label={$ipt('transfer')}>
          <Select bind:value={transfer} options={transferOptions} />
        </Field>
        <Field label={$ipt('exclusive')}>
          <Select bind:value={exclusive} options={exclusiveOptions} />
        </Field>
      </div>
    </div>

    <div>
      <Label label={$ipt('rights_checks')} />
      <div class="mt-2 flex flex-col gap-2">
        {#each RIGHTS_CHECKS as check (check)}
          <div class="flex items-center gap-3">
            <Text class="min-w-0 grow">{$ipt(`check.${check}`)}</Text>
            <div class="w-44 shrink-0">
              <Select
                options={checkOptions}
                bind:value={() => checkValues[check] ?? '', (value) => (checkValues[check] = value as CheckValue | '')}
              />
            </div>
          </div>
        {/each}
      </div>
    </div>

    <Field label={$ipt('valid_until')}>
      <DatePicker
        value={validUntil ? DateTime.fromISO(validUntil) : undefined}
        onChange={(date) => (validUntil = date?.toISODate() ?? '')}
      />
    </Field>
    {#if validUntil}
      <div>
        <Button size="small" variant="ghost" color="secondary" onclick={() => (validUntil = '')}>
          {$ipt('clear_date')}
        </Button>
      </div>
    {/if}

    <Field label={$ipt('notes')}>
      <Textarea bind:value={notes} rows={3} />
    </Field>
  </Stack>
</FormModal>
