// Storage-related types
// Types for Chrome storage local/sync data

export interface StorageData {
  // Recording state
  recording?: boolean;
  paused?: boolean;
  restarting?: boolean;
  recordingStartTime?: number;
  recordingDuration?: number;
  pendingRecording?: boolean;
  
  // Tab references
  activeTab?: number;
  recordingTab?: number | null;
  tabRecordedID?: number | null;
  sandboxTab?: number;
  editorTab?: number;
  backupTab?: number;
  originalTabId?: number;
  
  // Recording settings
  region?: boolean;
  customRegion?: boolean;
  backup?: boolean;
  backupSetup?: boolean;
  offscreen?: boolean;
  surface?: "screen" | "window" | "browser" | "monitor";
  recordingType?: string;
  wasRegion?: boolean;
  tabPreferred?: boolean;
  
  // Alarm settings
  alarm?: boolean;
  alarmTime?: string | number;
  
  // Quality settings
  qualityValue?: string;
  fpsValue?: string;
  
  // Auth & subscription
  token?: string | false;
  screenityToken?: string;
  screenityUser?: User | null;
  isSubscribed?: boolean;
  isLoggedIn?: boolean;
  proSubscription?: ProSubscription | null;
  hasSubscribedBefore?: boolean;
  lastAuthCheck?: number;
  wasLoggedIn?: boolean;
  authenticated?: boolean;
  subscribed?: boolean;
  
  // UI state
  bannerSupport?: boolean;
  firstTime?: boolean;
  pushToTalk?: boolean;
  onboarding?: boolean;
  showProSplash?: boolean;
  
  // Project state
  projectId?: string | null;
  activeSceneId?: string | null;
  recordingProjectTitle?: string;
  recordingToScene?: boolean;
  instantMode?: boolean;
  
  // Other
  countdown?: boolean;
  clickEvents?: ClickEvent[];
  sendingChunks?: boolean;
  memoryError?: boolean;
  customRegion?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface ProSubscription {
  id: string;
  status: string;
  plan: string;
}

export interface ClickEvent {
  x: number;
  y: number;
  timestamp: number;
  [key: string]: unknown;
}

