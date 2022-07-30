import { Migration } from '@mikro-orm/migrations';

export class Migration20220729231003 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      "alter table `asset_import` add column `redacted_properties` json not null default '[]';"
    );
  }
}
