import { Migration } from '@mikro-orm/migrations';

export class Migration20220325122538 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "create table `import_session` (`id` text not null, `base_path` text not null, `phase` text check (`phase` in ('READ_METADATA', 'READ_FILES', 'COMPLETED', 'ERROR')) not null, primary key (`id`));"
    );

    this.addSql(
      "create table `asset_import` (`id` text not null, `path` text not null, `session_id` text not null, `metadata` json not null, `phase` text check (`phase` in ('READ_METADATA', 'READ_FILES', 'COMPLETED', 'ERROR')) not null, constraint `asset_import_session_id_foreign` foreign key(`session_id`) references `import_session`(`id`) on delete cascade on update cascade, primary key (`id`));"
    );
    this.addSql(
      'create index `asset_import_session_id_index` on `asset_import` (`session_id`);'
    );

    this.addSql(
      'create table `asset` (`id` text not null, primary key (`id`));'
    );

    this.addSql(
      'create table `asset_string_property` (`id` text not null, `key` text not null, `value` text not null, `asset_id` text not null, constraint `asset_string_property_asset_id_foreign` foreign key(`asset_id`) references `asset`(`id`) on delete cascade on update cascade, primary key (`id`));'
    );
    this.addSql(
      'create index `asset_string_property_asset_id_index` on `asset_string_property` (`asset_id`);'
    );

    this.addSql(
      'create table `media_file` (`id` text not null, `sha256` text not null, `mime_type` text not null, `asset_id` text null, constraint `media_file_asset_id_foreign` foreign key(`asset_id`) references `asset`(`id`) on delete set null on update cascade, primary key (`id`));'
    );
    this.addSql(
      'create index `media_file_asset_id_index` on `media_file` (`asset_id`);'
    );

    this.addSql(
      "create table `file_import` (`id` text not null, `path` text not null, `asset_id` text not null, `media_id` text null, `error` text check (`error` in ('UNSUPPORTED_MEDIA_TYPE', 'IO_ERROR', 'UNEXPECTED_ERROR')) null, constraint `file_import_asset_id_foreign` foreign key(`asset_id`) references `asset_import`(`id`) on delete cascade on update cascade, constraint `file_import_media_id_foreign` foreign key(`media_id`) references `media_file`(`id`) on delete set null on update cascade, primary key (`id`));"
    );
    this.addSql(
      'create index `file_import_asset_id_index` on `file_import` (`asset_id`);'
    );
    this.addSql(
      'create index `file_import_media_id_index` on `file_import` (`media_id`);'
    );
  }
}
