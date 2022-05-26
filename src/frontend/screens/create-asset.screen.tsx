/** @jsxImportSource theme-ui */

import { mapValues } from 'lodash';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Flex, Text } from 'theme-ui';
import {
  AssetMetadata,
  CreateAsset,
  GetCollection
} from '../../common/asset.interfaces';
import { required } from '../../common/util/assert';
import { useGet, useRPC } from '../ipc/ipc.hooks';
import { MetadataInspector } from '../ui/components/inspector.component';
import { useErrorDisplay } from '../ui/hooks/error.hooks';
import { WindowDragArea } from '../ui/window';

export const CreateAssetScreen = () => {
  const [params] = useSearchParams();
  const errors = useErrorDisplay();
  const rpc = useRPC();

  const collectionId = required(
    params.get('collectionId'),
    'Missing collection id'
  );

  const [metadata, setMetadata] = useState<AssetMetadata>({});
  const collection = errors.guard(useGet(GetCollection, collectionId));

  const createAsset = useCallback(async () => {
    const ok = errors.guard(
      await rpc(CreateAsset, {
        collection: collectionId,
        metadata: mapValues(metadata, (md) => md.rawValue)
      })
    );

    if (ok) {
      window.close();
    }
  }, [collectionId, errors, metadata, rpc]);

  if (!collection) {
    return null;
  }

  return (
    <Flex sx={{ height: '100vh', width: '100%', flexDirection: 'column' }}>
      <WindowDragArea
        sx={{
          p: 4,
          borderBottom: 'primary',
          bg: 'gray1'
        }}
      >
        <Text
          sx={{
            fontSize: 2,
            fontWeight: 600
          }}
        >
          New Asset
        </Text>
      </WindowDragArea>

      <MetadataInspector
        sx={{ overflow: 'auto', flex: 1 }}
        hideRecordId
        isEditing
        collection={collection}
        asset={{
          id: 'new asset',
          media: [],
          metadata,
          title: 'New Asset'
        }}
        onEdit={setMetadata}
      />

      <Flex
        sx={{
          justifyContent: 'flex-end',
          flexDirection: 'row',
          p: 4
        }}
      >
        <span sx={{ ml: 4 }} />
        {<Button onClick={createAsset}>Create</Button>}
      </Flex>
    </Flex>
  );
};
