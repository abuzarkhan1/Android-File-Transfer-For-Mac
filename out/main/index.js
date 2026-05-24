"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const util = require("util");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const os__namespace = /* @__PURE__ */ _interopNamespaceDefault(os);
const execFileAsync = util.promisify(child_process.execFile);
class MtpCommandQueue {
  queue = [];
  isProcessing = false;
  run(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;
      try {
        const result = await item.task();
        item.resolve(result);
      } catch (err) {
        item.reject(err);
      }
    }
    this.isProcessing = false;
  }
}
const mtpQueue = new MtpCommandQueue();
const bin = (name) => {
  const candidates = [
    process.env.MTP_BIN_DIR ? path__namespace.join(process.env.MTP_BIN_DIR, name) : "",
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    name
  ].filter(Boolean);
  return candidates.find((candidate) => {
    if (!candidate.includes("/")) return true;
    return fs__namespace.existsSync(candidate);
  }) || name;
};
const adbBin = () => {
  const candidates = [
    process.env.ADB_BIN || "",
    process.env.ANDROID_HOME ? path__namespace.join(process.env.ANDROID_HOME, "platform-tools", "adb") : "",
    process.env.ANDROID_SDK_ROOT ? path__namespace.join(process.env.ANDROID_SDK_ROOT, "platform-tools", "adb") : "",
    path__namespace.join(os__namespace.homedir(), "Library/Android/sdk/platform-tools/adb"),
    "/opt/homebrew/bin/adb",
    "/usr/local/bin/adb",
    "adb"
  ].filter(Boolean);
  return candidates.find((candidate) => {
    if (!candidate.includes("/")) return true;
    return fs__namespace.existsSync(candidate);
  }) || "adb";
};
const safeLog = (msg) => {
  try {
    process.stderr.write(`[MTP] ${msg}
`);
  } catch {
  }
};
const compactOutput = (stdout, stderr) => [stdout, stderr].filter(Boolean).join("\n");
const fileTypeFromName = (name, isFolder = false) => {
  if (isFolder) return "Folder";
  const ext = path__namespace.extname(name).replace(".", "").trim();
  return ext ? ext.toUpperCase() : "Unknown";
};
const looksLikeFileName = (name) => /\.[^./\s]{1,10}$/.test(name);
const parseMtpFileTree = (output) => {
  const nodes = [];
  const parentIdByLevel = [];
  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^attempting to connect/i.test(trimmed) || /^device:/i.test(trimmed) || /^storage:/i.test(trimmed) || /^ok\.?$/i.test(trimmed) || /^libmtp/i.test(trimmed) || /raw devices found/i.test(trimmed)) {
      continue;
    }
    const match = line.match(/^(\s*)(\d+)\s+(.+?)\s*$/);
    if (!match) continue;
    const [, indentation, id, rawName] = match;
    const level = Math.floor(indentation.replace(/\t/g, "  ").length / 2);
    const parentId = level > 0 ? parentIdByLevel[level - 1] || "" : "";
    const name = rawName.trim();
    nodes.push({
      id,
      name,
      size: 0,
      type: fileTypeFromName(name),
      parentId,
      isFolder: false,
      level
    });
    parentIdByLevel[level] = id;
    parentIdByLevel.length = level + 1;
  }
  const parentIds = new Set(nodes.map((node) => node.parentId).filter(Boolean));
  return nodes.map(({ level: _level, ...node }) => {
    const isFolder = parentIds.has(node.id) || !looksLikeFileName(node.name);
    return {
      ...node,
      type: fileTypeFromName(node.name, isFolder),
      isFolder,
      size: isFolder ? 0 : node.size
    };
  });
};
const parseStorageName = (output) => {
  const match = output.match(/^Storage:\s*(.+)$/im);
  return match?.[1]?.trim() || "";
};
const ADB_ROOT = "/storage/emulated/0";
const ADB_ID_PREFIX = "adb:";
const adbId = (remotePath) => `${ADB_ID_PREFIX}${remotePath}`;
const isAdbId = (id) => Boolean(id?.startsWith(ADB_ID_PREFIX));
const adbPathFromId = (id) => id?.startsWith(ADB_ID_PREFIX) ? id.slice(ADB_ID_PREFIX.length) : "";
const shellQuote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;
const normalizeRemotePath = (remotePath) => {
  const normalized = remotePath.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || ADB_ROOT;
};
const shouldHideRemotePath = (remotePath) => {
  if (remotePath === ADB_ROOT) return false;
  return path__namespace.posix.basename(remotePath).startsWith(".");
};
class MtpService {
  // ── Execute a CLI command safely with timeout ──────────────────────────────
  static async execFile(command, args = [], timeoutMs = 6e4) {
    safeLog(`run: ${command} ${args.join(" ")}`);
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024
      });
      return {
        stdout: stdout || "",
        stderr: stderr || ""
      };
    } catch (error) {
      const timedOut = error?.killed === true || error?.signal === "SIGTERM" || /timed out/i.test(error?.message || "");
      return {
        stdout: error?.stdout || "",
        stderr: error?.stderr || error?.message || "",
        timedOut
      };
    }
  }
  static async ensureAdbDevice() {
    await this.execFile(adbBin(), ["start-server"], 8e3);
    const devices = await this.execFile(adbBin(), ["devices", "-l"], 6e3);
    const devicesOutput = compactOutput(devices.stdout, devices.stderr).trim();
    const deviceLines = devices.stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^list of devices/i.test(line));
    if (deviceLines.some((line) => /\sdevice(\s|$)/.test(line))) {
      return { success: true };
    }
    if (/unauthorized/i.test(devicesOutput)) {
      return {
        success: false,
        error: "USB debugging is waiting for approval. Unlock the phone and tap Allow on the RSA prompt."
      };
    }
    if (/offline/i.test(devicesOutput)) {
      return {
        success: false,
        error: "USB debugging sees the phone as offline. Reconnect the USB cable, unlock the phone, then tap Allow."
      };
    }
    return {
      success: false,
      error: devicesOutput || "USB debugging is not visible to this Mac. Enable Developer options > USB debugging, reconnect, then tap Allow on the phone."
    };
  }
  static async listAdbTree(includeFiles) {
    const state = await this.ensureAdbDevice();
    if (!state.success) {
      return state;
    }
    const command = includeFiles ? `find ${shellQuote(ADB_ROOT)} -type d 2>/dev/null; echo __WIREDTRANSFER_FILES__; find ${shellQuote(ADB_ROOT)} -type f 2>/dev/null` : `find ${shellQuote(ADB_ROOT)} -type d 2>/dev/null`;
    const { stdout, stderr, timedOut } = await this.execFile(
      adbBin(),
      ["shell", command],
      includeFiles ? 12e4 : 45e3
    );
    if (timedOut) {
      return {
        success: false,
        error: "ADB file scan timed out. Reconnect the phone and try again."
      };
    }
    const combined = compactOutput(stdout, stderr);
    if (/permission denied/i.test(combined) && !stdout.trim()) {
      return {
        success: false,
        error: "Android denied file listing. Unlock the phone and confirm USB debugging access."
      };
    }
    const [folderOutput, fileOutput = ""] = stdout.split("__WIREDTRANSFER_FILES__");
    const folderList = Array.from(
      new Set(
        folderOutput.split(/\r?\n/).map((line) => normalizeRemotePath(line.trim())).filter((line) => line === ADB_ROOT || line.startsWith(`${ADB_ROOT}/`)).filter((line) => !shouldHideRemotePath(line))
      )
    ).sort((a, b) => a.localeCompare(b));
    const fileList = includeFiles ? Array.from(
      new Set(
        fileOutput.split(/\r?\n/).map((line) => normalizeRemotePath(line.trim())).filter((line) => line.startsWith(`${ADB_ROOT}/`)).filter((line) => !shouldHideRemotePath(line))
      )
    ).sort((a, b) => a.localeCompare(b)) : [];
    if (!folderList.includes(ADB_ROOT)) {
      folderList.unshift(ADB_ROOT);
    }
    const folderPaths = /* @__PURE__ */ new Set();
    const filePaths = new Set(fileList);
    for (const remotePath of folderList) {
      folderPaths.add(remotePath);
    }
    for (const remotePath of filePaths) {
      folderPaths.add(path__namespace.posix.dirname(remotePath));
    }
    const entries = [];
    for (const folderPath of Array.from(folderPaths).sort((a, b) => a.localeCompare(b))) {
      const isRoot = folderPath === ADB_ROOT;
      entries.push({
        id: adbId(folderPath),
        name: isRoot ? "Internal Storage" : path__namespace.posix.basename(folderPath),
        size: 0,
        type: "Folder",
        parentId: isRoot ? "" : adbId(path__namespace.posix.dirname(folderPath)),
        isFolder: true
      });
    }
    if (includeFiles) {
      for (const filePath of Array.from(filePaths).sort((a, b) => a.localeCompare(b))) {
        entries.push({
          id: adbId(filePath),
          name: path__namespace.posix.basename(filePath),
          size: 0,
          type: fileTypeFromName(filePath),
          parentId: adbId(path__namespace.posix.dirname(filePath)),
          isFolder: false
        });
      }
    }
    return {
      success: true,
      files: entries
    };
  }
  static async listAdbFolderFiles(parentId) {
    const parentPath = normalizeRemotePath(adbPathFromId(parentId) || ADB_ROOT);
    const state = await this.ensureAdbDevice();
    if (!state.success) {
      return state;
    }
    const command = `find ${shellQuote(parentPath)} -maxdepth 1 -mindepth 1 -type f 2>/dev/null`;
    const { stdout, stderr, timedOut } = await this.execFile(
      adbBin(),
      ["shell", command],
      15e3
    );
    if (timedOut) {
      return {
        success: false,
        error: "Folder file listing timed out. Reconnect the phone and try again."
      };
    }
    const combined = compactOutput(stdout, stderr);
    if (/permission denied/i.test(combined) && !stdout.trim()) {
      return {
        success: false,
        error: "Android denied file listing. Unlock the phone and confirm USB debugging access."
      };
    }
    const files = Array.from(
      new Set(
        stdout.split(/\r?\n/).map((line) => normalizeRemotePath(line.trim())).filter((line) => line.startsWith(`${ADB_ROOT}/`)).filter((line) => !shouldHideRemotePath(line))
      )
    ).sort((a, b) => a.localeCompare(b)).map((filePath) => ({
      id: adbId(filePath),
      name: path__namespace.posix.basename(filePath),
      size: 0,
      type: fileTypeFromName(filePath),
      parentId: adbId(path__namespace.posix.dirname(filePath)),
      isFolder: false
    }));
    return {
      success: true,
      files
    };
  }
  static async runAdbTransfer(args, timeoutMs = 12e4) {
    const state = await this.ensureAdbDevice();
    if (!state.success) {
      return {
        success: false,
        error: state.error
      };
    }
    const { stdout, stderr, timedOut } = await this.execFile(adbBin(), args, timeoutMs);
    const combined = compactOutput(stdout, stderr);
    if (timedOut) {
      return {
        success: false,
        error: "ADB operation timed out. Reconnect the phone and try again."
      };
    }
    if (/error|failed|no devices|unauthorized|offline/i.test(combined)) {
      return {
        success: false,
        error: combined || "ADB operation failed."
      };
    }
    return {
      success: true
    };
  }
  // ── Detect connected MTP device ───────────────────────────────────────────
  static async detectDevice() {
    return mtpQueue.run(async () => {
      const { stdout, stderr, timedOut } = await this.execFile(
        bin("mtp-detect"),
        [],
        1e4
      );
      const combined = compactOutput(stdout, stderr);
      if (timedOut) {
        return {
          success: false,
          error: "Device detection timed out. Unlock your phone, select File Transfer mode, then try again."
        };
      }
      if (/no raw devices found/i.test(combined)) {
        return {
          success: false,
          error: 'No Android device found. Plug in your phone and select "File Transfer" (MTP) mode.'
        };
      }
      if (/device is locked/i.test(combined)) {
        return {
          success: false,
          error: "Phone is locked. Unlock your screen and try again."
        };
      }
      let manufacturer = "";
      let model = "";
      let storageDescription = "";
      let storageCapacity = 0;
      let storageFree = 0;
      for (const line of combined.split("\n")) {
        if (/manufacturer:/i.test(line)) {
          manufacturer = line.split(":").slice(1).join(":").trim();
        }
        if (/^\s*model:/i.test(line)) {
          model = line.split(":").slice(1).join(":").trim();
        }
        if (/storagedescription:/i.test(line)) {
          storageDescription = line.split(":").slice(1).join(":").trim();
        }
        if (/maxcapacity:/i.test(line)) {
          storageCapacity = Number(line.split(":").slice(1).join(":").trim()) || 0;
        }
        if (/freespaceinbytes:/i.test(line)) {
          storageFree = Number(line.split(":").slice(1).join(":").trim()) || 0;
        }
      }
      const deviceName = [manufacturer, model].filter(Boolean).join(" ") || "Android Device";
      const storageUsedPercentage = storageCapacity > 0 ? Math.max(
        0,
        Math.min(100, Math.round((storageCapacity - storageFree) / storageCapacity * 100))
      ) : 0;
      if (/libmtp version|vendor:/i.test(stdout) || manufacturer || model) {
        return {
          success: true,
          deviceName,
          storageDescription,
          storageCapacity,
          storageFree,
          storageUsedPercentage
        };
      }
      return {
        success: false,
        error: 'Device found but could not read its name. Ensure "File Transfer" mode is active.'
      };
    });
  }
  // ── List folders only — fast initial load ─────────────────────────────────
  static async listFolders() {
    return mtpQueue.run(async () => {
      const adbFirst = await this.listAdbTree(false);
      if (adbFirst.success && adbFirst.files && adbFirst.files.length > 0) {
        safeLog(`using ADB for folder listing (${adbFirst.files.length} folders)`);
        return {
          success: true,
          folders: adbFirst.files,
          storageRootId: adbId(ADB_ROOT),
          storageName: "Internal Storage"
        };
      }
      const { stdout, stderr, timedOut } = await this.execFile(
        bin("mtp-folders"),
        [],
        2e4
      );
      const combined = compactOutput(stdout, stderr);
      if (timedOut) {
        return {
          success: false,
          error: "Folder listing timed out. Reconnect the phone and try again."
        };
      }
      if (/no raw devices found/i.test(combined)) {
        return {
          success: false,
          error: "No Android device connected."
        };
      }
      if (/device is locked/i.test(combined)) {
        return {
          success: false,
          error: "Device is locked. Please unlock your screen."
        };
      }
      const folders = [];
      let storageRootId = "";
      let storageName = "";
      let adbFallbackError = "";
      const parentIdByLevel = [];
      const storageMatch = combined.match(/storage\s+(0x[0-9a-f]+|\d+)/i);
      if (storageMatch) {
        const raw = storageMatch[1];
        storageRootId = raw.startsWith("0x") ? String(parseInt(raw, 16)) : raw;
      }
      for (const line of combined.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || /^listing folders/i.test(trimmed) || /^device /i.test(trimmed) || /^storage id/i.test(trimmed) || /^libmtp/i.test(trimmed)) {
          continue;
        }
        const storageNameMatch = trimmed.match(/^Storage:\s*(.+)$/i);
        if (storageNameMatch) {
          storageName = storageNameMatch[1].trim();
          parentIdByLevel.length = 0;
          continue;
        }
        const treeMatch = line.match(/^(\d+)\t( *)(.+)$/);
        if (treeMatch) {
          const [, id, indentation, rawName] = treeMatch;
          const level = Math.floor(indentation.length / 2);
          const parentId = level > 0 ? parentIdByLevel[level - 1] || "" : "";
          folders.push({
            id,
            name: rawName.trim(),
            size: 0,
            type: "Folder",
            parentId,
            isFolder: true
          });
          parentIdByLevel[level] = id;
          parentIdByLevel.length = level + 1;
          continue;
        }
        const matchA = trimmed.match(/^(.+?)\s+\(id=(\d+),\s*parent=(\d+)\)/);
        if (matchA) {
          const [, name, id, parentId] = matchA;
          folders.push({
            id,
            name: name.trim(),
            size: 0,
            type: "Folder",
            parentId,
            isFolder: true
          });
          continue;
        }
        const matchB = trimmed.match(
          /Folder ID:\s*(\d+).*?Name:\s*(.+?),.*?Parent:\s*(\d+)/i
        );
        if (matchB) {
          const [, id, name, parentId] = matchB;
          folders.push({
            id,
            name: name.trim(),
            size: 0,
            type: "Folder",
            parentId,
            isFolder: true
          });
        }
      }
      if (folders.length === 0) {
        const fallback = await this.execFile(bin("mtp-filetree"), [], 9e4);
        const fallbackOutput = compactOutput(fallback.stdout, fallback.stderr);
        if (fallback.timedOut) {
          safeLog("mtp-filetree fallback timed out after mtp-folders returned no folders");
        } else if (/no raw devices found|no devices/i.test(fallbackOutput)) {
          return {
            success: false,
            error: "No Android device connected."
          };
        } else if (/device is locked/i.test(fallbackOutput)) {
          return {
            success: false,
            error: "Device is locked. Please unlock your screen."
          };
        } else {
          const fallbackItems = parseMtpFileTree(fallbackOutput);
          const fallbackFolders = fallbackItems.filter((item) => item.isFolder);
          if (fallbackFolders.length > 0) {
            return {
              success: true,
              folders: fallbackFolders,
              storageRootId,
              storageName: storageName || parseStorageName(fallbackOutput)
            };
          }
          safeLog(
            `folder scan returned 0 folders. mtp-folders sample: ${combined.slice(0, 1200).replace(/\s+/g, " ")}`
          );
          safeLog(
            `mtp-filetree fallback returned 0 folders. sample: ${fallbackOutput.slice(0, 1200).replace(/\s+/g, " ")}`
          );
        }
      }
      if (folders.length === 0) {
        const adbFallback = await this.listAdbTree(false);
        if (adbFallback.success && adbFallback.files && adbFallback.files.length > 0) {
          safeLog(`using ADB fallback for folder listing (${adbFallback.files.length} folders)`);
          return {
            success: true,
            folders: adbFallback.files,
            storageRootId: adbId(ADB_ROOT),
            storageName: "Internal Storage"
          };
        }
        if (adbFallback.error) {
          adbFallbackError = adbFallback.error;
          safeLog(`ADB folder fallback unavailable: ${adbFallback.error}`);
        }
      }
      if (folders.length === 0 && /get storage information failed|LIBMTP_Get_Storage|could not get object handles/i.test(
        combined
      )) {
        return {
          success: false,
          error: `Your phone is connected, but this Xiaomi MTP session is refusing file enumeration. ${adbFallbackError ? `ADB fallback could not start: ${adbFallbackError}` : "Enable USB debugging on the phone, authorize this Mac, then press Refresh."}`
        };
      }
      return {
        success: true,
        folders,
        storageRootId,
        storageName
      };
    });
  }
  // ── List all files flat — slow manual scan ────────────────────────────────
  static async listFiles() {
    return mtpQueue.run(async () => {
      const adbFirst = await this.listAdbTree(true);
      if (adbFirst.success && adbFirst.files && adbFirst.files.length > 0) {
        safeLog(`using ADB for file listing (${adbFirst.files.length} items)`);
        return {
          success: true,
          files: adbFirst.files.reverse()
        };
      }
      const { stdout, stderr, timedOut } = await this.execFile(
        bin("mtp-files"),
        [],
        9e4
      );
      const combined = compactOutput(stdout, stderr);
      if (timedOut) {
        return {
          success: false,
          error: "Full file scan took too long. Try reconnecting your phone or scanning again after opening File Transfer mode."
        };
      }
      if (/no raw devices found/i.test(combined)) {
        return {
          success: false,
          error: "No Android device connected. Please reconnect the USB cable."
        };
      }
      if (/device is locked/i.test(combined)) {
        return {
          success: false,
          error: "Device is locked. Please unlock your screen."
        };
      }
      const files = [];
      let cur = {};
      let adbFallbackError = "";
      const push = (f) => {
        if (!f.id || !f.name) return;
        const typeLower = (f.type || "").toLowerCase();
        const isFolder = /folder|association/.test(typeLower);
        f.isFolder = isFolder;
        f.type = isFolder ? "Folder" : f.type || "Unknown";
        if (isFolder) {
          f.size = 0;
        }
        files.push(f);
      };
      for (const line of combined.split("\n")) {
        const t = line.trim();
        const lo = t.toLowerCase();
        if (/^file id[\s:]/.test(lo)) {
          push(cur);
          const parts = t.split(/id:?\s+/i);
          cur = {
            id: parts[1]?.trim()
          };
        } else if (/^filename[\s:]/.test(lo)) {
          cur.name = t.split(/filename:?\s+/i)[1]?.trim() || "Unnamed";
        } else if (/^file size[\s:]/.test(lo)) {
          const clean = t.replace(/:/g, "").replace(/\s+/g, " ");
          cur.size = parseInt(clean.split(" ")[2]) || 0;
        } else if (/^filetype[\s:]/.test(lo)) {
          cur.type = t.split(/filetype:?\s+/i)[1]?.trim() || "Unknown";
        } else if (/^parent id[\s:]/.test(lo)) {
          cur.parentId = t.split(/id:?\s+/i)[1]?.trim();
        }
      }
      push(cur);
      if (files.length === 0) {
        const fallback = await this.execFile(bin("mtp-filetree"), [], 9e4);
        const fallbackOutput = compactOutput(fallback.stdout, fallback.stderr);
        if (fallback.timedOut) {
          safeLog("mtp-filetree fallback timed out after mtp-files returned no files");
        } else if (/no raw devices found|no devices/i.test(fallbackOutput)) {
          return {
            success: false,
            error: "No Android device connected. Please reconnect the USB cable."
          };
        } else if (/device is locked/i.test(fallbackOutput)) {
          return {
            success: false,
            error: "Device is locked. Please unlock your screen."
          };
        } else {
          const fallbackItems = parseMtpFileTree(fallbackOutput);
          if (fallbackItems.length > 0) {
            return {
              success: true,
              files: fallbackItems.reverse()
            };
          }
          safeLog(
            `file scan returned 0 files. mtp-files sample: ${combined.slice(0, 1200).replace(/\s+/g, " ")}`
          );
          safeLog(
            `mtp-filetree fallback returned 0 items. sample: ${fallbackOutput.slice(0, 1200).replace(/\s+/g, " ")}`
          );
        }
      }
      if (files.length === 0) {
        const adbFallback = await this.listAdbTree(true);
        if (adbFallback.success && adbFallback.files && adbFallback.files.length > 0) {
          safeLog(`using ADB fallback for file listing (${adbFallback.files.length} items)`);
          return {
            success: true,
            files: adbFallback.files.reverse()
          };
        }
        if (adbFallback.error) {
          adbFallbackError = adbFallback.error;
          safeLog(`ADB file fallback unavailable: ${adbFallback.error}`);
        }
      }
      if (files.length === 0 && /get storage information failed|LIBMTP_Get_Storage|could not get object handles/i.test(
        combined
      )) {
        return {
          success: false,
          error: `Your phone is connected, but this Xiaomi MTP session is refusing file enumeration. ${adbFallbackError ? `ADB fallback could not start: ${adbFallbackError}` : "Enable USB debugging on the phone, authorize this Mac, then scan again."}`
        };
      }
      return {
        success: true,
        files: files.reverse()
      };
    });
  }
  static async listFolderFiles(parentId) {
    return mtpQueue.run(async () => {
      if (isAdbId(parentId) || !parentId) {
        return this.listAdbFolderFiles(parentId);
      }
      const all = await this.listFiles();
      if (!all.success) {
        return all;
      }
      return {
        success: true,
        files: (all.files || []).filter(
          (file) => file.parentId === parentId && !file.isFolder
        )
      };
    });
  }
  // ── Download file from Android to Mac ─────────────────────────────────────
  static async downloadFile(fileId, fileName, destinationDir) {
    return mtpQueue.run(async () => {
      const localPath = path__namespace.join(destinationDir, fileName);
      if (isAdbId(fileId)) {
        const remotePath = adbPathFromId(fileId);
        const result = await this.runAdbTransfer(
          ["pull", remotePath, localPath],
          12e4
        );
        return result.success ? {
          success: true,
          path: localPath
        } : result;
      }
      const { stdout, stderr, timedOut } = await this.execFile(
        bin("mtp-getfile"),
        [fileId, localPath],
        12e4
      );
      if (timedOut) {
        return {
          success: false,
          error: "Download timed out. Reconnect your phone and try again."
        };
      }
      const hasError = /error sending|no mtp device|failed to send|object not found|access denied|error/i.test(
        stdout + stderr
      );
      if (hasError) {
        return {
          success: false,
          error: `Download failed: ${stderr || stdout || "Unknown MTP error"}`
        };
      }
      return {
        success: true,
        path: localPath
      };
    });
  }
  // ── Upload file from Mac to Android ───────────────────────────────────────
  static async uploadFile(localFilePath, parentId) {
    return mtpQueue.run(async () => {
      const fileName = path__namespace.basename(localFilePath);
      if (isAdbId(parentId)) {
        const parentPath = adbPathFromId(parentId) || ADB_ROOT;
        const remotePath = normalizeRemotePath(
          path__namespace.posix.join(parentPath, fileName)
        );
        const result = await this.runAdbTransfer(
          ["push", localFilePath, remotePath],
          12e4
        );
        return result.success ? {
          success: true,
          fileName
        } : result;
      }
      const args = [localFilePath, parentId || "0"];
      const { stdout, stderr, timedOut } = await this.execFile(
        bin("mtp-sendfile"),
        args,
        12e4
      );
      if (timedOut) {
        return {
          success: false,
          error: "Upload timed out. Reconnect your phone and try again."
        };
      }
      const hasError = /error sending|no mtp device|failed to send|object not found|access denied|error/i.test(
        stdout + stderr
      );
      if (hasError) {
        return {
          success: false,
          error: `Upload failed: ${stderr || stdout || "Unknown MTP error"}`
        };
      }
      return {
        success: true,
        fileName
      };
    });
  }
  // ── Delete file or folder on Android ──────────────────────────────────────
  static async deleteFile(fileId) {
    return mtpQueue.run(async () => {
      if (isAdbId(fileId)) {
        return this.runAdbTransfer(
          ["shell", `rm -rf ${shellQuote(adbPathFromId(fileId))}`],
          3e4
        );
      }
      let result = await this.execFile(bin("mtp-delfile"), ["-n", fileId], 3e4);
      if (/error|failed/i.test(result.stderr + result.stdout)) {
        result = await this.execFile(bin("mtp-delfile"), [fileId], 3e4);
      }
      if (result.timedOut) {
        return {
          success: false,
          error: "Delete timed out. Reconnect your phone and try again."
        };
      }
      if (/error|failed/i.test(result.stderr + result.stdout)) {
        return {
          success: false,
          error: `Deletion failed: ${result.stderr || result.stdout}`
        };
      }
      return {
        success: true
      };
    });
  }
  // ── Create folder on Android ──────────────────────────────────────────────
  static async createFolder(name, parentId) {
    return mtpQueue.run(async () => {
      if (isAdbId(parentId)) {
        const parentPath = adbPathFromId(parentId) || ADB_ROOT;
        const remotePath = normalizeRemotePath(path__namespace.posix.join(parentPath, name));
        return this.runAdbTransfer(
          ["shell", `mkdir -p ${shellQuote(remotePath)}`],
          3e4
        );
      }
      const args = [name, parentId || "0", "0"];
      const { stdout, stderr, timedOut } = await this.execFile(
        bin("mtp-newfolder"),
        args,
        15e3
      );
      if (timedOut) {
        return {
          success: false,
          error: "Folder creation timed out. Reconnect your phone and try again."
        };
      }
      if (/error|failed/i.test(stderr + stdout)) {
        return {
          success: false,
          error: `Folder creation failed: ${stderr || stdout}`
        };
      }
      return {
        success: true
      };
    });
  }
}
let mainWindow = null;
electron.app.commandLine.appendSwitch("disable-background-networking");
electron.app.commandLine.appendSwitch("disable-component-update");
electron.app.commandLine.appendSwitch("disable-domain-reliability");
electron.app.commandLine.appendSwitch("disable-features", "CertificateTransparencyComponentUpdater");
electron.app.commandLine.appendSwitch("log-level", "3");
process.env.PAGER = "cat";
process.env.NO_COLOR = "1";
const getAppIconPath = () => {
  const candidates = [
    path.join(__dirname, "../../build/icon.png"),
    path.join(process.resourcesPath || "", "icon.png")
  ];
  return candidates.find((candidate) => fs__namespace.existsSync(candidate));
};
function createWindow() {
  const iconPath = getAppIconPath();
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    icon: iconPath,
    backgroundColor: "#1C1C1E",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
const resolveHomePath = (inputPath) => {
  if (inputPath === "~") {
    return os__namespace.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os__namespace.homedir(), inputPath.slice(2));
  }
  return inputPath;
};
const formatBytes = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};
const buildLocalFile = (fullPath) => {
  const stat = fs__namespace.statSync(fullPath);
  const isFolder = stat.isDirectory();
  const name = path.basename(fullPath);
  const ext = name.split(".").pop()?.toLowerCase() || "";
  let icon = isFolder ? "📁" : "📄";
  if (!isFolder) {
    if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) {
      icon = "🖼️";
    } else if (["mp4", "mkv", "avi", "mov", "3gp"].includes(ext)) {
      icon = "🎬";
    } else if (["mp3", "wav", "m4a", "flac"].includes(ext)) {
      icon = "🎵";
    } else if (["pdf", "docx", "xlsx", "pptx", "txt"].includes(ext)) {
      icon = "📝";
    } else if (["zip", "rar", "tar", "gz"].includes(ext)) {
      icon = "🗜️";
    } else if (["apk"].includes(ext)) {
      icon = "📦";
    }
  }
  return {
    name,
    size: isFolder ? "--" : formatBytes(stat.size),
    sizeBytes: stat.size,
    type: isFolder ? "Folder" : ext.toUpperCase() || "Unknown",
    icon,
    isFolder,
    date: stat.mtime.toLocaleDateString(),
    path: fullPath
  };
};
electron.app.whenReady().then(() => {
  const iconPath = getAppIconPath();
  if (process.platform === "darwin" && iconPath) {
    electron.app.dock?.setIcon(electron.nativeImage.createFromPath(iconPath));
  }
  electron.ipcMain.handle("mtp:detect", async () => {
    try {
      return await MtpService.detectDevice();
    } catch (err) {
      return {
        success: false,
        error: err.message || "MTP Device Detection Error"
      };
    }
  });
  electron.ipcMain.handle("mtp:list-files", async () => {
    try {
      return await MtpService.listFiles();
    } catch (err) {
      return {
        success: false,
        error: err.message || "MTP Listing Error"
      };
    }
  });
  electron.ipcMain.handle("mtp:list-folder-files", async (_event, parentId) => {
    try {
      return await MtpService.listFolderFiles(parentId);
    } catch (err) {
      return {
        success: false,
        error: err.message || "MTP Folder File Listing Error"
      };
    }
  });
  electron.ipcMain.handle("mtp:list-folders", async () => {
    try {
      return await MtpService.listFolders();
    } catch (err) {
      return {
        success: false,
        error: err.message || "MTP Folder Listing Error"
      };
    }
  });
  electron.ipcMain.handle(
    "mtp:download-file",
    async (_event, fileId, fileName, providedDestinationDir) => {
      if (!mainWindow) {
        return {
          success: false,
          error: "Window context missing."
        };
      }
      try {
        const destinationDir = resolveHomePath(
          providedDestinationDir || path.join(os__namespace.homedir(), "Downloads")
        );
        if (!fs__namespace.existsSync(destinationDir)) {
          fs__namespace.mkdirSync(destinationDir, { recursive: true });
        }
        if (!fs__namespace.statSync(destinationDir).isDirectory()) {
          return {
            success: false,
            error: `Download destination is not a folder: ${destinationDir}`
          };
        }
        return await MtpService.downloadFile(fileId, fileName, destinationDir);
      } catch (err) {
        return {
          success: false,
          error: err.message || "MTP Download Error"
        };
      }
    }
  );
  electron.ipcMain.handle(
    "mtp:upload-file",
    async (_event, providedPath, parentId) => {
      if (!mainWindow) {
        return {
          success: false,
          error: "Window context missing."
        };
      }
      try {
        let localFilePath = providedPath;
        if (!localFilePath) {
          const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
            title: "Select File to Upload to Android",
            buttonLabel: "Upload File",
            properties: ["openFile"]
          });
          if (canceled || filePaths.length === 0) {
            return {
              success: false,
              error: "Upload cancelled by user."
            };
          }
          localFilePath = filePaths[0];
        }
        localFilePath = resolveHomePath(localFilePath);
        if (!fs__namespace.existsSync(localFilePath)) {
          return {
            success: false,
            error: `File not found: ${localFilePath}`
          };
        }
        const stat = fs__namespace.statSync(localFilePath);
        if (stat.isDirectory()) {
          return {
            success: false,
            error: "Folder upload is not supported yet. Select a file."
          };
        }
        return await MtpService.uploadFile(localFilePath, parentId);
      } catch (err) {
        return {
          success: false,
          error: err.message || "MTP Upload Error"
        };
      }
    }
  );
  electron.ipcMain.handle("mtp:delete", async (_event, fileId) => {
    try {
      return await MtpService.deleteFile(fileId);
    } catch (err) {
      return {
        success: false,
        error: err.message || "Failed to delete remote file"
      };
    }
  });
  electron.ipcMain.handle(
    "mtp:create-folder",
    async (_event, name, parentId) => {
      try {
        return await MtpService.createFolder(name, parentId);
      } catch (err) {
        return {
          success: false,
          error: err.message || "Failed to create remote folder"
        };
      }
    }
  );
  electron.ipcMain.handle("local:list-files", async (_event, localPath) => {
    try {
      const targetPath = resolveHomePath(localPath);
      if (!fs__namespace.existsSync(targetPath)) {
        return {
          success: false,
          error: `Folder not found: ${targetPath}`
        };
      }
      if (!fs__namespace.statSync(targetPath).isDirectory()) {
        return {
          success: false,
          error: `Not a folder: ${targetPath}`
        };
      }
      const items = fs__namespace.readdirSync(targetPath);
      const fileList = [];
      for (const item of items) {
        if (item.startsWith(".")) continue;
        try {
          const fullPath = path.join(targetPath, item);
          fileList.push(buildLocalFile(fullPath));
        } catch {
        }
      }
      return {
        success: true,
        files: fileList,
        path: targetPath
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Failed to list local files"
      };
    }
  });
  electron.ipcMain.handle("local:select-folder", async (_event, currentPath) => {
    if (!mainWindow) {
      return {
        success: false,
        error: "Window context missing."
      };
    }
    try {
      const defaultPath = currentPath ? resolveHomePath(currentPath) : os__namespace.homedir();
      const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
        title: "Choose Mac Folder",
        buttonLabel: "Open Folder",
        defaultPath: fs__namespace.existsSync(defaultPath) ? defaultPath : os__namespace.homedir(),
        properties: ["openDirectory", "createDirectory"]
      });
      if (canceled || filePaths.length === 0) {
        return {
          success: false,
          error: "Folder selection cancelled."
        };
      }
      return {
        success: true,
        path: filePaths[0]
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Failed to choose folder"
      };
    }
  });
  electron.ipcMain.handle("local:select-files", async () => {
    if (!mainWindow) {
      return {
        success: false,
        error: "Window context missing."
      };
    }
    try {
      const { canceled, filePaths } = await electron.dialog.showOpenDialog(mainWindow, {
        title: "Select Files to Upload to Android",
        buttonLabel: "Upload",
        defaultPath: os__namespace.homedir(),
        properties: ["openFile", "multiSelections"]
      });
      if (canceled || filePaths.length === 0) {
        return {
          success: false,
          error: "Upload cancelled by user."
        };
      }
      return {
        success: true,
        files: filePaths.filter((filePath) => fs__namespace.existsSync(filePath) && fs__namespace.statSync(filePath).isFile()).map((filePath) => buildLocalFile(filePath))
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Failed to choose files"
      };
    }
  });
  electron.ipcMain.handle(
    "local:create-folder",
    async (_event, localPath, name) => {
      try {
        const targetPath = resolveHomePath(localPath);
        const folderPath = path.join(targetPath, name);
        if (!fs__namespace.existsSync(folderPath)) {
          fs__namespace.mkdirSync(folderPath);
        }
        return {
          success: true
        };
      } catch (err) {
        return {
          success: false,
          error: err.message || "Failed to create folder"
        };
      }
    }
  );
  electron.ipcMain.handle("local:delete-file", async (_event, localFilePath) => {
    try {
      const targetPath = resolveHomePath(localFilePath);
      if (fs__namespace.existsSync(targetPath)) {
        const stat = fs__namespace.statSync(targetPath);
        if (stat.isDirectory()) {
          fs__namespace.rmSync(targetPath, {
            recursive: true,
            force: true
          });
        } else {
          fs__namespace.unlinkSync(targetPath);
        }
      }
      return {
        success: true
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || "Failed to delete file"
      };
    }
  });
  electron.ipcMain.handle("local:get-file-size", async (_event, localFilePath) => {
    try {
      const targetPath = resolveHomePath(localFilePath);
      if (fs__namespace.existsSync(targetPath)) {
        const stat = fs__namespace.statSync(targetPath);
        return {
          success: true,
          sizeBytes: stat.size
        };
      }
      return {
        success: true,
        sizeBytes: 0
      };
    } catch (err) {
      return {
        success: false,
        sizeBytes: 0,
        error: err.message
      };
    }
  });
  electron.ipcMain.on("window:close", () => {
    if (mainWindow) mainWindow.close();
  });
  electron.ipcMain.on("window:minimize", () => {
    if (mainWindow) mainWindow.minimize();
  });
  electron.ipcMain.on("window:maximize", () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
