/** @jsxImportSource theme-ui */

import { FC, useCallback, useMemo, useState } from 'react';
import { CardList, Collection } from 'react-bootstrap-icons';
import { Box, BoxProps, Button, Flex, Grid, Image } from 'theme-ui';
import {
  Asset,
  SchemaProperty,
  UpdateAssetMetadata
} from '../../../common/asset.interfaces';
import { Dict } from '../../../common/util/types';
import { useRPC } from '../../ipc/ipc.hooks';
import { TabBar, TabBarButton } from './atoms.component';
import { SchemaField } from './schema-form.component';

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
  const media = asset.media;
  const [tabId, setTabId] = useState(initialTab);
  const [edits, setEdits] = useState<Dict>();
  const rpc = useRPC();
  const isEditing = !!edits;
  const metadata = useMemo(
    () => ({ ...asset.metadata, ...edits }),
    [asset.metadata, edits]
  );

  const handleStartEditing = useCallback(() => {
    setTabId('Metadata');
    setEdits({});
  }, []);

  const handleCommitEditing = useCallback(async () => {
    setTabId('Metadata');
    await rpc(UpdateAssetMetadata, { assetId: asset.id, payload: metadata });
    setEdits(undefined);
  }, [asset.id, metadata, rpc]);

  const handleCancelEditing = useCallback(() => {
    setEdits(undefined);
  }, []);

  return (
    <Flex
      sx={{
        flexDirection: 'column'
      }}
      {...props}
    >
      <TabBar tabId={tabId} onTabChange={setTabId}>
        <TabBarButton label="Media" icon={Collection}>
          <Flex
            sx={{
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              flex: 1,
              p: 3
            }}
          >
            {media.map((item) => (
              <Image
                sx={{ '&:not(:first-of-type)': { mt: 3 } }}
                key={item.id}
                src={item.rendition}
              />
            ))}
          </Flex>
        </TabBarButton>

        <TabBarButton label="Metadata" icon={CardList}>
          <Grid sx={{ gap: 4, alignItems: 'start', p: 3 }}>
            {schema.map((property) => (
              <SchemaField
                key={property.id}
                property={property}
                editing={isEditing}
                value={metadata[property.id]}
                onChange={(change) =>
                  setEdits((edits) => ({ ...edits, [property.id]: change }))
                }
              />
            ))}
          </Grid>

          <span sx={{ flex: 1 }} />
        </TabBarButton>
      </TabBar>

      <Flex
        sx={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          borderTop: 'primary',
          p: 3,
          '> *': {
            marginInlineStart: 5
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
