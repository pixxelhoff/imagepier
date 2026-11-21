<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import {
    LICENSE_TYPES,
    PERMITTED_USAGES,
    USAGE_RIGHTS_VERSION,
    type PermittedUsage,
    type UsageRights,
  } from '#lib/imagepier/usage-rights.ts';
  import {
    Button,
    Checkbox,
    DatePicker,
    Field,
    FormModal,
    Input,
    Label,
    Select,
    Stack,
    Text,
    Textarea,
  } from '@immich/ui';
  import { mdiCopyright } from '@mdi/js';
  import { DateTime } from 'luxon';

  type Props = {
    rights?: UsageRights;
    title?: string;
    hint?: string;
    onClose: (rights?: UsageRights) => void;
  };

  let { rights, title, hint, onClose }: Props = $props();

  let photographer = $state(rights?.photographer ?? '');
  let copyrightHolder = $state(rights?.copyrightHolder ?? '');
  let licenseType = $state<string>(rights?.licenseType ?? '');
  let licenseSource = $state(rights?.licenseSource ?? '');
  let permittedUsage = $state<PermittedUsage[]>([...(rights?.permittedUsage ?? [])]);
  let validUntil = $state(rights?.validUntil ?? '');
  let creditLine = $state(rights?.creditLine ?? '');
  let notes = $state(rights?.notes ?? '');

  const licenseOptions = $derived([
    { label: $ipt('not_specified'), value: '' },
    ...LICENSE_TYPES.map((type) => ({ label: $ipt(`license.${type}`), value: type })),
  ]);

  const toggleUsage = (usage: PermittedUsage, checked: boolean) => {
    permittedUsage = checked
      ? PERMITTED_USAGES.filter((item) => item === usage || permittedUsage.includes(item))
      : permittedUsage.filter((item) => item !== usage);
  };

  const onSubmit = () => {
    onClose({
      version: USAGE_RIGHTS_VERSION,
      status: 'confirmed',
      photographer,
      copyrightHolder,
      licenseType: LICENSE_TYPES.find((type) => type === licenseType),
      licenseSource,
      permittedUsage,
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

    <div>
      <Label label={$ipt('permitted_usage')} />
      <div class="mt-2 flex flex-wrap gap-x-6 gap-y-2">
        {#each PERMITTED_USAGES as usage (usage)}
          <div class="flex items-center gap-2">
            <Checkbox
              id="imagepier-usage-{usage}"
              size="tiny"
              checked={permittedUsage.includes(usage)}
              onCheckedChange={(checked) => toggleUsage(usage, checked)}
            />
            <Label label={$ipt(`usage.${usage}`)} for="imagepier-usage-{usage}" />
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
