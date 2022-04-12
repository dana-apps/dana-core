/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo, useState } from 'react';
import { CardList, Collection } from 'react-bootstrap-icons';
import { Box, BoxProps, Button, Flex, Grid, Image } from 'theme-ui';
import {
  Asset,
  SchemaProperty,
  UpdateAssetMetadata,
  ValidationError
} from '../../../common/asset.interfaces';
import { FetchError } from '../../../common/util/error';
import { Dict } from '../../../common/util/types';
import { useRPC } from '../../ipc/ipc.hooks';
import { useErrorDisplay } from '../hooks/error.hooks';
import { Tabs, IconTab } from './atoms.component';
import { SchemaError, SchemaField } from './schema-form.component';

interface MediaDetailProps extends BoxProps {
  /** Asset to render details of */
  asset: Asset;

  /** Schema of the collection containing the asset */
  schema: SchemaProperty[];

  /** Initial tab to display. One of the labels of the detail tabs */
  initialTab?: string;
}

/**
 * Panel displayed when an asset is selected in a collection view and we want to show the its media and metadata in a side-area.
 */
export const AssetDetail: FC<MediaDetailProps> = ({
  asset,
  initialTab,
  schema,
  ...props
}) => {
  const [tabId, setTabId] = useState(initialTab);
  const [edits, setEdits] = useState<Dict>();
  const rpc = useRPC();
  const isEditing = !!edits;
  const metadata = useMemo(
    () => ({ ...asset.metadata, ...edits }),
    [asset.metadata, edits]
  );
  const displayError = useErrorDisplay();
  const [editErrors, setEditErrors] = useState<ValidationError>();

  /** Begin an edit session */
  const handleStartEditing = useCallback(() => {
    setTabId('Metadata');
    setEdits({});
    setEditErrors(undefined);
  }, []);

  /** Attempt to  */
  const handleCommitEditing = useCallback(async () => {
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

  const handleCancelEditing = useCallback(() => {
    setEdits(undefined);
    setEditErrors(undefined);
  }, []);

  return (
    <Flex
      sx={{
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      {...props}
    >
      <Tabs currentTab={tabId} onTabChange={setTabId}>
        {/* Media Panel */}
        <IconTab label="Media" icon={Collection}>
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

        {/* Metadata Panel */}
        <IconTab label="Metadata" icon={CardList}>
          <Grid
            sx={{
              gap: 4,
              alignItems: 'start',
              overflow: 'auto',
              flexBasis: 0,
              flex: 1,
              p: 3
            }}
          >
            {schema.map((property) => (
              <Box key={property.id}>
                <SchemaField
                  property={property}
                  editing={isEditing}
                  value={metadata[property.id]}
                  onChange={(change) =>
                    setEdits((edits) => ({ ...edits, [property.id]: change }))
                  }
                />

                {editErrors?.[property.id] && (
                  <SchemaError errors={editErrors?.[property.id]} />
                )}
              </Box>
            ))}
          </Grid>

          <span sx={{ flex: 1 }} />
        </IconTab>
      </Tabs>

      {/* Save / edit controls */}
      <Flex
        sx={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          borderTop: 'primary',
          p: 3,
          '> *': {
            ml: 5
          }
        }}
      >
        {isEditing && (
          <>
            <Button variant="primaryTransparent" onClick={handleCancelEditing}>
              Cancel
            </Button>
            <Button onClick={handleCommitEditing}>Save Changes</Button>
          </>
        )}
        {!isEditing && (
          <Button onClick={handleStartEditing}>Edit Metadata</Button>
        )}
      </Flex>
    </Flex>
  );
};
