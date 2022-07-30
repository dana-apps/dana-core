/** @jsxImportSource theme-ui */

import { createContext, useContext } from 'react';
import { AssetMetadataItem } from '../../../common/asset.interfaces';
import { ProgressIndicator, ProgressValue } from './atoms.component';
import { DataGridCell } from './grid.component';

import redactedIcon from '../icons/redacted.png';

/** Datagrid cell for raw strings */
export const StringCell: DataGridCell<string> = ({ value }) => <>{value}</>;

StringCell.width = (value, fontSize) => guessTextWidth(value, fontSize);

/** For any schema property, render its semicolon-delimited presentation value */
export const MetadataItemCell: DataGridCell<{
  metadata: AssetMetadataItem;
  redactedProps?: string[];
  id: string;
}> = ({ property, value }) => {
  const ctx = useContext(MetadataItemContext);
  const redactedProps = value?.redactedProps;
  const redacted = value?.redactedProps?.includes(property);

  return (
    <div>
      <span
        sx={{
          border: redacted ? '1px solid black' : 'none',
          p: '2px',
          '&:hover .show-hover': { opacity: 1 }
        }}
        title={
          redacted
            ? 'This is redacted - it will not be exported or shown outside of this archive'
            : ''
        }
      >
        {presentationValue(value?.metadata)}
        {redactedProps && (
          <button
            onClick={() =>
              value &&
              ctx.setRedactedProperties?.(
                value?.id,
                redacted
                  ? redactedProps?.filter((x) => x !== property)
                  : [...redactedProps, property]
              )
            }
            className="show-hover"
            sx={{
              p: 0,
              pl: 2,
              border: 'none',
              bg: 'transparent',
              opacity: redacted ? 1 : 0,
              display: 'inline-block'
            }}
            title={
              redacted
                ? 'Unredact - field will be allowed to be exported from this archive'
                : 'Redact - no longer allow export outside of this archive'
            }
          >
            <img sx={{ width: 10, height: 10 }} src={redactedIcon} />
          </button>
        )}
      </span>
    </div>
  );
};

MetadataItemCell.width = (data, fontSize) =>
  guessTextWidth(presentationValue(data?.metadata), fontSize);

/** Datagrid cell for indicating progress */
export const ProgressCell: DataGridCell<ProgressValue> = ({ value }) => {
  return (
    <div
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <ProgressIndicator value={value} />
    </div>
  );
};

ProgressCell.width = 36;

const presentationValue = (val?: AssetMetadataItem) => {
  if (!val || val.presentationValue.length === 0) {
    return '-';
  }

  return val.presentationValue.map((x) => x.label).join('; ');
};

export const guessTextWidth = (text: string | undefined, fontSize: number) => {
  return (
    Math.max(36, Math.min(600, text ? text.length * fontSize * 0.8 : 500)) + 48
  );
};

interface MetadataItemContext {
  setRedactedProperties?: (id: string, keys: string[]) => void;
}

export const MetadataItemContext = createContext<MetadataItemContext>({});
