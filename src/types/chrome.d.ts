// Chrome Extension API type augmentations
declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: chrome.tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      tlsChannelId?: string;
    }

    interface Port {
      name: string;
      disconnect(): void;
      postMessage(message: any): void;
      onDisconnect: {
        addListener(callback: (port: Port) => void): void;
        removeListener(callback: (port: Port) => void): void;
      };
      onMessage: {
        addListener(callback: (message: any, port: Port) => void): void;
        removeListener(callback: (message: any, port: Port) => void): void;
      };
    }
  }

  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | { [key: string]: any } | null): Promise<{ [key: string]: any }>;
      set(items: { [key: string]: any }): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }
  }
}

