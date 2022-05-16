/** @jsxImportSource theme-ui */

import produce, { Draft } from 'immer';
import { compact } from 'lodash';
import { ChangeEvent, FC, ReactElement, useCallback } from 'react';
import { DashCircle, PlusCircle } from 'react-bootstrap-icons';
import {
  Box,
  BoxProps,
  Field,
  Flex,
  IconButton,
  Input,
  Label,
  Text
} from 'theme-ui';
import {
  AssetMetadataItem,
  SchemaProperty,
  SchemaPropertyType,
  SearchAsset
} from '../../../common/asset.interfaces';
import { assert, never } from '../../../common/util/assert';
import { useRPC } from '../../ipc/ipc.hooks';
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
    return (
      <FreeTextField {...props} value={value as AssetMetadataItem<string>} />
    );
  }

  if (props.property.type === SchemaPropertyType.CONTROLLED_DATABASE) {
    return (
      <DatabaseReferenceField
        {...props}
        value={value as AssetMetadataItem<string>}
      />
    );
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
    (change: (string | undefined)[]) => {
      onChange({
        rawValue: change,
        presentationValue: change.map((value) => ({
          label: value ?? '',
          rawValue: value
        }))
      });
    },
    [onChange]
  );

  if (editing) {
    if (property.repeated) {
      return (
        <RepeatedEditor
          label={property.label}
          value={value?.rawValue ?? []}
          onChange={handleChange}
        >
          {({ value, onChange, ...props }, i) => (
            <Input
              value={value ?? ''}
              data-testid={fieldEditTestId(property, i)}
              onChange={(event) =>
                onChange(event.currentTarget.value || undefined)
              }
              {...props}
            />
          )}
        </RepeatedEditor>
      );
    }

    return (
      <Field
        name={property.id}
        label={property.label}
        value={value?.rawValue[0] ?? ''}
        data-testid={fieldEditTestId(property)}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          handleChange(
            event.currentTarget.value ? [event.currentTarget.value] : []
          )
        }
        {...props}
      />
    );
  }

  return <ReadonlyDisplay property={property} value={value} />;
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

  const promiseOptions = async (inputValue: string) => {
    const assets = await rpc(
      SearchAsset,
      { collection: property.databaseId, query: inputValue },
      { offset: 0, limit: 25 }
    );

    assert(assets.status === 'ok', 'Failed to load');
    return assets.value.items.map((asset) => ({
      rawValue: asset.id,
      label: asset.title
    }));
  };

  if (editing) {
    if (property.repeated) {
      return (
        <Box {...props}>
          <Label>{property.label}</Label>
          <RelationSelect
            isMulti
            value={
              value?.presentationValue ? compact(value?.presentationValue) : []
            }
            data-testid={fieldEditTestId(property)}
            loadOptions={promiseOptions}
            getOptionLabel={(opt) => opt?.label ?? ''}
            getOptionValue={(opt) => opt.rawValue ?? ''}
            onChange={(x) =>
              onChange({
                rawValue: compact(x.map((item) => item?.rawValue)),
                presentationValue: x.slice()
              })
            }
          />
        </Box>
      );
    }

    return (
      <Box {...props}>
        <Label>{property.label}</Label>
        <RelationSelect
          loadOptions={promiseOptions}
          value={value?.presentationValue?.[0]}
          data-testid={fieldEditTestId(property)}
          getOptionLabel={(opt) => opt?.label ?? ''}
          getOptionValue={(opt) => opt?.rawValue ?? ''}
          onChange={(x) =>
            onChange({
              rawValue: x?.rawValue ? [x.rawValue] : [],
              presentationValue: x ? [x] : []
            })
          }
        />
      </Box>
    );
  }

  return <ReadonlyDisplay property={property} value={value} />;
};

interface RepeatedEditorProps<T> {
  label: string;
  value: (T | undefined)[];
  onChange: (x: (T | undefined)[]) => void;
  children: (
    props: {
      value: T | undefined;
      onChange: (value: T | undefined) => void;
    },
    i: number
  ) => ReactElement;
}

/**
 * Adapt an editor component to support multiple entries
 */
function RepeatedEditor<T>(props: RepeatedEditorProps<T>) {
  const value = props.value.length === 0 ? [undefined] : props.value;

  const deleteItem = (i: number) => {
    const next = produce(value, (draft) => {
      draft.splice(i, 1);
    });
    props.onChange(next);
  };

  const addItem = () => {
    props.onChange([...value, undefined]);
  };

  return (
    <Box>
      <Label>{props.label}</Label>

      {value.map((value, i) => (
        <Flex
          key={i}
          sx={{
            flexDirection: 'row',
            pr: 2,
            pb: 2
          }}
        >
          <Box sx={{ flex: 1, mr: 3 }}>
            {props.children(
              {
                value,
                onChange: (change) => {
                  const next = produce(props.value, (draft) => {
                    draft[i] = change as Draft<T> | undefined;
                  });

                  props.onChange(next);
                }
              },
              i
            )}
          </Box>

          <IconButton onClick={() => deleteItem(i)}>
            <DashCircle />
          </IconButton>
        </Flex>
      ))}

      <Flex sx={{ flexDirection: 'row', justifyContent: 'center' }}>
        <IconButton onClick={addItem}>
          <PlusCircle />
        </IconButton>
      </Flex>
    </Box>
  );
}

const ReadonlyDisplay: FC<{
  value?: AssetMetadataItem;
  property: SchemaProperty;
}> = ({ value, property, ...props }) => {
  const getValue = () => {
    if (!value || value.rawValue.length === 0) {
      return <i data-testid={fieldDisplayTestId(property)}>None</i>;
    }

    if (!property.repeated) {
      return (
        <span data-testid={fieldDisplayTestId(property)}>
          {value.presentationValue[0]?.label ?? <i>None</i>}
        </span>
      );
    }

    return (
      <ul sx={{ my: 0, pl: 5 }}>
        {value.presentationValue.map((item, i) => (
          <li data-testid={fieldDisplayTestId(property, i)} key={i}>
            {item?.label}
          </li>
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

export function fieldDisplayTestId(property: SchemaProperty, i = 0) {
  return `metadata-display-${property.id}@${i}`;
}

export function fieldEditTestId(property: SchemaProperty, i = 0) {
  return `metadata-edit-${property.id}@${i}`;
}
