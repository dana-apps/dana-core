import { Entity, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Asset } from '../../common/asset.interfaces';
import { AssetEntity } from '../asset/asset.entity';

@Entity()
export class MediaFile {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @Property({ type: 'string', nullable: false })
  sha256!: string;

  @Property({ type: 'string', nullable: false })
  mimeType!: string;

  @ManyToOne(() => AssetEntity, { nullable: true })
  asset?: Asset;
}
