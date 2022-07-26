import { startCase } from 'lodash';
import { v4 } from 'uuid';
import { z } from 'zod';
import { ErrorType, RequestType, RpcInterface } from './ipc.interfaces';
import { Media } from './media.interfaces';
import { ResourceList } from './resource';
import { FetchError } from './util/error';

const AssetMetadataItem = z.object({
  rawValue: z.array(z.unknown().optional()),
  presentationValue: z.array(
    z.object({ rawValue: z.unknown().optional(), label: z.string() })
  )
});
/**
 * Represent a metadata property of an asset. Contains all the information required to display or edit a single metadata
 * property.
 **/
export interface AssetMetadataItem<T = unknown> {
  /*
   * The canonical value of the property, as stored in the database.
   *
   * Property values are always repredented using an array in order to allow for consistent treatment of single and
   * repated occurances in the schema.
   *
   * A null value for a non-repeated property implies a rawValue of `[]`.
   * A value for a non-repeated property implies an array of length 1
   * A repeated property will have 0 or more elements.
   */
  rawValue: (T | undefined)[];

  /**
   * For each element in `rawValue`, both the raw value and a human-readable string representation of it.
   */
  presentationValue: { rawValue?: T; label: string }[];
}

/**
 * Enum value for asset access rights.
 */
export enum AccessControl {
  /** The media files and metadata are visible to the public and published */
  PUBLIC = 'PUBLIC',

  /** The metadata only is visible to the public */
  METADATA_ONLY = 'METADATA_ONLY',

  /** Metadata and media files are not visible to the public */
  RESTRICTED = 'RESTRICTED'
}

export const getAccessControlLabel = (ac: AccessControl) =>
  startCase(ac.toLowerCase().replace(/_/g, ' '));

/**
 * Represent a single asset.
 */
export const Asset = z.object({
  /** Unique id of the asset */
  id: z.string(),

  /** Title of the assset */
  title: z.string(),

  /** Record of metadata associated with the asset */
  metadata: z.record(AssetMetadataItem),

  /** All media files associated with the asset */
  media: z.array(Media),

  /** Information about access rights */
  accessControl: z.nativeEnum(AccessControl)
});
export type Asset = z.TypeOf<typeof Asset>;
export type AssetMetadata = Asset['metadata'];

/**
 * Enum value for possible schema property types.
 */
export enum SchemaPropertyType {
  FREE_TEXT = 'FREE_TEXT',
  CONTROLLED_DATABASE = 'CONTROLLED_DATABASE'
}

/**
 * Common properties shared by all schema properties
 */
const BaseSchemaProperty = z.object({
  /** Unique id of the property */
  id: z.string(),

  /** Human-readable name for the property */
  label: z.string(),

  /** Is the property required? */
  required: z.boolean(),

  /** Does the property support multiple occurances? */
  repeated: z.boolean(),

  /** Is the the property visible to the public? */
  visible: z.boolean(),

  /** Underlying type of the property? */
  type: z.nativeEnum(SchemaPropertyType)
});

/**
 * Error object for validation of a single record
 */
export const SingleValidationError = z.record(z.array(z.string()));
export type SingleValidationError = z.TypeOf<typeof SingleValidationError>;

/**
 * Error object for validation of a multiple records
 */
export const AggregatedValidationError = z.record(
  z.array(
    z.object({
      message: z.string(),
      count: z.number()
    })
  )
);
export type AggregatedValidationError = z.TypeOf<
  typeof AggregatedValidationError
>;

/**
 * Error object for a rejected delete
 */
export const ReferentialIntegrityError = z.array(
  z.object({
    assetId: z.string(),
    assetTitle: z.string().optional(),
    collectionId: z.string(),
    collectionTitle: z.string(),
    propertyId: z.string(),
    propertyLabel: z.string()
  })
);
export type ReferentialIntegrityError = z.TypeOf<
  typeof ReferentialIntegrityError
>;

/**
 * Common interface for a schema property with no special configuration fields.
 */
export const ScalarSchemaProperty = z.object({
  ...BaseSchemaProperty.shape,

  type: z.enum([SchemaPropertyType.FREE_TEXT])
});
export type ScalarSchemaProperty = z.TypeOf<typeof ScalarSchemaProperty>;

export const ControlledDatabaseSchemaProperty = z.object({
  ...BaseSchemaProperty.shape,

  type: z.literal(SchemaPropertyType.CONTROLLED_DATABASE),
  databaseId: z.string()
});
export type ControlledDatabaseSchemaProperty = z.TypeOf<
  typeof ControlledDatabaseSchemaProperty
>;

/**
 * All schema property interface types
 */
export const SchemaProperty = z.union([
  ScalarSchemaProperty,
  ControlledDatabaseSchemaProperty
]);
export type SchemaProperty = z.TypeOf<typeof SchemaProperty>;

/**
 * Return a new schema property with default values.
 *
 * @param i Index of the property in the schema – used to generate a unique label.
 * @returns A new schema property with default values.
 */
export const defaultSchemaProperty = (i?: number): SchemaProperty => ({
  id: v4(),
  label: `Property ${i ?? ''}`,
  required: false,
  repeated: false,
  visible: true,
  type: SchemaPropertyType.FREE_TEXT
});

export enum CollectionType {
  ASSET_COLLECTION = 'ASSET_COLLECTION',
  CONTROLLED_DATABASE = 'CONTROLLED_DATABASE'
}

