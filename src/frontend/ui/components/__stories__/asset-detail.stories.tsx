/** @jsxImportSource theme-ui */

import faker from '@faker-js/faker';
import { FC, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import {
  assetMetadata,
  someAsset,
  someMetadata
} from '../../../../app/asset/test-utils';
import {
  CollectionType,
  defaultSchemaProperty,
  GetCollection,
  SchemaProperty,
  SchemaPropertyType,
  UpdateAssetMetadata,
  UpdateAssetMetadataRequest
} from '../../../../common/asset.interfaces';
import { Media } from '../../../../common/media.interfaces';
import { never } from '../../../../common/util/assert';
import { compactDict } from '../../../../common/util/collection';
import { error, ok } from '../../../../common/util/error';
import { IpcContext } from '../../../ipc/ipc.hooks';
import { MockIpc } from '../../../ipc/mock-ipc';
import { AssetDetail } from '../asset-detail.component';

export default {
  title: 'Components/Asset Detail',
  argTypes: { onUpdate: { action: 'updated' } }
};

interface Params {
  onUpdate: (...args: unknown[]) => void;
}

export const WithMedia: FC<Params> = ({ onUpdate }) => {
  const [metadata, setMetadata] = useState(() => {
    faker.seed(1);
    return someMetadata(SCHEMA);
  });

  const ipc = useIpcFixture((change) => {
    setMetadata(assetMetadata(change.payload ?? {}));
    onUpdate(change);
  });

  return (
    <IpcContext.Provider value={{ ipc }}>
      <AssetDetail
        sx={{
          border: '1px solid black',
          height: '100vh',
          overflow: 'auto'
        }}
        asset={someAsset({ metadata, media: MEDIA_FILES })}
      />
    </IpcContext.Provider>
  );
};

const useIpcFixture = (
  onChange: (change: UpdateAssetMetadataRequest) => void
) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  return useMemo(() => {
    const ipc = new MockIpc();
    ipc.handle({
      type: UpdateAssetMetadata,
      result: async (params) => {
        const result = Validator.safeParse(params.payload);
        if (!result.success) {
          return error(compactDict(result.error.formErrors.fieldErrors));
        }

        onChangeRef.current(params);
        return ok();
      }
    });
    ipc.handle({
      type: GetCollection,
      result: async (params) => {
        return ok({
          id: params.id,
          title: 'Some Collection',
          type: CollectionType.CONTROLLED_DATABASE,
          schema: [{ type: SchemaPropertyType.FREE_TEXT, required: false }]
        });
      }
    });
    return ipc;
  }, []);
};

const MEDIA_FILES: Media[] = [
  {
    id: '1',
    type: 'image',
    mimeType: 'image/png',
    rendition: require('./media/a.png'),
    fileSize: 100
  },
  {
    id: '2',
    type: 'image',
    mimeType: 'image/jpeg',
    rendition: require('./media/b.jpg'),
    fileSize: 100
  }
];

const SCHEMA: SchemaProperty[] = [
  {
    ...defaultSchemaProperty(),
    id: 'someProperty',
    label: 'Some Property',
    required: true,
    repeated: false,
    type: SchemaPropertyType.FREE_TEXT
  },
  {
    ...defaultSchemaProperty(),
    id: 'databaseRef',
    label: 'Database Reference',
    required: false,
    repeated: false,
    type: SchemaPropertyType.CONTROLLED_DATABASE,
    databaseId: 'testDb'
  }
];

const Validator = z.object(
  Object.fromEntries(
    SCHEMA.map((property) => {
      let validator;

      if (property.type === SchemaPropertyType.FREE_TEXT) {
        validator = z.string().nonempty();
      } else if (property.type === SchemaPropertyType.CONTROLLED_DATABASE) {
        validator = z.string().nonempty();
      } else {
        return never(property);
      }

      return [
        property.id,
        property.required
          ? z.array(validator).min(1)
          : z.array(validator).optional()
      ];
    })
  )
);
