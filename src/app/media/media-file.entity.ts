import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';

@Entity()
export class MediaFile {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @Property({ type: 'string', nullable: false })
  sha256!: string;

  @Property({ type: 'string', nullable: false })
  mimeType!: string;
}
