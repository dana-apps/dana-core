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
  AggregatedValidationError,
  GetRootDatabaseCollection,
  GetSubcollections,
  SchemaProperty,
  SchemaPropertyType
} from '../../../common/asset.interfaces';
import { ValidationError } from './atoms.component';
import { unwrapGetResult, useGet, useListAll } from '../../ipc/ipc.hooks';
import { never } from '../../../common/util/assert';

export interface SchemaEditorProps
  extends Omit<BoxProps, 'value' | 'onChange'> {
  /** Current value of the schema */
  value: SchemaProperty[];

  /** Errors displayed when the schema update is rejected due to being incompatible with the current contents */
  errors?: AggregatedValidationError;

  /** Called whenever a property is edited. State management is the responsibility of the parent. */
  onChange: (schema: SchemaProperty[]) => void;
}

/**
 * Editor component for the properties of a schema.
 */
export const SchemaEditor: FC<SchemaEditorProps> = ({
  value,
  errors = {},
  onChange,
  ...props
}) => {
  const databaseRoot = unwrapGetResult(useGet(GetRootDatabaseCollection));
  const databases = unwrapGetResult(
    useListAll(
      GetSubcollections,
      () => (databaseRoot ? { parent: databaseRoot.id } : 'skip'),
      [databaseRoot]
    )
  );

  /**
   * Mutate a schema property using a callback
   *
   * @param key Property of the schema to mutate
   * @param updater Mutation function that operates on the provided property.
   * @returns A callback suitable for passing to an onChange handler.
   */
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

  /**
   * Replace a schema property using a 'reducer' callback
   *
   * @param key Property of the schema to replace
   * @param updater Reducer function returning a new schema value of the requested type.
   * @returns A callback suitable for passing to an onChange handler.
   */
  function replaceCallback<T>(
    key: string,
    updater: (prev: SchemaProperty, event: T) => SchemaProperty
  ) {
    return (event: T) => {
      const nextVal = produce<SchemaProperty[]>((val) => {
        const index = val.findIndex((x) => x.id === key);
        if (index >= 0) {
          val[index] = updater(val[index], event);
        }
      });

      onChange(nextVal(value));
    };
  }

  /**
   * Return additional supported configuration elements for the provided schema property.
   *
   * @param property The schema property
   * @returns A react node that renders the additional config elements.
   */
  function getExtraConfigProperties(property: SchemaProperty) {
    if (property.type === SchemaPropertyType.FREE_TEXT) {
      return null;
    }

    if (property.type === SchemaPropertyType.CONTROLLED_DATABASE) {
      return (
        <Box>
          <Label>Database Reference</Label>
          <Select
            key={property.id}
            value={property.databaseId}
            name="databaseId"
            onChange={changeCallback(
              property.id,
              (prev, event: ChangeEvent<HTMLSelectElement>) => {
                if (prev.type === SchemaPropertyType.CONTROLLED_DATABASE) {
                  prev.databaseId = event.currentTarget.value;
                }
              }
            )}
          >
            {databases?.map((t) => {
              return (
                <option key={t.id} value={t.id}>
                  {startCase(t.title)}
                </option>
              );
            })}
          </Select>
        </Box>
      );
    }
  }

  function convertToPropertyType(
    val: SchemaProperty,
    type: SchemaPropertyType
  ): SchemaProperty {
    if (type === SchemaPropertyType.FREE_TEXT) {
      return {
        ...val,
        type
      };
    }
    if (type === SchemaPropertyType.CONTROLLED_DATABASE) {
      const defaultDb = databases?.[0];
      if (!defaultDb) {
        return val;
      }

      return {
        databaseId: defaultDb.id,
        ...val,
        type
      };
    }

    return never(type);
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
          <Grid key={item.id} repeat="fill" gap={4} width={300}>
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
                onChange={replaceCallback(
                  item.id,
                  (prev, event: ChangeEvent<HTMLSelectElement>) => {
                    return convertToPropertyType(
                      prev,
                      event.currentTarget.value as SchemaPropertyType
                    );
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
            {getExtraConfigProperties(item)}
          </Grid>

          <Flex
            sx={{
              width: '100%',
              flexDirection: 'row',
              pt: 5,
              justifyContent: 'flex-start',
              '> *': { mr: 6 }
            }}
          >
            <Box>
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
            <Box>
              <Switch
                sx={{
                  'input:checked ~ &': {
                    backgroundColor: 'var(--theme-ui-colors-primary)'
                  }
                }}
                label="Repeated"
                checked={item.repeated}
                onChange={changeCallback(
                  item.id,
                  (prev, event: ChangeEvent<HTMLInputElement>) => {
                    prev.repeated = event.currentTarget.checked;
                  }
                )}
              />
            </Box>
            <Box>
              <Switch
                sx={{
                  'input:checked ~ &': {
                    backgroundColor: 'var(--theme-ui-colors-primary)'
                  }
                }}
                label="Visible to Public"
                checked={item.visible}
                onChange={changeCallback(
                  item.id,
                  (prev, event: ChangeEvent<HTMLInputElement>) => {
                    prev.visible = event.currentTarget.checked;
                  }
                )}
              />
            </Box>
          </Flex>

          <Box>
            {errors[item.id]?.length > 0 && (
              <ValidationError
                sx={{ mt: 4 }}
                errors={errors[item.id].map(
                  ({ message, count }) =>
                    `${count} items were rejected due to: ${message}`
                )}
              />
            )}
          </Box>
        </Box>
      ))}
    </Flex>
  );
};
