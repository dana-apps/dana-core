/** @jsxImportSource theme-ui */

import { ChangeEvent, FC, useCallback } from 'react';
import { Box, BoxProps, Field, Label, Text } from 'theme-ui';
import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { never } from '../../../common/util/assert';

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

  return never(props.property.type);
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
