/** @jsxImportSource theme-ui */

import { mapValues } from 'lodash';
import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Flex, Text } from 'theme-ui';
import {
  AccessControl,
  CreateAsset,
  GetCollection
} from '../../common/asset.interfaces';
import { required } from '../../common/util/assert';
import { useGet, useRPC } from '../ipc/ipc.hooks';
import {
  MetadataInspector,
  MetadataInspectorData
} from '../ui/components/inspector.component';
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

  const [props, setProps] = useState<MetadataInspectorData>({
    metadata: {},
    accessControl: AccessControl.RESTRICTED
  });
  const collection = errors.guard(useGet(GetCollection, collectionId));

  const createAsset = useCallback(async () => {
    const ok = errors.guard(
      await rpc(CreateAsset, {
        collection: collectionId,
        metadata: mapValues(props.metadata, (md) => md.rawValue),
        redactedProperties: [],
        accessControl: props.accessControl ?? AccessControl.RESTRICTED
      })
    );

    if (ok) {
      window.close();
    }
  }, [collectionId, errors, props, rpc]);

  if (!collection) {
    return null;
  }

  return (
    <Flex sx={{ height: '100vh', width: '100%', flexDirection: 'column' }}>
      <WindowDragArea
        sx={{
          p: 4,
          borderBottom: 'primary'
        }}
      >
        <Text
          sx={{
            fontSize: 2,
            fontWeight: 600,
            fontFamily: 'body'
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
          metadata: {},
          accessControl: AccessControl.RESTRICTED,
          redactedProperties: [],
          title: 'New Asset',
          collectionId: collection.id
        }}
        edits={props}
        onEdit={setProps}
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
