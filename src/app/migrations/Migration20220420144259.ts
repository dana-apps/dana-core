import { Migration } from '@mikro-orm/migrations';
import { required } from '../../common/util/assert';

export class Migration20220412144332 extends Migration {
  async up(): Promise<void> {
    const t = required(this.ctx, 'Expected a transaction');

    // Define the repeaeted property on all schemas
    const collections = await t.table('asset_collection').select();

    for (const c of collections) {
      const schema = JSON.parse(c.schema);
      for (const property of schema) {
        property.repeated = false;
      }

      await t
        .table('asset_collection')
        .where({ id: c.id })
        .update('schema', JSON.stringify(schema));
    }

    // Convert all metadata to be array-oriented
    const convertTable = async (table: string) => {
      const assets = await t.table(table).select();

      for (const asset of assets) {
        const metadata = JSON.parse(asset.metadata);
        for (const [key, val] of Object.entries(metadata)) {
          if (val === undefined || val === null) {
            metadata[key] = [];
          } else if (Array.isArray(val)) {
            metadata[key] = val;
          } else {
            metadata[key] = [val];
          }
        }

        await t
          .table(table)
          .where({ id: asset.id })
          .update('metadata', JSON.stringify(metadata));
      }
    };

    await convertTable('asset');
    await convertTable('asset_import');
  }
}
