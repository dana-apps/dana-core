import { createContext, useContext } from 'react';
import { FrontendConfig } from '../common/frontend-config';
import { required } from '../common/util/assert';

export const FrontendConfigContext =
  createContext<FrontendConfig | undefined>(undefined);

export const useFrontendConfig = () =>
  required(
    useContext(FrontendConfigContext),
    'FrontendConfigContext is not configured'
  );
