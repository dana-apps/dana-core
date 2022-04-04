/** @jsxImportSource theme-ui */

import { startCase } from 'lodash';
import produce from 'immer';
import { ChangeEvent, FC } from 'react';
import {
  Box,
  BoxProps,
  Field,
  Flex,
  Grid,
  Label,
  Select,
  Switch
} from 'theme-ui';
import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';

export interface SchemaEditorProps
  extends Omit<BoxProps, 'value' | 'onChange'> {
  /** Current value of the schema */
  value: SchemaProperty[];

  /** Called whenever a property is edited. State management is the responsibility of the parent. */
  onChange: (schema: SchemaProperty[]) => void;
}

/**
 * Editor component for the properties of a schema.
 */
export const SchemaEditor: FC<SchemaEditorProps> = ({
  value,
  onChange,
  ...props
}) => {
  function changeCallback<T>(
    key: string,
    updater: (value: SchemaProperty, event: T) => void
  ) {
    return (event: T) => {
      const nextVal = produce<SchemaProperty[]>((val) => {
        const hit = val.find((x) => x.id === key);
        if (hit) {
          updater(hit, event);
        }
      });

      onChange(nextVal(value));
    };
  }

  return (
    <Flex
      sx={{
        alignItems: 'stretch',
        flexDirection: 'column',
        '& > label': {
          fontWeight: 600,
          fontSize: 1,
          pb: 1
        }
      }}
      {...props}
    >
      {value.map((item) => (
        <Box
          sx={{
            p: 5,
            width: '100%',
            borderBottom: 'primary'
          }}
          key={item.id}
        >
          <Grid key={item.id} width={200}>
            <Field
              value={item.label}
              label="Property name"
              name="propertyName"
              onChange={changeCallback(
                item.id,
                (prev, event: ChangeEvent<HTMLInputElement>) => {
                  prev.label = event.currentTarget.value;
                }
              )}
            />

            <Box>
              <Label>Property Type</Label>
              <Select
                key={item.id}
                value={item.type}
                name="propertyType"
                onChange={changeCallback(
                  item.id,
                  (prev, event: ChangeEvent<HTMLSelectElement>) => {
                    prev.type = event.currentTarget.value as SchemaPropertyType;
                  }
                )}
              >
                {Object.values(SchemaPropertyType).map((t) => {
                  return (
                    <option key={t} value={t}>
                      {startCase(t.toLowerCase())}
                    </option>
                  );
                })}
              </Select>
            </Box>
          </Grid>

          <Box sx={{ pt: 4 }}>
            <Switch
              sx={{
                'input:checked ~ &': {
                  backgroundColor: 'var(--theme-ui-colors-primary)'
                }
              }}
              label="Required"
              checked={item.required}
              onChange={changeCallback(
                item.id,
                (prev, event: ChangeEvent<HTMLInputElement>) => {
                  prev.required = event.currentTarget.checked;
                }
              )}
            />
          </Box>
        </Box>
      ))}
    </Flex>
  );
};
