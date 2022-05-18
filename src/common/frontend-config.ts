/** Represent configuration data injected into the frontend */
export interface FrontendConfig {
  /** Environment that the ui is running in */
  platform: FrontendPlatform;

  /** Unique identifier for the window hosting the ui */
  windowId: string;

  /** If the window represents a document, the id of that document */
  documentId?: string;

  /** The type of window to display */
  type: 'splash-screen' | 'archive' | 'modal';

  modalConfig?: {
    message: { __html: string };
    icon: ModalIcon;
    returnId: string;
  };

  /** Title of the window */
  title?: string;

  /** App version */
  version: string;

  /** App release date */
  releaseDate: string;
}

export type FrontendPlatform = 'linuxish' | 'mac' | 'windows' | 'web';
export type ModalIcon = 'error';
