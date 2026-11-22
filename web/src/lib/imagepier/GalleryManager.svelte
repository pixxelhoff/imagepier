<script lang="ts">
  import GalleryBrandingFields from '#lib/imagepier/GalleryBrandingFields.svelte';
  import { getMyAccess, type MyAccess } from '#lib/imagepier/access.ts';
  import {
    createGallery,
    deleteGallery,
    getGalleries,
    getGalleryPageUrl,
    updateGallery,
    type Gallery,
    type GalleryBranding,
  } from '#lib/imagepier/gallery.ts';
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { copyToClipboard } from '#lib/utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { getAllAlbums, type AlbumResponseDto } from '@immich/sdk';
  import {
    Button,
    Field,
    Heading,
    HelperText,
    Icon,
    IconButton,
    Input,
    Select,
    Stack,
    Switch,
    Text,
    modalManager,
    toastManager,
  } from '@immich/ui';
  import { mdiContentCopy, mdiDeleteOutline, mdiOpenInNew, mdiPencilOutline, mdiPlus } from '@mdi/js';
  import { onMount } from 'svelte';

  type GalleryEdit = { id: string; title: string; allowDownload: boolean; branding: GalleryBranding };

  let access = $state<MyAccess>();
  let galleries = $state<Gallery[]>([]);
  let defaults = $state<GalleryBranding>({});
  let albums = $state<AlbumResponseDto[]>([]);
  let failed = $state(false);
  let saving = $state(false);

  let albumId = $state('');
  let title = $state('');
  let allowDownload = $state(true);

  let edit = $state<GalleryEdit>();
  let updating = $state(false);

  const load = async () => {
    try {
      access = await getMyAccess(authManager.user.id);
      const [list, allAlbums] = await Promise.all([getGalleries(), getAllAlbums({})]);
      galleries = list.galleries;
      defaults = list.defaults;
      albums =
        access.role === 'admin'
          ? allAlbums
          : allAlbums.filter((album) => album.albumUsers[0]?.user.id === authManager.user.id);
      failed = false;
    } catch {
      failed = true;
    }
  };

  onMount(() => {
    void load();
  });

  const albumOptions = $derived([
    { label: $ipt('gallery_album_choose'), value: '' },
    ...albums.map((album) => ({ label: album.albumName, value: album.id })),
  ]);

  const getAlbum = () => albumId;
  const setAlbum = (value: string) => {
    albumId = value;
    if (!title) {
      title = albums.find((album) => album.id === value)?.albumName ?? '';
    }
  };

  const create = async () => {
    if (!albumId || !title.trim()) {
      return;
    }
    saving = true;
    try {
      const gallery = await createGallery({ albumId, title: title.trim(), allowDownload });
      const albumName = albums.find((album) => album.id === albumId)?.albumName ?? null;
      galleries = [...galleries, { ...gallery, albumName }];
      albumId = '';
      title = '';
      allowDownload = true;
      toastManager.primary($ipt('gallery_created'));
    } catch (error) {
      handleError(error, $ipt('gallery_failed'));
    } finally {
      saving = false;
    }
  };

  const describe = (gallery: Gallery) =>
    [
      gallery.albumName ?? '–',
      $ipt(gallery.allowDownload ? 'gallery_download_on' : 'gallery_download_off'),
      ...(gallery.branding ? [$ipt('gallery_own_branding_active')] : []),
    ].join(' · ');

  const startEdit = (gallery: Gallery) => {
    edit = {
      id: gallery.id,
      title: gallery.title,
      allowDownload: gallery.allowDownload,
      branding: { ...gallery.branding },
    };
  };

  const saveEdit = async () => {
    if (!edit || !edit.title.trim()) {
      return;
    }
    updating = true;
    try {
      const { id, branding } = edit;
      const updated = await updateGallery(id, {
        title: edit.title.trim(),
        allowDownload: edit.allowDownload,
        branding,
      });
      galleries = galleries.map((item) => (item.id === id ? { ...updated, albumName: item.albumName } : item));
      edit = undefined;
      toastManager.primary($ipt('gallery_saved'));
    } catch (error) {
      handleError(error, $ipt('gallery_failed'));
    } finally {
      updating = false;
    }
  };

  const remove = async (gallery: Gallery) => {
    const isConfirmed = await modalManager.showDialog({
      prompt: $ipt('gallery_delete_confirm', { title: gallery.title }),
    });
    if (!isConfirmed) {
      return;
    }
    try {
      await deleteGallery(gallery.id);
      galleries = galleries.filter((item) => item.id !== gallery.id);
      if (edit?.id === gallery.id) {
        edit = undefined;
      }
      toastManager.primary($ipt('gallery_deleted'));
    } catch (error) {
      handleError(error, $ipt('gallery_failed'));
    }
  };
