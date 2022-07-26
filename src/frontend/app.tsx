/** @jsxImportSource theme-ui */

import { FC } from 'react';
import { Route, Routes } from 'react-router-dom';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import { ArchiveScreen } from './screens/archive.screen';
import { AssetDetailScreen } from './screens/asset-detail.sceen';
import { CollectionScreen } from './screens/collection.screen';
import { CreateAssetScreen } from './screens/create-asset.screen';
import { ArchiveIngestScreen } from './screens/ingest.screen';
import { SchemaScreen } from './screens/schema.screen';
import { InvalidateOnPageChange } from './ui/components/util.component';

/**
 * Root component for a window representing an archive
 */
export const ArchiveWindow: FC<{ title?: string }> = ({ title }) => (
  <DndProvider backend={HTML5Backend}>
    <Routes>
      <Route path="/create-asset" element={<CreateAssetScreen />} />
      <Route path="/asset-detail" element={<AssetDetailScreen />} />
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
  </DndProvider>
);
