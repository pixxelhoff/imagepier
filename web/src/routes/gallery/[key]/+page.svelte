<script lang="ts">
  import GalleryView from '#lib/imagepier/GalleryView.svelte';
  import type { PageData } from './$types';

  type Props = {
    data: PageData;
  };

  const { data }: Props = $props();
</script>

<GalleryView galleryKey={data.key} />
