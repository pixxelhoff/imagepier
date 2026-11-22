<script lang="ts">
  import type { Area } from '#lib/imagepier/access.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { Field, FormModal, Select, Stack, Text } from '@immich/ui';
  import { mdiFolderMultipleImage } from '@mdi/js';

  type Props = {
    title: string;
    hint?: string;
    areas: Area[];
    onClose: (areaId?: string) => void;
  };

  let { title, hint, areas, onClose }: Props = $props();

  let areaId = $state('');

  const options = $derived(areas.map((area) => ({ label: area.name, value: area.id })));

  $effect(() => {
    if (!areaId && areas.length > 0) {
      areaId = areas[0].id;
    }
  });

  const onSubmit = () => onClose(areaId || undefined);
</script>

<FormModal {title} icon={mdiFolderMultipleImage} onClose={() => onClose()} {onSubmit} size="small">
  <Stack gap={4}>
    {#if hint}
      <Text size="small" color="muted">{hint}</Text>
    {/if}

    <Field label={$ipt('area')}>
      <Select bind:value={areaId} {options} />
    </Field>
  </Stack>
</FormModal>
