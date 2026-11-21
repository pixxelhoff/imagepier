<script lang="ts">
  import ServerAboutItem from '#lib/components/ServerAboutItem.svelte';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import type { ServerAboutResponseDto } from '@immich/sdk';

  type Props = {
    info: ServerAboutResponseDto;
  };

  const { info }: Props = $props();

  // Release builds carry the tag (e.g. v3.4.2-ip.5) as source ref, other builds the branch name.
  const version = $derived(info.sourceRef ?? info.version);
</script>

<ServerAboutItem
  id="imagepier"
  title="ImagePier"
  version={$ipt('based_on_immich', { version })}
  class="col-span-full"
/>
