import { Migration } from '@mikro-orm/migrations';

export class Migration20220523155306 extends Migration {
  async up(): Promise<void> {
    this.addSql('drop table if exists `asset_string_property`;');

    this.addSql(
      'alter table `import_session` add column `target_collection_id` text null constraint `import_session_target_collection_id_foreign` references `asset_collection` (`id`) on update cascade on delete set null;'
    );
    this.addSql(
      'create index `import_session_target_collection_id_index` on `import_session` (`target_collection_id`);'
    );

    this.addSql(
      'create index `asset_import_session_id_index` on `asset_import` (`session_id`);'
    );
  }
}
