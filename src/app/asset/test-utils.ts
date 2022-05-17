import faker from '@faker-js/faker';
import { mapValues, times } from 'lodash';
import {
  Asset,
  AssetMetadata,
  AssetMetadataItem,
  SchemaProperty,
  SchemaPropertyType
} from '../../common/asset.interfaces';
import { never } from '../../common/util/assert';
import { Dict } from '../../common/util/types';

export const someAsset = (props: Partial<Asset> = {}): Asset => ({
  id: faker.datatype.uuid(),
  media: [],
  metadata: {},
  title: faker.word.noun(),
  ...props
});

export const someSchemaProperty = (
  props: Partial<SchemaProperty> = {}
): SchemaProperty => {
  const base = {
    id: faker.datatype.uuid(),
    label: faker.word.noun(),
    required: false,
    repeated: false
  };

  if (!props.type || props.type === SchemaPropertyType.FREE_TEXT) {
    return {
      ...base,
      ...props,
      type: SchemaPropertyType.FREE_TEXT
    };
  }

  if (props.type === SchemaPropertyType.CONTROLLED_DATABASE) {
    return {
      databaseId: faker.datatype.uuid(),
      ...base,
      ...props,
      type: SchemaPropertyType.CONTROLLED_DATABASE
    };
  }

  return never(props.type);
};

export const somePropertyFromASchema = (
  schema: SchemaProperty
): AssetMetadataItem => {
  if (schema.repeated) {
    return assetMetadataItem(
      times(
        3,
        () => somePropertyFromASchema({ ...schema, repeated: false }).rawValue
      ).flat()
    );
  }

  if (schema.type === SchemaPropertyType.FREE_TEXT) {
    const val = faker.lorem.words(10);
    return {
      rawValue: [val],
      presentationValue: [{ rawValue: val, label: val }]
    };
  }

  if (schema.type === SchemaPropertyType.CONTROLLED_DATABASE) {
    const val = faker.datatype.uuid();

    return {
      rawValue: [val],
      presentationValue: [{ label: faker.word.noun(), rawValue: val }]
    };
  }

  return never(schema);
};

export const someMetadata = (schema: SchemaProperty[]): AssetMetadata =>
  Object.fromEntries(
    schema.map((property) => [property.id, somePropertyFromASchema(property)])
  );

export const assetMetadata = (rawValues: Dict<unknown[]>): AssetMetadata =>
  mapValues(rawValues, assetMetadataItem);

export const assetMetadataItem = (rawValue: unknown[]): AssetMetadataItem => ({
  rawValue,
  presentationValue: rawValue.map((val) => ({
    rawValue: val,
    label: String(val)
  }))
});

export const assetMetadataItemMatcher = (
  rawValue: unknown[]
): AssetMetadataItem => ({
  rawValue,
  presentationValue: rawValue.map((val) =>
    expect.objectContaining({
      rawValue: val
    })
  )
});
