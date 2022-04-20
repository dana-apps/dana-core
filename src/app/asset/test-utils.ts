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

export const somePropertyFromASchema = (
  schema: SchemaProperty
): AssetMetadataItem => {
  if (schema.repeated) {
    return {
      rawValue: times(
        3,
        () => somePropertyFromASchema({ ...schema, repeated: false }).rawValue
      ).flat()
    };
  }

  if (schema.type === SchemaPropertyType.FREE_TEXT) {
    return {
      rawValue: [faker.lorem.words(10)]
    };
  }

  if (schema.type === SchemaPropertyType.CONTROLLED_DATABASE) {
    return {
      rawValue: [faker.datatype.uuid()]
    };
  }

  return never(schema);
};

export const someMetadata = (schema: SchemaProperty[]): AssetMetadata =>
  Object.fromEntries(
    schema.map((property) => [property.id, somePropertyFromASchema(property)])
  );

export const assetMetadataFromRawValues = (
  rawValues: Dict<unknown[]>
): AssetMetadata => mapValues(rawValues, (rawValue) => ({ rawValue }));
