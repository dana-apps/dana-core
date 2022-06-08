import { Migration } from '@mikro-orm/migrations';
import { required } from '../../common/util/assert';

export class Migration20220608153338 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table `asset_import` add column `access_control` text null;'
    );

    this.addSql(
      "alter table `asset` add column `access_control` text not null default 'RESTRICTED';"
    );

    const t = required(this.ctx, 'Expected a transaction');

    // Define the repeaeted property on all schemas
    const collections = await t.table('asset_collection').select();

    for (const c of collections) {
      const schema = JSON.parse(c.schema);
      for (const property of schema) {
        property.visible = true;
      }

      await t
        .table('asset_collection')
        .where({ id: c.id })
        .update('schema', JSON.stringify(schema));
    }
  }
}
