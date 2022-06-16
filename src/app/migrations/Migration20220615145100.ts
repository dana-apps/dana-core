import { Migration } from '@mikro-orm/migrations';
import { randomUUID } from 'crypto';

export class Migration20220523155306 extends Migration {
  async up(): Promise<void> {
    const collectionUuid = randomUUID();

    this.addSql(
      `insert into asset_collection (id, schema, title, parent_id) select '${collectionUuid}', null, 'Main Collection', id from asset_collection where id = '$root'`
    );
    this.addSql(
      `update asset set collection_id = '${collectionUuid}' where collection_id = '$root'`
    );
  }
}
