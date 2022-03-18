export interface FrontendConfig {
  platform: FrontendPlatform;
  windowId: string;
}

export type FrontendPlatform = 'linuxish' | 'mac' | 'windows' | 'web';
