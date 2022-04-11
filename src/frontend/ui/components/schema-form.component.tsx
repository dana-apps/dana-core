import { ChangeEvent, FC } from 'react';
import { Box, BoxProps, Field, Label, Text } from 'theme-ui';
import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { never } from '../../../common/util/assert';

export interface SchemaFormFieldProps<T = unknown>
  extends Omit<BoxProps, 'value' | 'onChange' | 'property'> {
  property: SchemaProperty;
  value: T | undefined;
  onChange: (change: T) => void;
  editing: boolean;
}

export const FreeTextField: FC<SchemaFormFieldProps<string>> = ({
  property,
  value,
  onChange,
  editing,
  ...props
}) => {
  if (editing) {
    return (
      <Field
        name={property.id}
        label={property.label}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.currentTarget.value)
        }
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

export const SchemaField: FC<SchemaFormFieldProps> = (props) => {
  if (props.property.type === SchemaPropertyType.FREE_TEXT) {
    return <FreeTextField {...(props as SchemaFormFieldProps<string>)} />;
  }

  return never(props.property.type);
};
