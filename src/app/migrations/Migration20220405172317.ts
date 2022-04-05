import { Migration } from '@mikro-orm/migrations';

export class Migration20220405172317 extends Migration {
  async up(): Promise<void> {
    this.addSql('PRAGMA foreign_keys = OFF;');

    this.addSql(
      "CREATE TABLE `_knex_temp_alter630` (`id` text NOT NULL, `base_path` text NOT NULL, `phase` text check (`phase` in ('READ_METADATA', 'READ_FILES', 'PROCESS_FILES', 'COMPLETED', 'ERROR')) NOT NULL, `valid` integer NOT NULL, PRIMARY KEY (`id`));"
    );
    this.addSql(
      'INSERT INTO "_knex_temp_alter630" SELECT * FROM "import_session";;'
    );
    this.addSql('DROP TABLE "import_session";');
    this.addSql(
      'ALTER TABLE "_knex_temp_alter630" RENAME TO "import_session";'
    );

    this.addSql(
      "create table `_knex_temp_alter631` (`id` text not null, `path` text not null, `session_id` text not null, `metadata` json not null, `phase` text check (`phase` in ('READ_METADATA', 'READ_FILES', 'PROCESS_FILES', 'COMPLETED', 'ERROR')) not null, `validation_errors` json, constraint `asset_import_session_id_foreign` foreign key(`session_id`) references `import_session`(`id`) on delete cascade on update cascade, primary key (`id`));"
    );
    this.addSql(
      'INSERT INTO "_knex_temp_alter631" SELECT * FROM "asset_import";;'
    );
    this.addSql('DROP TABLE "asset_import";');
    this.addSql('ALTER TABLE "_knex_temp_alter631" RENAME TO "asset_import";');

    this.addSql('PRAGMA foreign_keys = ON;');
  }
}
