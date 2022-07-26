import { Migration } from '@mikro-orm/migrations';

export class Migration20220331085930 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table `asset` add column `metadata` json not null;');
  }
}
