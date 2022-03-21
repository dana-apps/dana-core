export interface FrontendConfig {
  platform: FrontendPlatform;
  windowId: string;
  documentId?: string;
}

export type FrontendPlatform = 'linuxish' | 'mac' | 'windows' | 'web';