/**
 * Common interface for a collection in the archive.
 */
export const Collection = z.object({
  id: z.string(),
  title: z.string(),
  type: z.nativeEnum(CollectionType),
  schema: z.array(SchemaProperty)
});
export type Collection = z.TypeOf<typeof Collection>;

/**
 * Return the archive's root asset collection.
 */
export const GetRootAssetsCollection = RpcInterface({
  id: 'collection/assets',
  request: z.undefined(),
  response: Collection
});

/**
 * Return the archive's root controlled database collection.
 */
export const GetRootDatabaseCollection = RpcInterface({
  id: 'collection/databases',
  request: z.undefined(),
  response: Collection
});

/**
 * Get a collection by id.
 */
export const GetCollection = RpcInterface({
  id: 'collection',
  request: z.object({
    id: z.string()
  }),
  response: Collection,
  error: z.nativeEnum(FetchError)
});

/**
 * Return the subcollections of a collection.
 */
export const GetSubcollections = RpcInterface({
  id: 'collection/subcollections',
  request: z.object({
    parent: z.string()
  }),
  response: ResourceList(Collection)
});

/**
 * Return the subcollections of a collection.
 */
export const CreateCollection = RpcInterface({
  id: 'collection/create',
  request: z.object({
    parent: z.string(),
    title: z.string(),
    schema: z.array(SchemaProperty)
  }),
  response: Collection
});

/**
 * Updates a collection's properties.
 */
export const UpdateCollection = RpcInterface({
  id: 'collection/update',
  request: z.object({
    id: z.string(),
    title: z.string()
  }),
  response: Collection,
  error: z.nativeEnum(FetchError)
});

/**
 * Update the schema of a collection.
 */
export const UpdateCollectionSchema = RpcInterface({
  id: 'collection/schema/update',
  request: z.object({
    /** ID of the collection to update */
    collectionId: z.string(),
    /** New schema for the collection */
    value: z.array(SchemaProperty)
  }),
  response: z.object({}),
  error: z.nativeEnum(FetchError).or(AggregatedValidationError)
});

/**
 * List all assets in a collection.
 */
export const ListAssets = RpcInterface({
  id: 'assets/list',
  request: z.object({
    collectionId: z.string()
  }),
  response: ResourceList(Asset),
  error: z.nativeEnum(FetchError)
});

/**
 * Get an asset by id.
 */
export const GetAsset = RpcInterface({
  id: 'assets/get',
  request: z.object({
    id: z.string()
  }),
  response: Asset,
  error: z.nativeEnum(FetchError)
});

/**
 * Create a new asset.
 */
export const CreateAsset = RpcInterface({
  id: 'assets/create',
  request: z.object({
    collection: z.string(),
    metadata: z.record(z.array(z.unknown())),
    accessControl: z.nativeEnum(AccessControl)
  }),
  response: Asset,
  error: z.nativeEnum(FetchError)
});

/**
 * Search for an asset by part of its title.
 */
export const SearchAsset = RpcInterface({
  id: 'assets/search',
  request: z.object({
    collection: z.string(),
    query: z.string()
  }),
  response: ResourceList(Asset),
  error: z.nativeEnum(FetchError)
});

/**
 * Delete one or more assets.
 */
export const DeleteAssets = RpcInterface({
  id: 'assets/delete',
  request: z.object({
    assetIds: z.array(z.string())
  }),
  response: z.object({}),
  error: z.nativeEnum(FetchError).or(ReferentialIntegrityError)
});

/**
 * Validate moving one or more assets to another collection.
 */
export const ValidateMoveAssets = RpcInterface({
  id: 'assets/validate-move',
  request: z.object({
    assetIds: z.array(z.string()),
    targetCollectionId: z.string()
  }),
  response: z.object({}),
  error: z.nativeEnum(FetchError).or(AggregatedValidationError)
});

/**
 * Delete one or more assets.
 */
export const MoveAssets = RpcInterface({
  id: 'assets/move',
  request: z.object({
    assetIds: z.array(z.string()),
    targetCollectionId: z.string()
  }),
  response: z.object({}),
  error: z.nativeEnum(FetchError).or(ReferentialIntegrityError)
});

/**
 * Update the metadata for an asset.
 *
 * Performs a full update – missing keys are treated as setting the metadata value to null.
 */
export const UpdateAssetMetadata = RpcInterface({
  id: 'assets/update',
  request: z.object({
    assetId: z.string(),
    payload: z.record(z.array(z.unknown())).optional(),
    accessControl: z.nativeEnum(AccessControl).optional()
  }),
  response: z.object({}),
  error: z.nativeEnum(FetchError).or(SingleValidationError)
});
export type UpdateAssetMetadataRequest = RequestType<
  typeof UpdateAssetMetadata
>;
export type UpdateAssetError = ErrorType<typeof UpdateAssetMetadata>;

export const AddAssetMedia = RpcInterface({
  id: 'assets/media/add',
  request: z.object({
    assetId: z.string(),
    mediaFilePath: z.string()
  }),
  response: Media,
  error: z.nativeEnum(FetchError)
});

export const RemoveAssetMedia = RpcInterface({
  id: 'assets/media/remove',
  request: z.object({
    assetId: z.string(),
    mediaId: z.string()
  }),
  response: z.unknown(),
  error: z.nativeEnum(FetchError)
});
