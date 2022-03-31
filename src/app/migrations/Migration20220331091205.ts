import { Migration } from '@mikro-orm/migrations';

export class Migration20220331091205 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table `import_session` add column `valid` integer not null;'
    );

    this.addSql(
      'alter table `asset_import` add column `validation_errors` json;'
    );
  }
}
