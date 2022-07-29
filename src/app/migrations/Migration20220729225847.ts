import { Migration } from '@mikro-orm/migrations';

export class Migration20220729225847 extends Migration {
  async up(): Promise<void> {
    this.addSql(
      'alter table `asset` add column `redacted_properties` json not null;'
    );
    this.addSql("update `asset` set `redacted_properties` = '[]' ;");
  }
}
