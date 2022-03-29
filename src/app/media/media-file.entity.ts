import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Asset } from '../../common/asset.interfaces';
import { AssetEntity } from '../asset/asset.entity';

@Entity()
export class MediaFile {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  /** Hash of the file contents */
  @Property({ type: 'string', nullable: false })
  sha256!: string;

  /** Mime type of the media file */
  @Property({ type: 'string', nullable: false })
  mimeType!: string;

  /** Asset that owns the media file. This will be undefined for uncommited imports */
  @ManyToOne(() => AssetEntity, { nullable: true, onDelete: 'set null' })
  asset?: Asset;
}
