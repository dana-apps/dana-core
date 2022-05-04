/** @jsxImportSource theme-ui */

import { ChangeEvent, FC, useCallback } from 'react';
import { Box, BoxProps, Field, Label, Text } from 'theme-ui';
import {
  GetAsset,
  GetCollection,
  SchemaProperty,
  SchemaPropertyType,
  SearchAsset
} from '../../../common/asset.interfaces';
import { assert, never } from '../../../common/util/assert';
import {
  SKIP_FETCH,
  unwrapGetResult,
  useGet,
  useRPC
} from '../../ipc/ipc.hooks';
import { RelationSelect } from './atoms.component';

export interface SchemaFormFieldProps<T = unknown>
  extends Omit<BoxProps, 'value' | 'onChange' | 'property'> {
  /** SchemaProperty instance defining the type of the property to display */
  property: SchemaProperty;

  /** Current value (edited or ) of the property */
  value: T | undefined;

  /** Fired when the property is edited */
  onChange: (change: T | undefined) => void;

  /** If true, the property will be displayed using an editable control */
  editing: boolean;
}

/**
 * Render a control for displaying and editing a property value of arbitrary schema type
 */
export const SchemaField: FC<SchemaFormFieldProps> = ({ value, ...props }) => {
  if (props.property.type === SchemaPropertyType.FREE_TEXT) {
    const stringVal =
      typeof value === 'string' || typeof value === 'undefined'
        ? value
        : undefined;

    return <FreeTextField {...props} value={stringVal} />;
  }

  if (props.property.type === SchemaPropertyType.CONTROLLED_DATABASE) {
    const stringVal =
      typeof value === 'string' || typeof value === 'undefined'
        ? value
        : undefined;

    return <DatabaseReferenceField {...props} value={stringVal} />;
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
      onChange(event.currentTarget.value || undefined);
    },
    [onChange]
  );

  if (editing) {
    return (
      <Field
        name={property.id}
        label={property.label}
        value={value ?? ''}
        onChange={handleChange}
        {...props}
      />
    );
  }

  return (
    <Box {...props}>
      <Label>{property.label}</Label>

      <Text>{value ?? <i>None</i>}</Text>
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
  const collection = unwrapGetResult(
    useGet(GetCollection, property.databaseId)
  );
  const referencedValue = useGet(GetAsset, value ?? SKIP_FETCH);
  const titleKey = collection?.schema[0]?.id;

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
          getOptionLabel={(opt) =>
            titleKey ? String(opt.metadata[titleKey]) : ''
          }
          getOptionValue={(opt) => opt.id}
          onChange={(x) => onChange(x?.id ?? undefined)}
        />
      </Box>
    );
  }

  // If we don't have a result for the referenced value (because it is invalid or not fetched yet)
  // then at least return the header
  if (referencedValue?.status !== 'ok' || !titleKey) {
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
        {referencedValue.value ? (
          String(referencedValue.value.metadata[titleKey])
        ) : (
          <i>None</i>
        )}
      </Text>
    </Box>
  );
};
