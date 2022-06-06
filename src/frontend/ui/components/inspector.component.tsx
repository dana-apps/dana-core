/** @jsxImportSource theme-ui */

import { FC, useCallback, useState } from 'react';
import { Plus, X } from 'react-bootstrap-icons';
import {
  Label,
  Grid,
  Box,
  Text,
  Flex,
  Image,
  BoxProps,
  IconButton,
  Button
} from 'theme-ui';
import {
  Asset,
  AssetMetadata,
  Collection,
  CollectionType,
  SingleValidationError
} from '../../../common/asset.interfaces';
import { Media } from '../../../common/media.interfaces';
import { useMediaFiles } from '../hooks/media.hooks';
import { ValidationError } from './atoms.component';
import { SchemaField } from './schema-form.component';

interface RecordInspectorProps extends BoxProps {
  /** Asset to render details of */
  asset: Asset;

  /** Collection containing the asset */
  collection: Collection;

  /** Any validation errors to display in additional to failed edits */
  errors?: SingleValidationError;

  /** Don't show the record id of the asset */
  hideRecordId?: boolean;

  /** If true, allow media files to be added and removed */
  editMedia?: boolean;

  /** Commit */
  onCommitEdits: (
    metadata: AssetMetadata
  ) => Promise<SingleValidationError | undefined>;
}

/**
 * Panel displayed when an asset is selected in a collection view and we want to show the its media and metadata in a side-area.
 */
export const RecordInspector: FC<RecordInspectorProps> = ({
  asset,
  collection,
  hideRecordId,
  onCommitEdits,
  editMedia,
  errors,
  ...props
}) => {
  const mediaFiles = useMediaFiles();

  const showMedia = collection.type === CollectionType.ASSET_COLLECTION;
  const [edits, setEdits] = useState<AssetMetadata>();
  const [editErrors, setEditErrors] = useState<SingleValidationError>();

  /** Begin an edit session */
  const handleStartEditing = useCallback(() => {
    setEdits({});
    setEditErrors(undefined);
  }, []);

  /** Attempt to commit editing of the asset */
  const handleCommitEditing = useCallback(async () => {
    if (!edits) {
      return;
    }

    const validationErrors = await onCommitEdits(edits);
    setEditErrors(validationErrors);

    if (!validationErrors) {
      setEdits(undefined);
    }
  }, [edits, onCommitEdits]);

  const handleCancelEditing = useCallback(() => {
    setEdits(undefined);
    setEditErrors(undefined);
  }, []);

  const handleAddFile = useCallback(() => {
    mediaFiles.addFile(asset.id);
  }, [asset.id, mediaFiles]);

  const handleRemoveFile = useCallback(
    (file: Media) => {
      mediaFiles.removeFile(asset.id, file.id);
    },
    [asset.id, mediaFiles]
  );

  const assetErrors = (editErrors || errors) && {
    ...errors,
    ...editErrors
  };

  return (
    <Box sx={{ bg: 'gray1', height: '100%', overflowY: 'auto' }} {...props}>
      {showMedia && (
        <AssetFilesList
          onAddFile={editMedia ? handleAddFile : undefined}
          onDeleteFile={editMedia ? handleRemoveFile : undefined}
          asset={asset}
        />
      )}
      <MetadataInspector
        asset={asset}
        collection={collection}
        errors={assetErrors}
        isEditing={!!edits}
        edits={edits}
        onEdit={setEdits}
        hideRecordId={hideRecordId}
        onStartEditing={handleStartEditing}
        onCancelEdits={handleCancelEditing}
        onCommitEdits={handleCommitEditing}
      />
    </Box>
  );
};

interface MetadataInspectorProps extends BoxProps {
  asset: Asset;
  collection: Collection;
  isEditing?: boolean;
  edits?: AssetMetadata;
  errors?: Record<string, string[]>;
  hideRecordId?: boolean;
  onStartEditing?: () => void;
  onCommitEdits?: () => void;
  onCancelEdits?: () => void;
  onEdit?: (updated: (prev?: AssetMetadata) => AssetMetadata) => void;
}

