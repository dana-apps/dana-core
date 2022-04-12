/** @jsxImportSource theme-ui */

/* eslint-disable @typescript-eslint/no-explicit-any */
import faker from '@faker-js/faker';
import { times } from 'lodash';
import { useState } from 'react';
import {
  SchemaProperty,
  SchemaPropertyType
} from '../../../../common/asset.interfaces';
import { SchemaEditor } from '../schema-editor.component';

export default {
  title: 'Components/Schema Editor',
  parameters: {
    actions: {
      argTypesRegex: '^on.*'
    }
  }
};

export const WithProperties = () => {
  faker.seed(10);

  const [state, setState] = useState<SchemaProperty[]>(() =>
    times(11, (i) => ({
      id: String(i),
      label: faker.animal.dog(),
      required: faker.datatype.boolean(),
      type: SchemaPropertyType.FREE_TEXT
    }))
  );

  return (
    <SchemaEditor sx={{ width: '100%' }} value={state} onChange={setState} />
  );
};

export const WithErrors = () => {
  faker.seed(10);

  const [state, setState] = useState<SchemaProperty[]>(() =>
    times(11, (i) => ({
      id: String(i),
      label: faker.animal.dog(),
      required: faker.datatype.boolean(),
      type: SchemaPropertyType.FREE_TEXT
    }))
  );

  const errors = Object.fromEntries(
    state.map((property) => [
      property.id,
      times(faker.datatype.number(3), () => ({
        message: faker.lorem.words(5),
        count: faker.datatype.number(100)
      }))
    ])
  );

  return (
    <SchemaEditor
      sx={{ width: '100%' }}
      errors={errors}
      value={state}
      onChange={setState}
    />
  );
};
