import { Migration } from '@mikro-orm/migrations';

export class Migration20220319030748 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'create table `media_file` (`id` json not null, `sha256` text not null, `mime_type` text not null, primary key (`id`));'
    );

    this.addSql(
      'create table `asset` (`id` json not null, primary key (`id`));'
    );

    this.addSql(
      'create table `import_session` (`id` json not null, `base_path` text not null, `phase` integer not null, primary key (`id`));'
    );

    this.addSql(
      'create table `asset_import` (`id` json not null, `path` text not null, `session_id` json not null, `metadata` json not null, `phase` integer not null, constraint `asset_import_session_id_foreign` foreign key(`session_id`) references `import_session`(`id`) on delete cascade on update cascade, primary key (`id`));'
    );
    this.addSql(
      'create index `asset_import_session_id_index` on `asset_import` (`session_id`);'
    );

    this.addSql(
      'create table `file_import` (`id` json not null, `path` text not null, `asset_id` json not null, `media_id` json null, `error` integer null, constraint `file_import_asset_id_foreign` foreign key(`asset_id`) references `asset_import`(`id`) on delete cascade on update cascade, constraint `file_import_media_id_foreign` foreign key(`media_id`) references `media_file`(`id`) on delete set null on update cascade, primary key (`id`));'
    );
    this.addSql(
      'create index `file_import_asset_id_index` on `file_import` (`asset_id`);'
    );
    this.addSql(
      'create index `file_import_media_id_index` on `file_import` (`media_id`);'
    );
  }
}
