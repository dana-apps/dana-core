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
