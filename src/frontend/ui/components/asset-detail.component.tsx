/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo, useState } from 'react';
import { CardList, Collection as CollectionIcon } from 'react-bootstrap-icons';
import {
  Box,
  BoxProps,
  Button,
  Flex,
  Grid,
  Image,
  Label,
  Text
} from 'theme-ui';
import {
  Asset,
  Collection,
  CollectionType,
  CreateAsset,
  SchemaProperty,
  SingleValidationError,
  UpdateAssetMetadata
} from '../../../common/asset.interfaces';
import { UpdateIngestedMetadata } from '../../../common/ingest.interfaces';
import { FetchError } from '../../../common/util/error';
import { Dict } from '../../../common/util/types';
import { useRPC } from '../../ipc/ipc.hooks';
import { useErrorDisplay } from '../hooks/error.hooks';
import { Tabs, IconTab, ValidationError } from './atoms.component';
import { SchemaField } from './schema-form.component';

interface MediaDetailProps extends BoxProps {
  /** Asset to render details of */
  asset: Asset;

  /** Collection containing the asset */
  collection: Collection;

  /** Initial tab to display. One of the labels of the detail tabs */
  initialTab?: string;

  /** Action to be performed on submit */
  action?: 'create' | 'update' | 'import';

  errors?: SingleValidationError;

  onCancelCreate?: () => void;

  sessionId?: string;

  onCreate?: (asset: Asset) => void;
}

/**
 * Panel displayed when an asset is selected in a collection view and we want to show the its media and metadata in a side-area.
 */
export const AssetDetail: FC<MediaDetailProps> = ({
  asset,
  collection,
  action = 'update',
  initialTab,
  onCancelCreate,
  sessionId,
  errors: additionalErrors,
  onCreate,
  ...props
}) => {
  const showMedia =
    collection.type === CollectionType.ASSET_COLLECTION && action === 'update';
  const [tabId, setTabId] = useState(
    initialTab || (showMedia && 'Media') || undefined
  );
  const [edits, setEdits] = useState<Dict | undefined>(
    action === 'create' ? {} : undefined
  );
  const rpc = useRPC();
  const isEditing = !!edits;
  const metadata = useMemo(
    () => ({ ...asset.metadata, ...edits }),
    [asset.metadata, edits]
  );
  const displayError = useErrorDisplay();
  const [editErrors, setEditErrors] = useState<SingleValidationError>();

  /** Begin an edit session */
  const handleStartEditing = useCallback(() => {
    setTabId('Metadata');
    setEdits({});
    setEditErrors(undefined);
  }, []);

  /** Attempt to commit editing of the asset */
  const updateAsset = useCallback(async () => {
    const res = await rpc(UpdateAssetMetadata, {
      assetId: asset.id,
      payload: metadata
    });
    if (res.status === 'error') {
      if (res.error === FetchError.DOES_NOT_EXIST) {
        return displayError(
          `Something unexpected happened. We weren't able to update this record.`
        );
      }

      setEditErrors(res.error);
    } else {
      setEdits(undefined);
    }
  }, [asset.id, displayError, metadata, rpc]);

  /** Create the asset */
  const createAsset = useCallback(async () => {
    const res = await rpc(CreateAsset, {
      collection: collection.id,
      metadata
    });

    if (res.status === 'error') {
      if (res.error === FetchError.DOES_NOT_EXIST) {
        return displayError(
          `Something unexpected happened. We weren't able to update this record.`
        );
      }

      setEditErrors(res.error);
    } else {
      setEdits(undefined);
      setEditErrors(undefined);
    }
  }, [collection.id, displayError, metadata, rpc]);

  /** Update the metadata for an imported asset */
  const updateIngestedAsset = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    const res = await rpc(UpdateIngestedMetadata, {
      assetId: asset.id,
      metadata,
      sessionId
    });

    if (res.status === 'error') {
      if (res.error === FetchError.DOES_NOT_EXIST) {
        return displayError(
          `Something unexpected happened. We weren't able to update this record.`
        );
      }

      setEditErrors(res.error);
    } else {
      setEdits(undefined);
      setEditErrors(undefined);
    }
  }, [asset.id, displayError, metadata, rpc, sessionId]);

  const handleCancelEditing = useCallback(() => {
    setEdits(undefined);
    setEditErrors(undefined);

    if (action === 'create') {
      onCancelCreate?.();
    }
  }, [action, onCancelCreate]);

  const handleSave =
    action === 'create'
      ? createAsset
      : action === 'import'
      ? updateIngestedAsset
      : updateAsset;

  const assetErrors = (editErrors || additionalErrors) && {
    ...additionalErrors,
    ...editErrors
  };

  return (
    <Flex
      sx={{
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0
      }}
      {...props}
    >
      <Tabs currentTab={tabId} onTabChange={setTabId}>
        {/* Media Panel */}
        {showMedia && (
          <IconTab label="Media" icon={CollectionIcon}>
            <Flex
              sx={{
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'auto',
                flex: 1,
                flexBasis: 0,
                p: 3
              }}
            >
              {asset.media.map((item) => (
                <Image
                  sx={{ '&:not(:first-of-type)': { mt: 3 } }}
                  key={item.id}
                  src={item.rendition}
                />
              ))}
            </Flex>
          </IconTab>
        )}

        {/* Metadata Panel */}
        <IconTab label="Metadata" icon={CardList}>
          <Box sx={{ overflow: 'auto', flex: 1 }}>
            <Grid
              gap={4}
              repeat="fit"
              sx={{
                p: 3
              }}
            >
              {action === 'update' && (
                <Box>
                  <Label>Record ID</Label>
                  <Text sx={{ userSelect: 'all' }}>{asset.id}</Text>
                </Box>
              )}

              {collection.schema.map((property) => (
                <Box key={property.id}>
                  <SchemaField
                    property={property}
                    editing={isEditing}
                    value={metadata[property.id]}
                    onChange={(change) =>
                      setEdits((edits) => ({ ...edits, [property.id]: change }))
                    }
                  />

                  {assetErrors?.[property.id] && (
                    <ValidationError errors={assetErrors?.[property.id]} />
                  )}
                </Box>
              ))}
            </Grid>
          </Box>
        </IconTab>
      </Tabs>

      {/* Save / edit controls */}
      <Flex
        sx={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          borderTop: 'primary',
          p: 3
        }}
      >
        {isEditing && (
          <>
            <Button
              sx={{ mr: 5 }}
              variant="primaryTransparent"
              onClick={handleCancelEditing}
            >
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {action === 'create' ? 'Create' : 'Save Changes'}
            </Button>
          </>
        )}
        {!isEditing && (
          <Button onClick={handleStartEditing}>Edit Metadata</Button>
        )}
      </Flex>
    </Flex>
  );
};
