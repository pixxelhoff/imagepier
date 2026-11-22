<script lang="ts">
  import GalleryBrandingFields from '#lib/imagepier/GalleryBrandingFields.svelte';
  import { getGalleryBranding, updateGalleryBranding, type GalleryBranding } from '#lib/imagepier/gallery.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { Button, Stack, Text, toastManager } from '@immich/ui';
  import { onMount } from 'svelte';

  let branding = $state<GalleryBranding>({});
  let loaded = $state(false);
  let saving = $state(false);

  onMount(() => {
    void getGalleryBranding()
      .then((value) => {
        branding = value;
        loaded = true;
      })
      .catch(() => (loaded = false));
  });

  const save = async () => {
    saving = true;
    try {
      branding = await updateGalleryBranding(branding);
      toastManager.primary($ipt('gallery_branding_saved'));
    } catch (error) {
      handleError(error, $ipt('gallery_failed'));
    } finally {
      saving = false;
    }
  };
</script>

{#if loaded}
  <Stack gap={4}>
    <Text color="muted">{$ipt('gallery_branding_description')}</Text>
    <GalleryBrandingFields bind:branding />
    <div>
      <Button onclick={save} loading={saving}>{$ipt('save')}</Button>
    </div>
  </Stack>
{/if}