</script>

<Stack gap={6}>
  <Text color="muted">{$ipt('galleries_description')}</Text>

  {#if failed}
    <HelperText color="danger">{$ipt('gallery_failed')}</HelperText>
  {:else if access && access.role !== 'admin' && access.role !== 'manager'}
    <Text color="muted">{$ipt('galleries_no_permission')}</Text>
  {:else if access}
    <div class="flex flex-col gap-3">
      {#if galleries.length === 0}
        <Text color="muted">{$ipt('galleries_empty')}</Text>
      {/if}
      {#each galleries as gallery (gallery.id)}
        <div class="flex items-center gap-2">
          <div class="min-w-0 grow">
            <Text class="truncate">{gallery.title}</Text>
            <Text size="small" color="muted">{describe(gallery)}</Text>
          </div>
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            icon={mdiContentCopy}
            aria-label={$ipt('gallery_copy_link')}
            onclick={() => copyToClipboard(getGalleryPageUrl(gallery.key))}
          />
          <a
            href={getGalleryPageUrl(gallery.key)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={$ipt('gallery_open')}
            title={$ipt('gallery_open')}
            class="p-2"
          >
            <Icon icon={mdiOpenInNew} size="20" />
          </a>
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            icon={mdiPencilOutline}
            aria-label={$ipt('gallery_edit')}
            onclick={() => startEdit(gallery)}
          />
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            icon={mdiDeleteOutline}
            aria-label={$ipt('gallery_delete')}
            onclick={() => remove(gallery)}
          />
        </div>
        {#if edit && edit.id === gallery.id}
          <div class="flex flex-col gap-4 rounded-2xl border p-4">
            <Text>{$ipt('gallery_edit')}</Text>
            <Field label={$ipt('gallery_title')}>
              <Input bind:value={edit.title} />
            </Field>
            <Field label={$ipt('gallery_allow_download')}>
              <Switch bind:checked={edit.allowDownload} />
            </Field>
            <Heading size="tiny" tag="h3">{$ipt('gallery_own_branding')}</Heading>
            <GalleryBrandingFields bind:branding={edit.branding} {defaults} />
            <div class="flex gap-2">
              <Button onclick={saveEdit} loading={updating} disabled={!edit.title.trim()}>{$ipt('save')}</Button>
              <Button variant="ghost" color="secondary" onclick={() => (edit = undefined)}>
                {$ipt('gallery_cancel')}
              </Button>
            </div>
          </div>
        {/if}
      {/each}
    </div>

    <div class="flex flex-col gap-4 rounded-2xl border p-4">
      <Text>{$ipt('gallery_create')}</Text>
      <Field label={$ipt('gallery_album')}>
        <Select options={albumOptions} bind:value={getAlbum, setAlbum} />
      </Field>
      <Field label={$ipt('gallery_title')}>
        <Input bind:value={title} />
      </Field>
      <Field label={$ipt('gallery_allow_download')}>
        <Switch bind:checked={allowDownload} />
      </Field>
      <Text size="small" color="muted">{$ipt('gallery_published_hint')}</Text>
      <div>
        <Button leadingIcon={mdiPlus} onclick={create} loading={saving} disabled={!albumId || !title.trim()}>
          {$ipt('gallery_create')}
        </Button>
      </div>
    </div>
  {/if}
</Stack>
