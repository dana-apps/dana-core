/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { Route, Routes } from 'react-router-dom';

import { ArchiveScreen } from './screens/archive.screen';
import { CollectionScreen } from './screens/collection.screen';
import { ArchiveIngestScreen } from './screens/ingest.screen';
import { SchemaScreen } from './screens/schema.screen';
import { InvalidateOnPageChange } from './ui/components/util.component';

/**
 * Root component for a window representing an archive
 */
export const ArchiveWindow: FC<{ title?: string }> = ({ title }) => (
  <Routes>
    <Route path="/" element={<ArchiveScreen title={title} />}>
      <Route index element={<></>} />
      <Route
        path="ingest/:sessionId"
        element={
          <InvalidateOnPageChange>
            <ArchiveIngestScreen />
          </InvalidateOnPageChange>
        }
      />
      <Route
        path="collection/:collectionId/schema"
        element={
          <InvalidateOnPageChange>
            <SchemaScreen />
          </InvalidateOnPageChange>
        }
      />
      <Route
        path="collection/:collectionId"
        element={
          <InvalidateOnPageChange>
            <CollectionScreen />
          </InvalidateOnPageChange>
        }
      />
    </Route>
  </Routes>
);
