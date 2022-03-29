import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryKey,
  Property
} from '@mikro-orm/core';
import { randomUUID } from 'crypto';
import { tuple } from '../../common/util/collection';
import { MediaFile } from '../media/media-file.entity';

@Entity({
  tableName: 'asset'
})
export class AssetEntity {
  /**
   * Conventience for. These should be passed to the `populate` parameter of database queries in order to ensure that
   * media and metadata are fetched.
   */
  static MEDIA_AND_METADATA_RELATIONS = tuple('mediaFiles', 'stringProperties');

  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @OneToMany(() => MediaFile, (media) => media.asset)
  mediaFiles = new Collection<MediaFile>(this);

  @OneToMany(() => AssetStringProperty, (prop) => prop.asset)
  stringProperties = new Collection<AssetStringProperty>(this);

  /**
   * Build metadata object for this asset by collecting keys and values from related properties.
   *
   * Note that unless the relevant metadata collections have been populated, this will return an empty object. You
   * probably want to pass MEDIA_AND_METADATA_RELATIONS to a query's populate option if you want to use this.
   *
   * @returns Object containing metadata properties for this asset.
   */
  metadataValues() {
    return {
      ...this.buildMetadata(this.stringProperties)
    };
  }

  /**
   * Build metadata object for this asset by collecting keys and values from related properties of a given type.
   *
   * @returns Object containing metadata properties for this property type on the asset.
   */
  private buildMetadata<T extends AssetProperty>(
    collection: Collection<T, unknown>
  ) {
    return Object.fromEntries(
      Array.from(collection).map((md) => [md.key, md.value])
    );
  }
}

/**
 * Common interface for asset metadata.
 *
 * Each data type should have its own entity.
 *
 * To make it easy to have data-driven schemas, metadata key-value pairs get their own table.
 * This is a sub-optimal approach as means queries have to make a lot of joins, but is probably fine for now and has
 * some scope for optimization.
 *
 * Alternative approaches would be to make the sqlite schema itself data-driven or use an embedded nosql index. These
 * would add a fair bit of complexity, but may be worth investigating at some pont.
 **/
interface AssetProperty<T = unknown> {
  key: string;
  value: T;
}

/**
 * AssetProperty implementation for full-text metadata.
 **/
@Entity({
  tableName: 'asset_string_property'
})
export class AssetStringProperty implements AssetProperty<string> {
  @PrimaryKey({ type: 'string' })
  id = randomUUID();

  @Property({ type: 'string', nullable: false })
  key!: string;

  @Property({ type: 'string', nullable: false })
  value!: string;

  @ManyToOne(() => AssetEntity, {
    nullable: false,
    onDelete: 'cascade'
  })
  asset!: AssetEntity;
}
