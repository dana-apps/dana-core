/** @jsxImportSource theme-ui */

import { ChangeEvent, FC } from 'react';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';
import { Box, BoxProps, Field, Flex, Label, Text } from 'theme-ui';
import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { never } from '../../../common/util/assert';

export interface SchemaFormFieldProps<T = unknown>
  extends Omit<BoxProps, 'value' | 'onChange' | 'property'> {
  property: SchemaProperty;
  value: T | undefined;
  onChange: (change: T | undefined) => void;
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
        value={value ?? ''}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(event.currentTarget.value || undefined)
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

interface ValidationErrorProps extends BoxProps {
  errors: string[];
}

export const SchemaError: FC<ValidationErrorProps> = ({ errors, ...props }) => (
  <Flex sx={{ flexDirection: 'row', mt: 1 }} {...props}>
    <ExclamationTriangleFill
      sx={{ mr: 2, mt: 1 }}
      color="var(--theme-ui-colors-error)"
    />

    {errors.map((e, i) => (
      <Text key={i} color="error" sx={{ fontSize: 1, fontWeight: 700 }}>
        {e}
      </Text>
    ))}
  </Flex>
);
