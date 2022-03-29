/** Represent configuration data injected into the frontend */
export interface FrontendConfig {
  /** Environment that the ui is running in */
  platform: FrontendPlatform;

  /** Unique identifier for the window hosting the ui */
  windowId: string;

  /** If the window represents a document, the id of that document */
  documentId?: string;

  /** Title of the window */
  title?: string;
}

export type FrontendPlatform = 'linuxish' | 'mac' | 'windows' | 'web';
