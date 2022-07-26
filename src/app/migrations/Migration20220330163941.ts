import { Migration } from '@mikro-orm/migrations';

export class Migration20220330163941 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `asset_collection` (`id` text not null, `schema` json not null, primary key (`id`));'
    );

    this.addSql(
      'alter table `asset` add column `collection_id` text not null constraint asset_collection_id_foreign references `asset_collection` (`id`) on update cascade;'
    );
    this.addSql(
      'create index `asset_collection_id_index` on `asset` (`collection_id`);'
    );
  }
}
