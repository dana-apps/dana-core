import { Migration } from '@mikro-orm/migrations';

export class Migration20220412144332 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "alter table `asset_collection` add column `title` text default '' ;"
    );
    this.addSql("update `asset_collection` set `title` = '' ;");
    this.addSql(
      'alter table `asset_collection` add column `parent_id` text null constraint asset_collection_parent_id_foreign references `asset_collection` (`id`) on update cascade on delete set null;'
    );
    this.addSql(
      'create index `asset_collection_parent_id_index` on `asset_collection` (`parent_id`);'
    );
  }
}
