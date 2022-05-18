import { ReactElement } from 'react';
import { useModal } from './modal.hooks';

/**
 * Hook for displaying errors.
 * Currently uses console.error until we get round to presenting them in a nicer way.
 */
export function useErrorDisplay() {
  const model = useModal();
  const error = (error: string | ReactElement) => {
    model.alert({ message: error, title: 'Error', icon: 'error' });
  };

  return Object.assign(error, {
    unexpected: (code: string) => {
      console.error(error, code);
      error('An unexpected error occured');
    }
  });
}
