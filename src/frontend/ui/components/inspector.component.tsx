/** @jsxImportSource theme-ui */

import { FC, useCallback, useState } from 'react';
import { PencilFill, Plus, X } from 'react-bootstrap-icons';
import {
  Label,
  Box,
  Text,
  Flex,
  Image,
  BoxProps,
  IconButton,
  Button,
  Select
} from 'theme-ui';
import {
  AccessControl,
  Asset,
  AssetMetadata,
  Collection,
  CollectionType,
  getAccessControlLabel,
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
    metadata: MetadataInspectorData
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
  const [edits, setEdits] = useState<MetadataInspectorData>();
  const [editErrors, setEditErrors] = useState<SingleValidationError>();

  /** Begin an edit session */
  const handleStartEditing = useCallback(() => {
    setEdits({
      metadata: {}
    });
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
    <Box sx={{ height: '100%', overflowY: 'auto' }} {...props}>
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
  edits?: MetadataInspectorData;
  errors?: Record<string, string[]>;
  hideRecordId?: boolean;
  onStartEditing?: () => void;
  onCommitEdits?: () => void;
  onCancelEdits?: () => void;
  onEdit?: (
    updated: (prev?: MetadataInspectorData) => MetadataInspectorData
  ) => void;
}

export interface MetadataInspectorData {
  accessControl?: AccessControl;
  metadata: AssetMetadata;
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
  const metadata = { ...asset.metadata, ...edits?.metadata };
  const accessControl = edits?.accessControl ?? asset.accessControl;

  return (
    <Box {...props}>
      <Flex
        sx={{
          p: 4,
          py: 3,
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between'
        }}
      >
        <Label
          sx={{
            width: 'auto',
            pt: 1,
            fontWeight: 'heavy',
            textTransform: 'uppercase',
            color: 'lightGrey',
            fontSize: '10px',
            lineHeight: '14px'
          }}
        >
          Schematised Metadata
        </Label>

        {onStartEditing && !isEditing && (
          <IconButton onClick={onStartEditing}>
            <PencilFill sx={{ height: '10px', color: '#818388' }} />
          </IconButton>
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
        <Box>
          <Label
            sx={{ fontWeight: 'bold', lineHeight: '14px', fontSize: '10px' }}
          >
            Access Control
          </Label>

          {isEditing ? (
            <Select
              value={accessControl}
              onChange={(event) =>
                onEdit?.((prev) => ({
                  metadata: {},
                  ...prev,
                  accessControl: event.target.value as AccessControl
                }))
              }
            >
              {Object.values(AccessControl).map((ac) => (
                <option key={ac} value={ac}>
                  {getAccessControlLabel(ac)}
                </option>
              ))}
            </Select>
          ) : (
            <Text sx={{ fontSize: '10px' }}>
              {getAccessControlLabel(asset.accessControl)}
            </Text>
          )}
        </Box>

        {collection.schema.map((property) => (
          <Box key={property.id}>
            <SchemaField
              property={property}
              editing={isEditing}
              value={metadata[property.id]}
              onChange={(change) =>
                onEdit?.((edits) => ({
                  ...edits,
                  metadata: { ...edits?.metadata, [property.id]: change }
                }))
              }
            />

            {errors?.[property.id] && (
              <ValidationError errors={errors?.[property.id]} />
            )}
          </Box>
        ))}

        {!hideRecordId && (
          <Box>
            <Label
              sx={{ fontWeight: 'bold', lineHeight: '14px', fontSize: '10px' }}
            >
              Record ID
            </Label>
            <Text
              sx={{
                userSelect: 'all',
                fontFamily: 'body',
                fontWeight: 'body',
                fontSize: '10px',
                lineHeight: '14px'
              }}
            >
              {asset.id}
            </Text>
          </Box>
        )}
      </Box>

      {isEditing && onCommitEdits && (
        <Flex
          sx={{
            justifyContent: 'flex-end',
            flexDirection: 'row',
            position: 'sticky',
            bottom: 0,
            p: 4,
            borderTop: 'light',
            backgroundColor: 'offWhite'
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
          p: 4,
          py: 3,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderTop: 'light'
        }}
      >
        <Label
          sx={{
            width: 'auto',
            pt: 1,
            fontWeight: 'heavy',
            textTransform: 'uppercase',
            color: 'lightGrey',
            fontSize: '10px',
            lineHeight: '14px'
          }}
        >
          Media Files
        </Label>

        {onAddFile && (
          <Button
            onClick={onAddFile}
            sx={{ fontSize: 1, p: 0 }}
            variant="primaryTransparent"
            title="Add media"
          >
            <Plus sx={{ pb: 1 }} size={18} />
          </Button>
        )}
      </Flex>

      {asset.media.map((file) => (
        <Flex
          sx={{
            flexDirection: 'column',
            p: 4,
            bg: 'background'
          }}
          key={file.id}
        >
          <Image key={file.rendition} src={file.rendition} />
          <Flex
            sx={{
              flexDirection: 'row',
              paddingTop: '10px',
              alignItems: 'center'
            }}
          >
            <Text
              sx={{
                flex: 1,
                flexDirection: 'row',
                fontSize: '10px'
              }}
            >
              {fileType(file.mimeType)}
            </Text>

            <Text sx={{ fontSize: '10px' }}>{megabytes(file.fileSize)}MB</Text>
            {onDeleteFile && (
              <IconButton
                onClick={() => onDeleteFile(file)}
                sx={{ width: 18, height: 18, p: 0 }}
              >
                <X size={18} />
              </IconButton>
            )}
          </Flex>
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
