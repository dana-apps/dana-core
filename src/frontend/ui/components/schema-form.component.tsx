/** @jsxImportSource theme-ui */

import { ChangeEvent, FC, useCallback } from 'react';
import { Box, BoxProps, Field, Label, Text } from 'theme-ui';
import {
  AssetMetadataItem,
  GetAsset,
  SchemaProperty,
  SchemaPropertyType,
  SearchAsset
} from '../../../common/asset.interfaces';
import { assert, never } from '../../../common/util/assert';
import { SKIP_FETCH, useGet, useRPC } from '../../ipc/ipc.hooks';
import { RelationSelect } from './atoms.component';

export interface SchemaFormFieldProps<T = unknown>
  extends Omit<BoxProps, 'value' | 'onChange' | 'property'> {
  /** SchemaProperty instance defining the type of the property to display */
  property: SchemaProperty;

  /** Current value of the property */
  value?: AssetMetadataItem<T>;

  /** Fired when the property is edited */
  onChange: (change: AssetMetadataItem<T>) => void;

  /** If true, the property will be displayed using an editable control */
  editing: boolean;
}

/**
 * Render a control for displaying and editing a property value of arbitrary schema type
 */
export const SchemaField: FC<SchemaFormFieldProps> = ({
  value = { rawValue: [] },
  ...props
}) => {
  if (props.property.type === SchemaPropertyType.FREE_TEXT) {
    const stringVals = {
      rawValue: value.rawValue.flatMap((val) =>
        typeof val === 'string' ? [val] : []
      )
    };

    return <FreeTextField {...props} value={stringVals} />;
  }

  if (props.property.type === SchemaPropertyType.CONTROLLED_DATABASE) {
    const stringVals = {
      rawValue: value.rawValue.flatMap((val) =>
        typeof val === 'string' ? [val] : []
      )
    };

    return <DatabaseReferenceField {...props} value={stringVals} />;
  }

  return never(props.property);
};

/**
 * Render a control for displaying and editing properties witg the FREE_TEXT schema type.
 */
export const FreeTextField: FC<SchemaFormFieldProps<string>> = ({
  property,
  value,
  onChange,
  editing,
  ...props
}) => {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({
        rawValue: event.currentTarget.value ? [event.currentTarget.value] : []
      });
    },
    [onChange]
  );

  if (editing) {
    return (
      <Field
        name={property.id}
        label={property.label}
        value={value?.rawValue[0] ?? ''}
        onChange={handleChange}
        {...props}
      />
    );
  }

  const getValue = () => {
    if (!value || value.rawValue.length === 0) {
      return <i>None</i>;
    }
    if (value.rawValue.length === 1) {
      return value.rawValue[0];
    }

    return (
      <ul>
        {value.rawValue.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  };

  return (
    <Box {...props}>
      <Label>{property.label}</Label>

      <Text>{getValue()}</Text>
    </Box>
  );
};

/**
 * Render a control for displaying and editing properties with the CONTROLLED_DATABASE schema type.
 */
export const DatabaseReferenceField: FC<SchemaFormFieldProps<string>> = ({
  property,
  value,
  onChange,
  editing,
  ...props
}) => {
  assert(
    property.type === SchemaPropertyType.CONTROLLED_DATABASE,
    'Expected controlled db property'
  );
  const rpc = useRPC();
  const referencedValue = useGet(GetAsset, value?.rawValue[0] ?? SKIP_FETCH);

  const promiseOptions = async (inputValue: string) => {
    const assets = await rpc(
      SearchAsset,
      { collection: property.databaseId, query: inputValue },
      { offset: 0, limit: 25 }
    );

    assert(assets.status === 'ok', 'Failed to load');
    return assets.value.items;
  };

  if (editing) {
    return (
      <Box {...props}>
        <Label>{property.label}</Label>
        <RelationSelect
          loadOptions={promiseOptions}
          getOptionLabel={(opt) => opt.title}
          getOptionValue={(opt) => opt.id}
          onChange={(x) =>
            onChange({
              rawValue: x?.id ? [x.id] : []
            })
          }
        />
      </Box>
    );
  }

  // If we don't have a result for the referenced value (because it is invalid or not fetched yet)
  // then at least return the header
  if (referencedValue?.status !== 'ok') {
    return (
      <Box {...props}>
        <Label>{property.label}</Label>
      </Box>
    );
  }

  return (
    <Box {...props}>
      <Label>{property.label}</Label>

      <Text>
        {referencedValue.value ? referencedValue.value.title : <i>None</i>}
      </Text>
    </Box>
  );
};
