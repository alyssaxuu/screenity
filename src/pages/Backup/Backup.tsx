import React, { useState, useEffect, useRef } from "react";
import localforage from "localforage";
import type { ExtensionMessage } from "../../types/messaging";

// File System Access API types
interface FileSystemHandle {
  queryPermission(opts: {
    mode: "readwrite";
  }): Promise<"granted" | "denied" | "prompt">;
  requestPermission(opts: {
    mode: "readwrite";
  }): Promise<"granted" | "denied" | "prompt">;
}

interface FileSystemFileHandle extends FileSystemHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  getFileHandle(
    name: string,
    opts: { create: boolean }
  ): Promise<FileSystemFileHandle>;
  getDirectoryHandle(
    name: string,
    opts: { create: boolean }
  ): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string): Promise<void>;
  name: string;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface WindowWithDirectoryPicker extends Window {
  showDirectoryPicker?(options?: {
    startIn?: string;
    mode?: "readwrite";
  }): Promise<FileSystemDirectoryHandle>;
}

localforage.config({
  driver: localforage.INDEXEDDB,
  name: "screenity",
  version: 1,
});

const chunksStore = localforage.createInstance({
  name: "chunks",
});
const localDirectoryStore = localforage.createInstance({
  name: "localDirectory",
});

const Backup = () => {
  const [setupComplete, setSetupComplete] = useState(false);
  const writable = useRef<FileSystemWritableFileStream | null>(null);
  const request = useRef<ExtensionMessage | null>(null);
  const tabId = useRef<number | null>(null);
  const repeatRef = useRef(0);
  const [backupAgain, setBackupAgain] = useState(false);
  const backupRef = useRef(false);
  const writingFile = useRef(false);
  const titleRef = useRef<string | null>(null);
  const [override, setOverride] = useState(false);
  const waitWrite = useRef(false);
  const closeRequest = useRef(false);

  useEffect(() => {
    backupRef.current = backupAgain;
  }, [backupAgain]);

  const verifyFilePermissions = async (
    fileHandle: FileSystemHandle
  ): Promise<boolean> => {
    const opts = {
      mode: "readwrite",
    };
    const permission = await fileHandle.queryPermission({ mode: "readwrite" });
    if (permission === "granted") {
      return true;
    } else if (permission === "prompt") {
      chrome.runtime.sendMessage({ type: "focus-this-tab" });
      return false;
    } else if (
      (await fileHandle.requestPermission({ mode: "readwrite" })) === "granted"
    ) {
      chrome.runtime.sendMessage({ type: "focus-this-tab" });
      return true;
    } else {
      return false;
    }
  };

  const initLocalDirectory = async (
    directoryHandle: FileSystemDirectoryHandle,
    prompt = true
  ): Promise<void> => {
    const permissions = await verifyFilePermissions(directoryHandle);
    if (permissions) {
      let videoTitle = `Screenity video - ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      })}.webm`;

      videoTitle = videoTitle.replace(/:/g, "-");

      titleRef.current = videoTitle as string;

      const fileHandle = await directoryHandle.getFileHandle(videoTitle, {
        create: true,
      });
      writable.current = await fileHandle.createWritable();

      setSetupComplete(true);
      setBackupAgain(true);
      if (prompt) {
        chrome.storage.local.set({ backupSetup: true }).then(() => {
          chrome.runtime.sendMessage({
            type: "backup-created",
            request: request.current,
            tabId: tabId.current,
          });
        });
      }
      writingFile.current = true;
    } else if (repeatRef.current < 3) {
      chrome.runtime.sendMessage({ type: "focus-this-tab" });
      repeatRef.current = repeatRef.current + 1;
      localDirectoryStore.clear();

      localSaving(prompt);
    } else {
      alert(
        "Failed to set up local backup. Reach out to us at support@screenity.io for more help. You can still record your screen."
      );
      chrome.storage.local.set({ backup: false });
      chrome.runtime.sendMessage({
        type: "backup-created",
        request: request.current,
        tabId: tabId.current,
      });
      setOverride(true);
      window.close();
    }
  };

  const directoryPicker = async (prompt = true): Promise<void> => {
    chrome.runtime.sendMessage({ type: "focus-this-tab" });
    let directoryPicker: FileSystemDirectoryHandle | null = null;
    // Request access to create a file in a user-selected directory
    try {
      const win = window as WindowWithDirectoryPicker;
      if (!win.showDirectoryPicker) {
        throw new Error("showDirectoryPicker not available");
      }
      directoryPicker = await win.showDirectoryPicker({
        startIn: "videos",
        mode: "readwrite",
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (backupRef.current) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "backup-error",
          why: JSON.stringify(error),
        } as ExtensionMessage);
      }
      return;
    }
    // check if user cancelled the prompt
    if (!directoryPicker) {
      if (backupRef.current) {
        chrome.runtime.sendMessage({
          type: "recording-error",
          error: "backup-error",
          why: "User cancelled directory picker",
        } as ExtensionMessage);
      }
      return;
    }

    let directoryHandle = directoryPicker;

    if (directoryPicker.name === "Screenity Recordings") {
      directoryHandle = directoryPicker;
    } else {
      directoryHandle = await directoryPicker.getDirectoryHandle(
        "Screenity Recordings",
        { create: true }
      );
    }

    await localDirectoryStore.clear();
    await localDirectoryStore.setItem("directoryHandle", directoryHandle);

    initLocalDirectory(directoryHandle, prompt);
  };

  const localSaving = async (prompt = true): Promise<void> => {
    waitWrite.current = false;
    closeRequest.current = false;

    const nav = navigator;
    if (!nav.userActivation?.isActive) {
      chrome.runtime.sendMessage({ type: "focus-this-tab" });
      return;
    }

    if (!backupRef.current) {
      localDirectoryStore.clear();
    }

    const win = window as WindowWithDirectoryPicker;
    if ("showDirectoryPicker" in win && win.showDirectoryPicker) {
      localDirectoryStore
        .getItem("directoryHandle")
        .then(
          async (
            directory: { directoryHandle: FileSystemDirectoryHandle } | null
          ) => {
            if (directory) {
              try {
                const permissions = await verifyFilePermissions(
                  directory.directoryHandle
                );
                if (!permissions) {
                  directoryPicker(prompt);
                } else {
                  initLocalDirectory(directory.directoryHandle, prompt);
                }
              } catch (e) {
                localDirectoryStore.clear();
                directoryPicker(prompt);
              }
            } else {
              directoryPicker(prompt);
            }
          }
        );
    } else {
      alert(
        "Your browser doesn't support local backups. Reach out to us at support@screenity.io for more help. You can still record your screen."
      );
      chrome.storage.local.set({ backup: false });
      chrome.runtime.sendMessage({
        type: "backup-created",
        request: request.current,
        tabId: tabId.current,
      });
      setOverride(true);
      window.close();
    }
  };

  const writeFile = async (index: number): Promise<void> => {
    if (!writable.current) return;
    if (!writingFile.current) return;
    waitWrite.current = true;
    try {
      interface ChunkData {
        index: number;
        chunk: Blob;
      }
      const chunks: ChunkData[] = [];
      chunksStore
        .iterate((value: ChunkData) => {
          chunks.push(value);
        })
        .then(async () => {
          if (chunks && chunks.length > 0) {
            const chunk = chunks.find((chunk) => chunk.index === index);

            if (chunk && writable.current) {
              await writable.current.write(chunk.chunk);
              waitWrite.current = false;
              if (closeRequest.current && writable.current) {
                closeRequest.current = false;
                await writable.current.close();
              }
            } else {
              waitWrite.current = false;
              if (closeRequest.current && writable.current) {
                closeRequest.current = false;
                await writable.current.close();
              }
            }
          }
        });
    } catch {
      waitWrite.current = false;
      if (closeRequest.current && writable.current) {
        closeRequest.current = false;
        await writable.current.close();
      }
      chrome.storage.local.set({
        recording: false,
        restarting: false,
        tabRecordedID: null,
        memoryError: true,
      });
      chrome.runtime.sendMessage({ type: "stop-recording-tab" });
    }
  };

  // Delete the latest file saved in the local backup folder
  const deleteFile = async (restart: boolean | null = null): Promise<void> => {
    if (writingFile.current && writable.current) {
      await writable.current.close();
      writingFile.current = false;

      const directory = (await localDirectoryStore.getItem(
        "directoryHandle"
      )) as { directoryHandle: FileSystemDirectoryHandle } | null;
      if (directory && directory !== null && titleRef.current) {
        const permissions = await verifyFilePermissions(
          directory.directoryHandle
        );
        if (permissions) {
          await directory.directoryHandle.removeEntry(titleRef.current);
          if (restart) {
            localSaving(false);
          }
        } else if (restart) {
          localSaving(false);
        }
      }
    } else if (restart) {
      localSaving(false);
    }
  };

  const skipBackup = () => {
    chrome.storage.local.set({ backup: false });
    chrome.runtime.sendMessage({
      type: "backup-created",
      request: request.current,
      tabId: tabId.current,
    });
    setOverride(true);
    window.close();
  };

  const stopBackup = () => {
    chrome.storage.local.set({ backup: false });
    chrome.runtime.sendMessage({
      type: "stop-recording-tab-backup",
    });
    setOverride(true);
    window.close();
  };

  const checkBackupSetup = async () => {
    const { backupSetup } = await chrome.storage.local.get("backupSetup");
    if (backupSetup) {
      setBackupAgain(true);
    }
  };

  useEffect(() => {
    checkBackupSetup();
  }, []);

  const onMessage = (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): boolean | void => {
    if (message.type === "init-backup") {
      const initMessage = message as ExtensionMessage & {
        request: ExtensionMessage;
        tabId: number;
      };
      request.current = initMessage.request;
      tabId.current = initMessage.tabId;
      localSaving(true);
    } else if (message.type === "write-file") {
      const writeMessage = message as ExtensionMessage & { index: number };
      writeFile(writeMessage.index);
    } else if (message.type === "close-writable") {
      if (!waitWrite.current && writable.current) {
        writable.current.close();
      } else {
        closeRequest.current = true;
      }
    } else if (
      message.type === "discard-backup" ||
      message.type === "recording-error"
    ) {
      deleteFile(false);
    } else if (message.type === "discard-backup-restart") {
      deleteFile(true);
    } else if (message.type === "close-backup-tab") {
      setOverride(true);
      window.close();
    }
    return true;
  };
  const closeTab = () => {
    chrome.runtime.sendMessage({
      type: "stop-recording-tab-backup",
    });
    setOverride(true);
    window.close();
  };

  useEffect(() => {
    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return (
    <div className="setupBackground">
      {!setupComplete && !backupAgain && (
        <div className="setupContainer">
          <div className="setupImage">
            <img src={chrome.runtime.getURL("assets/helper/backup.png")} />
          </div>
          <div className="setupText">
            <div className="setupEmoji">💾</div>
            <div className="setupTitle">
              {chrome.i18n.getMessage("backupsTitle")}
            </div>
            <div className="setupDescription">
              {chrome.i18n.getMessage("backupsDescription1")}
              <br />
              {chrome.i18n.getMessage("backupsDescription2")}{" "}
              <a
                href="https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-backups-how-can-i-set-them-up/waYArvSwybZkJKKDdMXw1o"
                target="_blank"
              >
                {chrome.i18n.getMessage("learnMoreDot")}
              </a>
            </div>
            <div className="setupActions">
              <button
                className="setupButton"
                onClick={() => {
                  localSaving(true);
                }}
              >
                {chrome.i18n.getMessage("backupsSelectFolder")}
              </button>
              <button
                className="cancelButton"
                onClick={() => {
                  skipBackup();
                }}
              >
                {chrome.i18n.getMessage("backupsNotNow")}
              </button>
            </div>
          </div>
        </div>
      )}
      {setupComplete && (
        <div>
          <div className="middle-area">
            <img src={chrome.runtime.getURL("assets/backup-icon.svg")} />
            <div className="title">
              {chrome.i18n.getMessage("backupsOnTitle")}
            </div>
            <div className="subtitle">
              {chrome.i18n.getMessage("backupsOnDescription")}
            </div>

            <div
              className="button-stop"
              onClick={() => {
                closeTab();
              }}
            >
              {chrome.i18n.getMessage("backupsClose")}
            </div>
            <div
              className="button-cancel"
              onClick={() => {
                stopBackup();
              }}
            >
              {chrome.i18n.getMessage("backupsStop")}
            </div>
          </div>
        </div>
      )}
      {backupAgain && !setupComplete && (
        <div>
          <div className="middle-area">
            <img src={chrome.runtime.getURL("assets/backup-icon.svg")} />
            <div className="title">
              {chrome.i18n.getMessage("backupsConfirmTitle")}
            </div>
            <div className="subtitle">
              {chrome.i18n.getMessage("backupsConfirmDescription")}{" "}
              <a
                href="https://help.screenity.io/getting-started/77KizPC8MHVGfpKpqdux9D/what-are-backups-how-can-i-set-them-up/waYArvSwybZkJKKDdMXw1o"
                target="_blank"
              >
                {chrome.i18n.getMessage("learnMoreDot")}
              </a>
            </div>

            <div
              className="button-strong"
              onClick={() => {
                localSaving(true);
              }}
            >
              {chrome.i18n.getMessage("backupsConfirmAllow")}
            </div>
            <div
              className="button-cancel"
              onClick={() => {
                stopBackup();
              }}
            >
              {chrome.i18n.getMessage("backupsStop")}
            </div>
          </div>
        </div>
      )}
      <img
        className="setupLogo"
        src={chrome.runtime.getURL("assets/logo-text.svg")}
      />
      <style>
        {`
				body {
					overflow: hidden;
					margin: 0px;
					margin: 0;
	padding: 0;
	min-height: 100%;
		background-color: #F6F7FB!important;
		background: url('` +
          chrome.runtime.getURL("assets/helper/pattern-svg.svg") +
          `') repeat;
		background-size: 62px 23.5px;
		animation: moveBackground 138s linear infinite;
		transform: rotate(0deg);
				}

				.button-strong {
					padding: 10px 20px;
					background: #29292F;
					border-radius: 30px;
					color: #FFF;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					margin-top: 0px;
					margin-left: auto;
					margin-right: auto;
					z-index: 999999;
				}
				.button-stop {
					padding: 10px 20px;
					background: #FFF;
					border-radius: 30px;
					color: #29292F;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					margin-top: 0px;
					border: 1px solid #E8E8E8;
					margin-left: auto;
					margin-right: auto;
					z-index: 999999;
				}
				.button-cancel {
					padding: 10px 20px;
					border-radius: 30px;
					color: #6E7684;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					margin-top: 10px;
					margin-left: auto;
					margin-right: auto;
					z-index: 999999;
				}
				.wrap {
					position: absolute;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background-color: #F6F7FB;
				}
					.middle-area {
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						height: 100%;
						font-family: "Satoshi Medium", sans-serif;
					}
					.middle-area img {
						width: 40px;
						margin-bottom: 20px;
					}
					.title {
						font-size: 24px;
						font-weight: 700;
						color: #1A1A1A;
						margin-bottom: 14px;
						font-family: Satoshi-Medium, sans-serif;
					}
					.subtitle {
						font-size: 14px;
						font-weight: 400;
						color: #6E7684;
						margin-bottom: 24px;
						line-height: 1.6;
						font-family: Satoshi-Medium, sans-serif;
						width: 600px;
						text-align: center;
					}

				.setupInfo {
					margin-top: 20px;
				}
				a {
					text-decoration: none!important;
					color: #4C7DE2;
				}
				
				@keyframes moveBackground {
					0% {
						background-position: 0 0;
					}
					100% {
						background-position: 100% 0;
					}
				}

				.setupActions {
					margin-top: 28px;
					display: flex;
					justify-content: left;
					align-items: center;
					gap: 4px;
				}

				.setupButton {
					background-color: #29292F;
					border-radius: 30px;
					color: #FFF;
					text-align: center;
					padding-left: 24px;
					padding-right: 24px;
					padding-top: 12px;
					padding-bottom: 12px;
					cursor: pointer;
					text-decoration: none;
					outline: none;
					border: 0px;
					font-family: "Satoshi-Bold", sans-serif!important;
				}
				.setupButton:hover {
					background: #000!important;
				}

				.cancelButton {
					background-color: transparent;
					border-radius: 30px;
					color: #7D8490;
					font-family: "Satoshi-Bold", sans-serif!important;
					text-align: center;
					padding-left: 24px;
					padding-right: 24px;
					padding-top: 12px;
					padding-bottom: 12px;
					cursor: pointer;
					text-decoration: none;
					outline: none;
					border: 0px;
				}
				.cancelButton:hover {
					cursor: pointer;
					background: #F4F2F2!important;
				}


				.setupLogo {
					position: absolute;
					bottom: 30px;
					left: 0px;
					right: 0px;
					margin: auto;
					width: 120px;
				}


				.setupBackground {
					height: 100vh;
					width: 100vw;
					display: flex;
					justify-content: center;
					align-items: center;
				}

				.setupContainer {
					position: absolute;
					top: 0px;
					left: 0px;
					right: 0px;
					bottom: 0px;
					margin: auto;
					z-index: 999;
					display: flex;
					justify-content: center;
					align-items: center;
					width: 60%;
					height: fit-content;
					background-color: #fff;
					border-radius: 30px;
					padding: 50px 50px;
					gap: 80px;
					font-family: 'Satoshi-Medium', sans-serif;
				}

				.setupImage {
					width: 70%;
					display: flex;
					justify-content: center;
					align-items: center;
				}

				.setupImage img {
					width: 100%;
					border-radius: 30px;
				}

				.setupText {
					width: 50%;
					display: flex;
					flex-direction: column;
					justify-content: left;
					align-items: left;
					text-align: left;
				}

				.setupEmoji {
					font-size: 20px;
					margin-bottom: 10px;
				}

				.setupTitle {
					font-size: 20px;
					font-weight: bold;
					margin-bottom: 10px;
					color: #29292F;
					font-family: 'Satoshi-Bold', sans-serif!important;
					letter-spacing: -0.5px;
				}

				br {
					display: block;
					content: "";
					margin-top: 10px;
				}

				.setupDescription {
					display: flex;
					flex-direction: column;
					justify-content: center;
					align-items: left;
					margin-top: 10px;
					color: #6E7684;
					font-size: 14px;
					line-height: 1.6;
				}

				.setupDescription span {
					font-family: 'Satoshi-Bold', sans-serif!important;
					color: #29292F!important;
					display: contents!important;
				}

				.setupStep {
					margin-bottom: 10px;
					vertical-align: middle;
				}

				.setupStep span {
					align-items: center;
					justify-content: center;
					text-align: center;
					width: 20px;
					height: 20px;
					padding: 2px;
					border-radius: 30px;
					display: inline-flex;
					vertical-align: middle;
					margin-left: 3px;
					margin-right: 3px;
					background-color: #F4F2F2;
				}

				.setupStep img {
					width: 100%;
					text-align: center;
					display: block;
				}

				.center {
					text-align: center!important;
				}
				.setupText.center {
					width: auto!important;
				}
				.setupContainer.center {
					width: 40%!important;
				}
				
				@media only screen and (max-width: 800px) {
					.setupContainer {
						flex-direction: column;
						gap: 40px;

					}

					.setupText, .setupImage {
						width: 100%!important;
					}
				}

				@media only screen and (max-width: 500px) {
					.setupContainer {
						width: 80%!important;
						padding: 20px!important;
					}
					.setupTitle {
						font-size: 18px!important;
					}
					.setupDescription {
						font-size: 12px!important;
					}
					.setupStep {
						font-size: 12px!important;
					}
				}


				`}
      </style>
    </div>
  );
};

export default Backup;
