<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { NavbarItem } from '@immich/ui';
  import { mdiFolderMultipleImage, mdiTagMultipleOutline, mdiTextBoxSearchOutline, mdiTrashCanOutline } from '@mdi/js';
</script>

<NavbarItem title={$ipt('areas')} href="/admin/media-library" icon={mdiFolderMultipleImage} />
<NavbarItem title={$ipt('keywords')} href="/admin/keywords" icon={mdiTagMultipleOutline} />
<NavbarItem title={$ipt('admin_trash')} href="/admin/trash" icon={mdiTrashCanOutline} />
<NavbarItem title={$ipt('audit_title')} href="/admin/audit" icon={mdiTextBoxSearchOutline} />
