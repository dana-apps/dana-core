/** @jsxImportSource theme-ui */

import { useCallback, useEffect, useState } from 'react';
import { Button } from 'theme-ui';
import {
  defaultSchemaProperty,
  GetRootCollection,
  SchemaProperty,
  UpdateCollectionSchema
} from '../../common/asset.interfaces';
import { useGet, useRPC } from '../ipc/ipc.hooks';
import { BottomBar } from '../ui/components/page-layouts.component';
import { SchemaEditor } from '../ui/components/schema-editor.component';

/**
 * Screen for editing the schema for a collection.
 *
 * Currently we only support editing the root collection, but could be easily made more generic.
 */
export const SchemaScreen = () => {
  const collection = useGet(GetRootCollection);
  const [state, setState] = useState<SchemaProperty[]>();
  const rpc = useRPC();
  const [hasEdits, setHasEdits] = useState(false);

  const save = useCallback(async () => {
    if (collection && collection.status === 'ok') {
      await rpc(UpdateCollectionSchema, {
        collectionId: collection.value.id,
        value: state
      });
      setHasEdits(false);
    }
  }, [collection, rpc, state]);

  useEffect(() => {
    if (collection && collection.status === 'ok') {
      setState((prev) => prev ?? collection.value.schema);
    }
  }, [collection]);

  if (!state) {
    return null;
  }

  return (
    <>
      <SchemaEditor
        sx={{ flex: 1, overflowY: 'auto', width: '100%' }}
        value={state}
        onChange={(change) => {
          setHasEdits(true);
          setState(change);
        }}
      />
      <BottomBar
        actions={
          <>
            <Button
              onClick={() => {
                setHasEdits(true);
                setState((schema) => [
                  ...(schema ?? []),
                  defaultSchemaProperty((schema?.length ?? 0) + 1)
                ]);
              }}
              variant="primaryTransparent"
            >
              Add Property
            </Button>
            <Button disabled={!hasEdits} onClick={save}>
              Save Changes
            </Button>
          </>
        }
      />
    </>
  );
};
