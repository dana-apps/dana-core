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
      {/*
        This intermediary div is required due to an absolutely baffling css bug.

        If we set `overflow-y: auto` on the child element, any update to the DOM while the child is scrolled on the Y
        axis causes the _parent_ of this component to be repositioned to a Y value inversely proportional to the scroll
        offset.

        In practice, this means that if a switch is toggled while the editor is scrolled, the contents of the editor
        disappear.

        For reasons that I don't fully understand, this doesn't happen when the scroll contents are wrapped in a div.

        This is likely a bug a flexbox/overflow bug in chromium (as of v100), so it may be possible to remove the
        intermediary div if/when it is fixed.
      */}
      <div
        sx={{ overflowY: 'auto', flex: 1, width: '100%', position: 'relative' }}
      >
        <SchemaEditor
          sx={{ width: '100%' }}
          value={state}
          errors={errors}
          onChange={(change) => {
            setHasEdits(true);
            setState(change);
          }}
        />
      </div>
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
