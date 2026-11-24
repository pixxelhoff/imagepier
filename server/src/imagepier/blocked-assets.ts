import { sql, type SelectQueryBuilder } from 'kysely';
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
