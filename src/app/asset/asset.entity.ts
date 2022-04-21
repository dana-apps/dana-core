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
import { SchemaPropertyType } from '../../common/asset.interfaces';
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
   * Human-readable name of the collection
   */
  @Property({ type: 'string', nullable: false })
  title!: string;

  /**
   * Parent of this collection
   */
  @ManyToOne(() => AssetCollectionEntity, {
    nullable: true,
    onDelete: 'set null'
  })
  parent?: AssetCollectionEntity;

  /**
   * Parent of this collection
   */
  @OneToMany(() => AssetCollectionEntity, (child) => child.parent)
  children = new Collection<AssetCollectionEntity>(this);

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

  /**
   * Return the schema property that is used
   *
   * This is currently defined as the first free text property in the schema. It may in future change to something more
   * explicit.
   *
   * @returns The scehma property used as the label for the asset, or undefined if no suitable property exists.
   */
  getTitleProperty() {
    return this.schema.find((x) => (x.type = SchemaPropertyType.FREE_TEXT));
  }

  /**
   * If this collection can hold 'label records', return the metadata for a label record given a string value to be the
   * label.
   *
   * A 'label record' is a record where the only required property (if any) is its title property. These can be created
   * easily from a string value.
   *
   * @param title The title property for the label record
   * @returns A Dict of metadata for creating/updating a label record.
   */
  getLabelRecordMetadata(title: string) {
    const titleProperty = this.getTitleProperty();
    const canBeLabelRecord =
      !!titleProperty &&
      this.schema.every((x) => !x.required || x.id === titleProperty.id);

    return canBeLabelRecord ? { [titleProperty.id]: title } : undefined;
  }
}
