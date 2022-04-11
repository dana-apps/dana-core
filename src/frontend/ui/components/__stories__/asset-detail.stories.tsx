/** @jsxImportSource theme-ui */

import faker from '@faker-js/faker';
import { FC, useMemo, useRef, useState } from 'react';
import {
  SchemaProperty,
  SchemaPropertyType,
  UpdateAssetMetadata,
  UpdateAssetMetadataRequest
} from '../../../../common/asset.interfaces';
import { Media } from '../../../../common/media.interfaces';
import { ok } from '../../../../common/util/error';
import { Dict } from '../../../../common/util/types';
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

export const NarrowWithMedia: FC<Params> = ({ onUpdate }) => {
  const [metadata, setMetadata] = useState<Dict>(() => {
    faker.seed(1);
    return {
      someProperty: faker.lorem.words(3)
    };
  });

  const ipc = useIpcFixture((change) => {
    setMetadata(change.payload);
    onUpdate(change);
  });

  return (
    <IpcContext.Provider value={{ ipc }}>
      <AssetDetail
        sx={{
          width: 300,
          border: '1px solid black',
          height: '100vh',
          overflow: 'auto'
        }}
        asset={{
          id: faker.datatype.uuid(),
          media: MEDIA_FILES,
          metadata: metadata
        }}
        schema={testSchema}
        initialTab="Metadata"
      />
    </IpcContext.Provider>
  );
};

const testSchema: SchemaProperty[] = [
  {
    id: 'someProperty',
    label: 'Some Property',
    required: false,
    type: SchemaPropertyType.FREE_TEXT
  },
  {
    id: 'someOtherProperty',
    label: 'Some Other Property',
    required: false,
    type: SchemaPropertyType.FREE_TEXT
  }
];

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
        onChangeRef.current(params);
        return ok();
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
    rendition: require('./media/a.png')
  },
  {
    id: '2',
    type: 'image',
    mimeType: 'image/jpeg',
    rendition: require('./media/b.jpg')
  }
];
