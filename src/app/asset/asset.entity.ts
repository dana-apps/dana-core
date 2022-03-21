import { Entity, PrimaryKey } from '@mikro-orm/core';
import { randomUUID } from 'crypto';

@Entity({
  tableName: 'asset'
})
export class Asset {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();
}
