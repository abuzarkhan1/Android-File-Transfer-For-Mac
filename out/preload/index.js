"use strict";
const electron = require("electron");
const api = {
  detectDevice: () => electron.ipcRenderer.invoke("mtp:detect"),
  listFiles: () => electron.ipcRenderer.invoke("mtp:list-files"),
  listFolderFiles: (parentId) => electron.ipcRenderer.invoke("mtp:list-folder-files", parentId),
  listFolders: () => electron.ipcRenderer.invoke("mtp:list-folders"),
  downloadFile: (fileId, fileName, destinationDir) => electron.ipcRenderer.invoke("mtp:download-file", fileId, fileName, destinationDir),
  uploadFile: (localPath, parentId) => electron.ipcRenderer.invoke("mtp:upload-file", localPath, parentId),
  selectLocalFolder: (currentPath) => electron.ipcRenderer.invoke("local:select-folder", currentPath),
  selectLocalFiles: () => electron.ipcRenderer.invoke("local:select-files"),
  mtpDelete: (fileId) => electron.ipcRenderer.invoke("mtp:delete", fileId),
  mtpCreateFolder: (name, parentId) => electron.ipcRenderer.invoke("mtp:create-folder", name, parentId),
  listLocalFiles: (localPath) => electron.ipcRenderer.invoke("local:list-files", localPath),
  createLocalFolder: (localPath, name) => electron.ipcRenderer.invoke("local:create-folder", localPath, name),
  deleteLocalFile: (localPath) => electron.ipcRenderer.invoke("local:delete-file", localPath),
  getLocalFileSize: (localPath) => electron.ipcRenderer.invoke("local:get-file-size", localPath),
  closeWindow: () => electron.ipcRenderer.send("window:close"),
  minimizeWindow: () => electron.ipcRenderer.send("window:minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window:maximize")
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