export const MetadataInspector: FC<MetadataInspectorProps> = ({
  asset,
  collection,
  isEditing = false,
  edits,
  onEdit,
  hideRecordId,
  onStartEditing,
  onCommitEdits,
  onCancelEdits,
  errors,
  ...props
}) => {
  const metadata = { ...asset.metadata, ...edits };

  return (
    <Box {...props}>
      <Flex
        sx={{
          p: 4,
          py: 3,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          bg: 'gray1'
        }}
      >
        <Label sx={{ width: 'auto', pt: 1 }}>Metadata</Label>

        {onStartEditing && !isEditing && (
          <Button
            sx={{ fontSize: 1, p: 0 }}
            variant="primaryTransparent"
            onClick={onStartEditing}
          >
            Edit
          </Button>
        )}
      </Flex>

      <Box
        sx={{
          p: 4,
          pb: 5,
          bg: 'background',
          '> :not(:last-child)': { mb: 5 }
        }}
      >
        {!hideRecordId && (
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
                onEdit?.((edits) => ({ ...edits, [property.id]: change }))
              }
            />

            {errors?.[property.id] && (
              <ValidationError errors={errors?.[property.id]} />
            )}
          </Box>
        ))}

        {isEditing && onCommitEdits && (
          <Flex
            sx={{
              justifyContent: 'flex-end',
              flexDirection: 'row'
            }}
          >
            {onCancelEdits && (
              <Button onClick={onCancelEdits} variant="primaryTransparent">
                Cancel
              </Button>
            )}

            <span sx={{ ml: 4 }} />
            {<Button onClick={onCommitEdits}>Save</Button>}
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export interface MediaFileListProps extends BoxProps {
  asset: Asset;
  onDeleteFile?: (file: Media) => void;
  onAddFile?: () => void;
}

export const AssetFilesList: FC<MediaFileListProps> = ({
  asset,
  onDeleteFile,
  onAddFile,
  ...props
}) => {
  return (
    <Box {...props}>
      <Flex
        sx={{
          bg: 'gray1',
          p: 4,
          py: 3,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderTop: 'light'
        }}
      >
        <Label sx={{ width: 'auto', pt: 1 }}>Media Files</Label>

        {onAddFile && (
          <Button
            onClick={onAddFile}
            sx={{ fontSize: 1, p: 0 }}
            variant="primaryTransparent"
          >
            <Plus sx={{ pb: 1 }} size={18} />
            Add Media
          </Button>
        )}
      </Flex>

      {asset.media.map((file) => (
        <Flex
          sx={{
            '&:last-child': { borderBottom: 'light' },
            borderTop: 'light',
            flexDirection: 'row',
            p: 4,
            bg: 'background'
          }}
          key={file.id}
        >
          <Image
            key={file.rendition}
            src={file.rendition}
            sx={{ objectFit: 'contain', maxHeight: 80, width: 80 }}
          />
          <Box
            sx={{
              flex: 1,
              pl: 3,
              fontSize: 1
            }}
          >
            <div sx={{ pb: 2 }}>{fileType(file.mimeType)}</div>
            <div>{megabytes(file.fileSize)}MB</div>
          </Box>

          {onDeleteFile && (
            <IconButton
              onClick={() => onDeleteFile(file)}
              sx={{ width: 18, height: 18, p: 0 }}
            >
              <X size={18} />
            </IconButton>
          )}
        </Flex>
      ))}
    </Box>
  );
};

const megabytes = (bytes: number, precision = 2) => {
  const mb = bytes / 1024 / 1024;
  const factor = 10 ** precision;

  return Math.floor(mb * factor) / factor;
};

const fileType = (mime: string) => {
  const [category, format] = mime.split('/');
  return `${format.toUpperCase()} ${category}`;
};
