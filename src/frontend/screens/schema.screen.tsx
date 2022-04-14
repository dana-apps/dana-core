/** @jsxImportSource theme-ui */

import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from 'theme-ui';
import {
  AggregatedValidationError,
  defaultSchemaProperty,
  GetCollection,
  SchemaProperty,
  UpdateCollectionSchema
} from '../../common/asset.interfaces';
import { required } from '../../common/util/assert';
import { FetchError } from '../../common/util/error';
import { useGet, useRPC } from '../ipc/ipc.hooks';
import { BottomBar } from '../ui/components/page-layouts.component';
import { SchemaEditor } from '../ui/components/schema-editor.component';
import { useErrorDisplay } from '../ui/hooks/error.hooks';

/**
 * Screen for editing the schema for a collection.
 *
 * Currently we only support editing the root collection, but could be easily made more generic.
 */
export const SchemaScreen = () => {
  const collectionId = required(
    useParams().collectionId,
    'Expected collectionId param'
  );

  const collection = useGet(GetCollection, collectionId);
  const displayError = useErrorDisplay();
  const navigate = useNavigate();
  const [state, setState] = useState<SchemaProperty[]>();
  const rpc = useRPC();
  const [hasEdits, setHasEdits] = useState(false);
  const [errors, setErrors] = useState<AggregatedValidationError>();

  const save = useCallback(async () => {
    if (collection && collection.status === 'ok') {
      const res = await rpc(UpdateCollectionSchema, {
        collectionId: collection.value.id,
        value: state
      });

      if (res.status === 'ok') {
        setHasEdits(false);
        setErrors(undefined);
        navigate(-1);
        return;
      }

      if (res.error == FetchError.DOES_NOT_EXIST) {
        return displayError(
          `Something unexpected happened. We weren't able to update the schema.`
        );
      }

      setErrors(res.error);
    }
  }, [collection, displayError, navigate, rpc, state]);

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
        errors={errors}
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
