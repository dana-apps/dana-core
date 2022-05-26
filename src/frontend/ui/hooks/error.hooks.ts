import { ReactElement } from 'react';
import { Result } from '../../../common/util/error';
import { useModal } from './window.hooks';

/**
 * Hook for displaying errors.
 * Currently uses console.error until we get round to presenting them in a nicer way.
 */
export function useErrorDisplay() {
  const model = useModal();
  const error = (error: string | ReactElement) => {
    model.alert({ message: error, title: 'Error', icon: 'error' });
  };
  const unexpectedError = (code: unknown) => {
    console.error(error, code);
    error('An unexpected error occured');
  };

  return Object.assign(error, {
    unexpected: unexpectedError,
    guard: <T>(result?: Result<T, unknown>) => {
      if (!result) {
        return;
      }

      if (result.status === 'error') {
        unexpectedError(result.error);
      } else {
        return result.value;
      }
    }
  });
}
