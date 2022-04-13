import { Result } from '../../../common/util/error';

/**
 * Hook for displaying errors.
 * Currently uses console.error until we get round to presenting them in a nicer way.
 */
export function useErrorDisplay(context?: string) {
  return Object.assign(
    (error: string) => {
      console.error(error);
    },
    {
      unexpected: (code: string) => {
        console.error('Unexpected error', code);
      }
    }
  );
}
