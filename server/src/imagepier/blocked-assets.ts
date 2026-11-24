import { sql, type SelectQueryBuilder } from 'kysely';
import type { AuthDto } from 'src/dtos/auth.dto.js';
import { getAreaLevel, getCachedAccessSettings, getUserAccess } from 'src/imagepier/access-rules.js';
import { USAGE_RIGHTS_KEY } from 'src/imagepier/usage-rights.js';
import type { DB } from 'src/schema/index.js';

/**
Leaves out assets whose usage rights have the status "blocked". Used for lists that visitors of shared links see
(timeline of album links); the regular timeline is not filtered.
*/
export const withoutBlockedAssets = <O>(qb: SelectQueryBuilder<DB, 'asset', O>) =>
  qb.where((eb) =>
    eb.not(
      eb.exists(
        eb
          .selectFrom('asset_metadata')
          .select(sql.lit(1).as('blocked'))
          .whereRef('asset_metadata.assetId', '=', 'asset.id')
          .where('asset_metadata.key', '=', USAGE_RIGHTS_KEY)
          .where(sql`asset_metadata.value->>'status'`, '=', 'blocked'),
      ),
    ),
  );

/**
Leaves out media library assets of areas the user has no level in. They can only reach the timeline through an album
shared with the user; the access checks refuse them as well.
*/
export const withoutHiddenAreas =
  (auth: AuthDto) =>
  <O>(qb: SelectQueryBuilder<DB, 'asset', O>) => {
    const settings = getCachedAccessSettings();
    if (!settings.libraryUserId || auth.user.isAdmin) {
      return qb;
    }
    const access = getUserAccess(settings, auth.user);
    const hidden = settings.areas
      .filter((area): area is typeof area & { userId: string } => !!area.userId && !getAreaLevel(access, area.id))
      .map((area) => area.userId);
    return hidden.length > 0 ? qb.where('asset.ownerId', 'not in', hidden) : qb;
  };
