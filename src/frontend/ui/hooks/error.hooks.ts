/**
 * Hook for displaying errors.
 * Currently uses window.alert until we get round to presenting them in a nicer way.
 */
export function useErrorDisplay() {
  return (error: string) => {
    alert(error);
  };
}
