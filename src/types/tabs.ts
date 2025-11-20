// Tab-related types

export interface TabActiveInfo {
  tabId: number;
  windowId?: number;
}

export interface TabChangeInfo {
  status?: "loading" | "complete";
  url?: string;
  pinned?: boolean;
  audible?: boolean;
  discarded?: boolean;
  autoDiscardable?: boolean;
  mutedInfo?: chrome.tabs.MutedInfo;
  favIconUrl?: string;
  title?: string;
}

export interface CreateTabOptions {
  url: string;
  active?: boolean;
  pinned?: boolean;
  index?: number;
}

