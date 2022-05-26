/** @jsxImportSource theme-ui */

import { FC } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Box, BoxProps, Image } from 'theme-ui';
import {
  Asset,
  AssetMetadata,
  Collection,
  SingleValidationError
} from '../../../common/asset.interfaces';
import { RecordInspector } from './inspector.component';
import { PrimaryDetailLayout } from './page-layouts.component';

interface AssetDetailProps extends BoxProps {
  /** Asset to render details of */
  asset: Asset;

  /** Collection containing the asset */
  collection: Collection;

  /** Single validation  */
  errors?: SingleValidationError;

  /** Collection containing the asset */
  onCommitEdits: (
    metadata: AssetMetadata
  ) => Promise<undefined | SingleValidationError>;
}

/**
 * Panel displayed when an asset is selected in a collection view and we want to show the its media and metadata in a side-area.
 */
export const AssetDetail: FC<AssetDetailProps> = ({
  asset,
  collection,
  onCommitEdits,
  errors,
  ...props
}) => {
  const inspector = (
    <RecordInspector
      asset={asset}
      collection={collection}
      errors={errors}
      onCommitEdits={onCommitEdits}
    />
  );

  return (
    <PrimaryDetailLayout sx={{}} detail={inspector} {...props}>
      <AutoSizer>
        {({ height, width }) => (
          <Box
            style={{ height, width }}
            sx={{
              willChange: 'height width',
              flexDirection: 'row',
              overflowX: 'auto',
              overflowY: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            {asset.media.map((file) => (
              <Box
                key={file.id}
                style={{
                  height,
                  maxWidth: asset.media.length > 1 ? width * 0.75 : '100%'
                }}
                sx={{
                  verticalAlign: 'top',
                  display: 'inline-flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  willChange: 'width height',
                  minWidth: '400px',
                  p: 4
                }}
              >
                <Image
                  sx={{
                    flexShrink: 0,
                    objectFit: 'contain'
                  }}
                  src={file.rendition}
                />
              </Box>
            ))}
          </Box>
        )}
      </AutoSizer>
    </PrimaryDetailLayout>
  );
};
