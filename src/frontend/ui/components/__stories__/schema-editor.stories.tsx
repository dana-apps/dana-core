/** @jsxImportSource theme-ui */

/* eslint-disable @typescript-eslint/no-explicit-any */
import faker from '@faker-js/faker';
import { times } from 'lodash';
import { PropsWithChildren, useState } from 'react';
import {
  CollectionType,
  GetRootDatabaseCollection,
  GetSubcollections,
  SchemaProperty,
  SchemaPropertyType
} from '../../../../common/asset.interfaces';
import { ok } from '../../../../common/util/error';
import { IpcContext } from '../../../ipc/ipc.hooks';
import { MockIpc } from '../../../ipc/mock-ipc';
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
  const fixture = setup();
  faker.seed(10);

  const [state, setState] = useState<SchemaProperty[]>(() =>
    times(11, (i) => ({
      id: String(i),
      label: faker.animal.dog(),
      required: faker.datatype.boolean(),
      repeated: false,
      type: SchemaPropertyType.FREE_TEXT
    }))
  );

  return (
    <fixture.context>
      <SchemaEditor sx={{ width: '100%' }} value={state} onChange={setState} />
    </fixture.context>
  );
};

export const WithErrors = () => {
  const fixture = setup();
  faker.seed(10);

  const [state, setState] = useState<SchemaProperty[]>(() =>
    times(11, (i) => ({
      id: String(i),
      label: faker.animal.dog(),
      required: faker.datatype.boolean(),
      repeated: false,
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
    <fixture.context>
      <SchemaEditor
        sx={{ width: '100%' }}
        errors={errors}
        value={state}
        onChange={setState}
      />
    </fixture.context>
  );
};

function setup() {
  const ipc = new MockIpc();
  ipc.handle({
    type: GetRootDatabaseCollection,
    result: async () =>
      ok({
        id: '$db',
        title: 'Root',
        schema: [],
        type: CollectionType.CONTROLLED_DATABASE
      })
  });

  ipc.handle({
    type: GetSubcollections,
    result: async () => {
      faker.seed(10);
      return ok({
        total: 10,
        range: {
          limit: 10,
          offset: 0
        },
        items: times(10, () => {
          return {
            id: faker.datatype.uuid(),
            title: faker.word.noun(),
            type: CollectionType.CONTROLLED_DATABASE,
            schema: []
          };
        })
      });
    }
  });

  return {
    ipc,
    context: (props: PropsWithChildren<unknown>) => (
      <IpcContext.Provider value={{ ipc }}>
        {props.children}
      </IpcContext.Provider>
    )
  };
}
