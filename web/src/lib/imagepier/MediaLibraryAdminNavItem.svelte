<script lang="ts">
  import { ipt } from '#lib/imagepier/i18n.ts';
  import { NavbarItem } from '@immich/ui';
  import { mdiFolderMultipleImage, mdiTextBoxSearchOutline } from '@mdi/js';
</script>

<NavbarItem title={$ipt('media_library')} href="/admin/media-library" icon={mdiFolderMultipleImage} />
<NavbarItem title={$ipt('audit_title')} href="/admin/audit" icon={mdiTextBoxSearchOutline} />
