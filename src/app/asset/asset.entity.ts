import {
  Collection,
  Embedded,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { MediaFile } from '../media/media-file.entity';
import { SchemaPropertyValue } from './metadata.entity';

/**
 * Store an individual asset and its metadata in the database.
 */
@Entity({
  tableName: 'asset'
})
export class AssetEntity {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @OneToMany(() => MediaFile, (media) => media.asset)
  mediaFiles = new Collection<MediaFile>(this);

  @ManyToOne(() => AssetCollectionEntity, { nullable: false })
  collection!: AssetCollectionEntity;
}

/**
 * Store an a collection of assets in the database and associate them with a metadata schema.
 */
@Entity({
  tableName: 'asset_collection'
})
export class AssetCollectionEntity {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @OneToMany(() => AssetEntity, (media) => media.collection)
  assets = new Collection<AssetEntity>(this);

  @Embedded(() => SchemaPropertyValue, { array: true })
  schema: SchemaPropertyValue[] = [];
}
