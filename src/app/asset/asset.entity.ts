import {
  Collection,
  Embedded,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { Dict } from '../../common/util/types';
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

  /**
   * Media files associated with the asset
   */
  @OneToMany(() => MediaFile, (media) => media.asset)
  mediaFiles = new Collection<MediaFile>(this);

  /**
   * Collection that the asset belongs to
   */
  @ManyToOne(() => AssetCollectionEntity, { nullable: false })
  collection!: AssetCollectionEntity;

  /**
   * Key-value metadata properties. Keys are the id of schema property
   */
  @Property({ type: 'json', nullable: false })
  metadata: Dict = {};
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

  /**
   * Assets in this collection
   */
  @OneToMany(() => AssetEntity, (media) => media.collection)
  assets = new Collection<AssetEntity>(this);

  /**
   * Schema associated with this collection
   */
  @Embedded(() => SchemaPropertyValue, { array: true })
  schema: SchemaPropertyValue[] = [];
}
