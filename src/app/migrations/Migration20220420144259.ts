import { Migration } from '@mikro-orm/migrations';
import { required } from '../../common/util/assert';

export class Migration20220412144332 extends Migration {
  async up(): Promise<void> {
    const t = required(this.ctx, 'Expected a transaction§');
    const collections = await t.table('asset_collection').select();

    for (const c of collections) {
      const schema = JSON.parse(c.schema);
      for (const property of schema) {
        property.repeated = false;
      }

      await t
        .table('asset_collection')
        .update('schema', JSON.stringify(schema));
    }
  }
}
