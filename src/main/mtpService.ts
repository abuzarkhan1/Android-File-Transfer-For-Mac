import { execFile } from 'child_process'
import { promisify } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import type { MtpFile } from './preload'

const execFileAsync = promisify(execFile)

// Strict Command Queue — prevents concurrent MTP commands which corrupt the USB connection
class MtpCommandQueue {
  private queue: {
    task: () => Promise<any>
    resolve: (v: any) => void
    reject: (e: any) => void
  }[] = []

  private isProcessing = false

  public run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject })
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessing) return

    this.isProcessing = true

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      if (!item) continue

      try {
        const result = await item.task()
        item.resolve(result)
      } catch (err) {
        item.reject(err)
      }
    }

    this.isProcessing = false
  }
}

export const mtpQueue = new MtpCommandQueue()

// Helper: resolve libmtp tools on Apple Silicon, Intel Homebrew, or PATH.
const bin = (name: string) => {
  const candidates = [
    process.env.MTP_BIN_DIR ? path.join(process.env.MTP_BIN_DIR, name) : '',
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    name,
  ].filter(Boolean)

  return candidates.find((candidate) => {
    if (!candidate.includes('/')) return true
    return fs.existsSync(candidate)
  }) || name
}

const adbBin = () => {
  const candidates = [
    process.env.ADB_BIN || '',
    process.env.ANDROID_HOME
      ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb')
      : '',
    process.env.ANDROID_SDK_ROOT
      ? path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb')
      : '',
    path.join(os.homedir(), 'Library/Android/sdk/platform-tools/adb'),
    '/opt/homebrew/bin/adb',
    '/usr/local/bin/adb',
    'adb',
  ].filter(Boolean)

  return candidates.find((candidate) => {
    if (!candidate.includes('/')) return true
    return fs.existsSync(candidate)
  }) || 'adb'
}

// Safe logger — never throws EPIPE on broken stdout pipe
const safeLog = (msg: string) => {
  try {
    process.stderr.write(`[MTP] ${msg}\n`)
  } catch {}
}

type TreeNode = MtpFile & {
  level: number
}

const compactOutput = (stdout: string, stderr: string) =>
  [stdout, stderr].filter(Boolean).join('\n')

const fileTypeFromName = (name: string, isFolder = false) => {
  if (isFolder) return 'Folder'

  const ext = path.extname(name).replace('.', '').trim()
  return ext ? ext.toUpperCase() : 'Unknown'
}

const looksLikeFileName = (name: string) => /\.[^./\s]{1,10}$/.test(name)

const parseMtpFileTree = (output: string): MtpFile[] => {
  const nodes: TreeNode[] = []
  const parentIdByLevel: string[] = []

  for (const line of output.split('\n')) {
    const trimmed = line.trim()

    if (
      !trimmed ||
      /^attempting to connect/i.test(trimmed) ||
      /^device:/i.test(trimmed) ||
      /^storage:/i.test(trimmed) ||
      /^ok\.?$/i.test(trimmed) ||
      /^libmtp/i.test(trimmed) ||
      /raw devices found/i.test(trimmed)
    ) {
      continue
    }

    const match = line.match(/^(\s*)(\d+)\s+(.+?)\s*$/)

    if (!match) continue

    const [, indentation, id, rawName] = match
    const level = Math.floor(indentation.replace(/\t/g, '  ').length / 2)
    const parentId = level > 0 ? parentIdByLevel[level - 1] || '' : ''
    const name = rawName.trim()

    nodes.push({
      id,
      name,
      size: 0,
      type: fileTypeFromName(name),
      parentId,
      isFolder: false,
      level,
    })

    parentIdByLevel[level] = id
    parentIdByLevel.length = level + 1
  }

  const parentIds = new Set(nodes.map((node) => node.parentId).filter(Boolean))

  return nodes.map(({ level: _level, ...node }) => {
    const isFolder = parentIds.has(node.id) || !looksLikeFileName(node.name)

    return {
      ...node,
      type: fileTypeFromName(node.name, isFolder),
      isFolder,
      size: isFolder ? 0 : node.size,
    }
  })
}

const parseStorageName = (output: string) => {
  const match = output.match(/^Storage:\s*(.+)$/im)
  return match?.[1]?.trim() || ''
}

const ADB_ROOT = '/storage/emulated/0'
const ADB_ID_PREFIX = 'adb:'

const adbId = (remotePath: string) => `${ADB_ID_PREFIX}${remotePath}`
const isAdbId = (id?: string) => Boolean(id?.startsWith(ADB_ID_PREFIX))
const adbPathFromId = (id?: string) =>
  id?.startsWith(ADB_ID_PREFIX) ? id.slice(ADB_ID_PREFIX.length) : ''

const shellQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

const normalizeRemotePath = (remotePath: string) => {
  const normalized = remotePath.replace(/\/+/g, '/').replace(/\/$/, '')
  return normalized || ADB_ROOT
}

const shouldHideRemotePath = (remotePath: string) => {
  if (remotePath === ADB_ROOT) return false
  return path.posix.basename(remotePath).startsWith('.')
}

export class MtpService {
  // ── Execute a CLI command safely with timeout ──────────────────────────────
  private static async execFile(
    command: string,
    args: string[] = [],
    timeoutMs = 60_000
  ): Promise<{ stdout: string; stderr: string; timedOut?: boolean }> {
    safeLog(`run: ${command} ${args.join(' ')}`)

    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        timeout: timeoutMs,
        maxBuffer: 64 * 1024 * 1024,
      })

      return {
        stdout: stdout || '',
        stderr: stderr || '',
      }
    } catch (error: any) {
      const timedOut =
        error?.killed === true ||
        error?.signal === 'SIGTERM' ||
        /timed out/i.test(error?.message || '')

      return {
        stdout: error?.stdout || '',
        stderr: error?.stderr || error?.message || '',
        timedOut,
      }
    }
  }

  private static async ensureAdbDevice(): Promise<{
    success: boolean
    error?: string
  }> {
    await this.execFile(adbBin(), ['start-server'], 8_000)

    const devices = await this.execFile(adbBin(), ['devices', '-l'], 6_000)
    const devicesOutput = compactOutput(devices.stdout, devices.stderr).trim()
    const deviceLines = devices.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !/^list of devices/i.test(line))

    if (deviceLines.some((line) => /\sdevice(\s|$)/.test(line))) {
      return { success: true }
    }

    if (/unauthorized/i.test(devicesOutput)) {
      return {
        success: false,
        error:
          'USB debugging is waiting for approval. Unlock the phone and tap Allow on the RSA prompt.',
      }
    }

    if (/offline/i.test(devicesOutput)) {
      return {
        success: false,
        error:
          'USB debugging sees the phone as offline. Reconnect the USB cable, unlock the phone, then tap Allow.',
      }
    }

    return {
      success: false,
      error:
        devicesOutput ||
        'USB debugging is not visible to this Mac. Enable Developer options > USB debugging, reconnect, then tap Allow on the phone.',
    }
  }

  private static async listAdbTree(
    includeFiles: boolean
  ): Promise<{ success: boolean; files?: MtpFile[]; error?: string }> {
    const state = await this.ensureAdbDevice()

    if (!state.success) {
      return state
    }

    const command = includeFiles
      ? `find ${shellQuote(ADB_ROOT)} -type d 2>/dev/null; echo __WIREDTRANSFER_FILES__; find ${shellQuote(ADB_ROOT)} -type f 2>/dev/null`
      : `find ${shellQuote(ADB_ROOT)} -type d 2>/dev/null`
    const { stdout, stderr, timedOut } = await this.execFile(
      adbBin(),
      ['shell', command],
      includeFiles ? 120_000 : 45_000
    )

    if (timedOut) {
      return {
        success: false,
        error: 'ADB file scan timed out. Reconnect the phone and try again.',
      }
    }

    const combined = compactOutput(stdout, stderr)

    if (/permission denied/i.test(combined) && !stdout.trim()) {
      return {
        success: false,
        error:
          'Android denied file listing. Unlock the phone and confirm USB debugging access.',
      }
    }

    const [folderOutput, fileOutput = ''] = stdout.split('__WIREDTRANSFER_FILES__')

    const folderList = Array.from(
      new Set(
        folderOutput
          .split(/\r?\n/)
          .map((line) => normalizeRemotePath(line.trim()))
          .filter((line) => line === ADB_ROOT || line.startsWith(`${ADB_ROOT}/`))
          .filter((line) => !shouldHideRemotePath(line))
      )
    ).sort((a, b) => a.localeCompare(b))

    const fileList = includeFiles
      ? Array.from(
          new Set(
            fileOutput
              .split(/\r?\n/)
              .map((line) => normalizeRemotePath(line.trim()))
              .filter((line) => line.startsWith(`${ADB_ROOT}/`))
              .filter((line) => !shouldHideRemotePath(line))
          )
        ).sort((a, b) => a.localeCompare(b))
      : []

    if (!folderList.includes(ADB_ROOT)) {
      folderList.unshift(ADB_ROOT)
    }

    const folderPaths = new Set<string>()
    const filePaths = new Set(fileList)

    for (const remotePath of folderList) {
      folderPaths.add(remotePath)
    }

    for (const remotePath of filePaths) {
      folderPaths.add(path.posix.dirname(remotePath))
    }

    const entries: MtpFile[] = []

    for (const folderPath of Array.from(folderPaths).sort((a, b) => a.localeCompare(b))) {
      const isRoot = folderPath === ADB_ROOT

      entries.push({
        id: adbId(folderPath),
        name: isRoot ? 'Internal Storage' : path.posix.basename(folderPath),
        size: 0,
        type: 'Folder',
        parentId: isRoot ? '' : adbId(path.posix.dirname(folderPath)),
        isFolder: true,
      })
    }

    if (includeFiles) {
      for (const filePath of Array.from(filePaths).sort((a, b) => a.localeCompare(b))) {
        entries.push({
          id: adbId(filePath),
          name: path.posix.basename(filePath),
          size: 0,
          type: fileTypeFromName(filePath),
          parentId: adbId(path.posix.dirname(filePath)),
          isFolder: false,
        })
      }
    }

    return {
      success: true,
      files: entries,
    }
  }

  private static async listAdbFolderFiles(
    parentId?: string
  ): Promise<{ success: boolean; files?: MtpFile[]; error?: string }> {
    const parentPath = normalizeRemotePath(adbPathFromId(parentId) || ADB_ROOT)
    const state = await this.ensureAdbDevice()

    if (!state.success) {
      return state
    }

    const command = `find ${shellQuote(parentPath)} -maxdepth 1 -mindepth 1 -type f 2>/dev/null`
    const { stdout, stderr, timedOut } = await this.execFile(
      adbBin(),
      ['shell', command],
      15_000
    )

    if (timedOut) {
      return {
        success: false,
        error: 'Folder file listing timed out. Reconnect the phone and try again.',
      }
    }

    const combined = compactOutput(stdout, stderr)

    if (/permission denied/i.test(combined) && !stdout.trim()) {
      return {
        success: false,
        error:
          'Android denied file listing. Unlock the phone and confirm USB debugging access.',
      }
    }

    const files = Array.from(
      new Set(
        stdout
          .split(/\r?\n/)
          .map((line) => normalizeRemotePath(line.trim()))
          .filter((line) => line.startsWith(`${ADB_ROOT}/`))
          .filter((line) => !shouldHideRemotePath(line))
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .map((filePath) => ({
        id: adbId(filePath),
        name: path.posix.basename(filePath),
        size: 0,
        type: fileTypeFromName(filePath),
        parentId: adbId(path.posix.dirname(filePath)),
        isFolder: false,
      }))

    return {
      success: true,
      files,
    }
  }

  private static async runAdbTransfer(args: string[], timeoutMs = 120_000) {
    const state = await this.ensureAdbDevice()

    if (!state.success) {
      return {
        success: false,
        error: state.error,
      }
    }

    const { stdout, stderr, timedOut } = await this.execFile(adbBin(), args, timeoutMs)
    const combined = compactOutput(stdout, stderr)

    if (timedOut) {
      return {
        success: false,
        error: 'ADB operation timed out. Reconnect the phone and try again.',
      }
    }

    if (/error|failed|no devices|unauthorized|offline/i.test(combined)) {
      return {
        success: false,
        error: combined || 'ADB operation failed.',
      }
    }

    return {
      success: true,
    }
  }

  // ── Detect connected MTP device ───────────────────────────────────────────
  public static async detectDevice(): Promise<{
    success: boolean
    deviceName?: string
    storageDescription?: string
    storageCapacity?: number
    storageFree?: number
    storageUsedPercentage?: number
    error?: string
  }> {
    return mtpQueue.run(async () => {
      const { stdout, stderr, timedOut } = await this.execFile(
        bin('mtp-detect'),
        [],
        10_000
      )

      const combined = compactOutput(stdout, stderr)

      if (timedOut) {
        return {
          success: false,
          error:
            'Device detection timed out. Unlock your phone, select File Transfer mode, then try again.',
        }
      }

      if (/no raw devices found/i.test(combined)) {
        return {
          success: false,
          error:
            'No Android device found. Plug in your phone and select "File Transfer" (MTP) mode.',
        }
      }

      if (/device is locked/i.test(combined)) {
        return {
          success: false,
          error: 'Phone is locked. Unlock your screen and try again.',
        }
      }

      let manufacturer = ''
      let model = ''
      let storageDescription = ''
      let storageCapacity = 0
      let storageFree = 0

      for (const line of combined.split('\n')) {
        if (/manufacturer:/i.test(line)) {
          manufacturer = line.split(':').slice(1).join(':').trim()
        }

        if (/^\s*model:/i.test(line)) {
          model = line.split(':').slice(1).join(':').trim()
        }

        if (/storagedescription:/i.test(line)) {
          storageDescription = line.split(':').slice(1).join(':').trim()
        }

        if (/maxcapacity:/i.test(line)) {
          storageCapacity = Number(line.split(':').slice(1).join(':').trim()) || 0
        }

        if (/freespaceinbytes:/i.test(line)) {
          storageFree = Number(line.split(':').slice(1).join(':').trim()) || 0
        }
      }

      const deviceName =
        [manufacturer, model].filter(Boolean).join(' ') || 'Android Device'

      const storageUsedPercentage =
        storageCapacity > 0
          ? Math.max(
              0,
              Math.min(100, Math.round(((storageCapacity - storageFree) / storageCapacity) * 100))
            )
          : 0

      if (/libmtp version|vendor:/i.test(stdout) || manufacturer || model) {
        return {
          success: true,
          deviceName,
          storageDescription,
          storageCapacity,
          storageFree,
          storageUsedPercentage,
        }
      }

      return {
        success: false,
        error:
          'Device found but could not read its name. Ensure "File Transfer" mode is active.',
      }
    })
  }

  // ── List folders only — fast initial load ─────────────────────────────────
  public static async listFolders(): Promise<{
    success: boolean
    folders?: MtpFile[]
    storageRootId?: string
    storageName?: string
    error?: string
  }> {
    return mtpQueue.run(async () => {
      const adbFirst = await this.listAdbTree(false)

      if (adbFirst.success && adbFirst.files && adbFirst.files.length > 0) {
        safeLog(`using ADB for folder listing (${adbFirst.files.length} folders)`)

        return {
          success: true,
          folders: adbFirst.files,
          storageRootId: adbId(ADB_ROOT),
          storageName: 'Internal Storage',
        }
      }

      const { stdout, stderr, timedOut } = await this.execFile(
        bin('mtp-folders'),
        [],
        20_000
      )

      const combined = compactOutput(stdout, stderr)

      if (timedOut) {
        return {
          success: false,
          error:
            'Folder listing timed out. Reconnect the phone and try again.',
        }
      }

      if (/no raw devices found/i.test(combined)) {
        return {
          success: false,
          error: 'No Android device connected.',
        }
      }

      if (/device is locked/i.test(combined)) {
        return {
          success: false,
          error: 'Device is locked. Please unlock your screen.',
        }
      }

      const folders: MtpFile[] = []
      let storageRootId = ''
      let storageName = ''
      let adbFallbackError = ''
      const parentIdByLevel: string[] = []

      const storageMatch = combined.match(/storage\s+(0x[0-9a-f]+|\d+)/i)

      if (storageMatch) {
        const raw = storageMatch[1]
        storageRootId = raw.startsWith('0x') ? String(parseInt(raw, 16)) : raw
      }

      for (const line of combined.split('\n')) {
        const trimmed = line.trim()

        if (
          !trimmed ||
          /^listing folders/i.test(trimmed) ||
          /^device /i.test(trimmed) ||
          /^storage id/i.test(trimmed) ||
          /^libmtp/i.test(trimmed)
        ) {
          continue
        }

        const storageNameMatch = trimmed.match(/^Storage:\s*(.+)$/i)

        if (storageNameMatch) {
          storageName = storageNameMatch[1].trim()
          parentIdByLevel.length = 0
          continue
        }

        const treeMatch = line.match(/^(\d+)\t( *)(.+)$/)

        if (treeMatch) {
          const [, id, indentation, rawName] = treeMatch
          const level = Math.floor(indentation.length / 2)
          const parentId = level > 0 ? parentIdByLevel[level - 1] || '' : ''

          folders.push({
            id,
            name: rawName.trim(),
            size: 0,
            type: 'Folder',
            parentId,
            isFolder: true,
          })

          parentIdByLevel[level] = id
          parentIdByLevel.length = level + 1
          continue
        }

        const matchA = trimmed.match(/^(.+?)\s+\(id=(\d+),\s*parent=(\d+)\)/)

        if (matchA) {
          const [, name, id, parentId] = matchA

          folders.push({
            id,
            name: name.trim(),
            size: 0,
            type: 'Folder',
            parentId,
            isFolder: true,
          })

          continue
        }

        const matchB = trimmed.match(
          /Folder ID:\s*(\d+).*?Name:\s*(.+?),.*?Parent:\s*(\d+)/i
        )

        if (matchB) {
          const [, id, name, parentId] = matchB

          folders.push({
            id,
            name: name.trim(),
            size: 0,
            type: 'Folder',
            parentId,
            isFolder: true,
          })
        }
      }

      if (folders.length === 0) {
        const fallback = await this.execFile(bin('mtp-filetree'), [], 90_000)
        const fallbackOutput = compactOutput(fallback.stdout, fallback.stderr)

        if (fallback.timedOut) {
          safeLog('mtp-filetree fallback timed out after mtp-folders returned no folders')
        } else if (/no raw devices found|no devices/i.test(fallbackOutput)) {
          return {
            success: false,
            error: 'No Android device connected.',
          }
        } else if (/device is locked/i.test(fallbackOutput)) {
          return {
            success: false,
            error: 'Device is locked. Please unlock your screen.',
          }
        } else {
          const fallbackItems = parseMtpFileTree(fallbackOutput)
          const fallbackFolders = fallbackItems.filter((item) => item.isFolder)

          if (fallbackFolders.length > 0) {
            return {
              success: true,
              folders: fallbackFolders,
              storageRootId,
              storageName: storageName || parseStorageName(fallbackOutput),
            }
          }

          safeLog(
            `folder scan returned 0 folders. mtp-folders sample: ${combined
              .slice(0, 1200)
              .replace(/\s+/g, ' ')}`
          )
          safeLog(
            `mtp-filetree fallback returned 0 folders. sample: ${fallbackOutput
              .slice(0, 1200)
              .replace(/\s+/g, ' ')}`
          )
        }
      }

      if (folders.length === 0) {
        const adbFallback = await this.listAdbTree(false)

        if (adbFallback.success && adbFallback.files && adbFallback.files.length > 0) {
          safeLog(`using ADB fallback for folder listing (${adbFallback.files.length} folders)`)

          return {
            success: true,
            folders: adbFallback.files,
            storageRootId: adbId(ADB_ROOT),
            storageName: 'Internal Storage',
          }
        }

        if (adbFallback.error) {
          adbFallbackError = adbFallback.error
          safeLog(`ADB folder fallback unavailable: ${adbFallback.error}`)
        }
      }

      if (
        folders.length === 0 &&
        /get storage information failed|LIBMTP_Get_Storage|could not get object handles/i.test(
          combined
        )
      ) {
        return {
          success: false,
          error: `Your phone is connected, but this Xiaomi MTP session is refusing file enumeration. ${
            adbFallbackError
              ? `ADB fallback could not start: ${adbFallbackError}`
              : 'Enable USB debugging on the phone, authorize this Mac, then press Refresh.'
          }`,
        }
      }

      return {
        success: true,
        folders,
        storageRootId,
        storageName,
      }
    })
  }

  // ── List all files flat — slow manual scan ────────────────────────────────
  public static async listFiles(): Promise<{
    success: boolean
    files?: MtpFile[]
    error?: string
  }> {
    return mtpQueue.run(async () => {
      const adbFirst = await this.listAdbTree(true)

      if (adbFirst.success && adbFirst.files && adbFirst.files.length > 0) {
        safeLog(`using ADB for file listing (${adbFirst.files.length} items)`)

        return {
          success: true,
          files: adbFirst.files.reverse(),
        }
      }

      const { stdout, stderr, timedOut } = await this.execFile(
        bin('mtp-files'),
        [],
        90_000
      )

      const combined = compactOutput(stdout, stderr)

      if (timedOut) {
        return {
          success: false,
          error:
            'Full file scan took too long. Try reconnecting your phone or scanning again after opening File Transfer mode.',
        }
      }

      if (/no raw devices found/i.test(combined)) {
        return {
          success: false,
          error: 'No Android device connected. Please reconnect the USB cable.',
        }
      }

      if (/device is locked/i.test(combined)) {
        return {
          success: false,
          error: 'Device is locked. Please unlock your screen.',
        }
      }

      const files: MtpFile[] = []
      let cur: Partial<MtpFile> = {}
      let adbFallbackError = ''

      const push = (f: Partial<MtpFile>) => {
        if (!f.id || !f.name) return

        const typeLower = (f.type || '').toLowerCase()
        const isFolder = /folder|association/.test(typeLower)

        f.isFolder = isFolder
        f.type = isFolder ? 'Folder' : f.type || 'Unknown'

        if (isFolder) {
          f.size = 0
        }

        files.push(f as MtpFile)
      }

      for (const line of combined.split('\n')) {
        const t = line.trim()
        const lo = t.toLowerCase()

        if (/^file id[\s:]/.test(lo)) {
          push(cur)

          const parts = t.split(/id:?\s+/i)

          cur = {
            id: parts[1]?.trim(),
          }
        } else if (/^filename[\s:]/.test(lo)) {
          cur.name = t.split(/filename:?\s+/i)[1]?.trim() || 'Unnamed'
        } else if (/^file size[\s:]/.test(lo)) {
          const clean = t.replace(/:/g, '').replace(/\s+/g, ' ')
          cur.size = parseInt(clean.split(' ')[2]) || 0
        } else if (/^filetype[\s:]/.test(lo)) {
          cur.type = t.split(/filetype:?\s+/i)[1]?.trim() || 'Unknown'
        } else if (/^parent id[\s:]/.test(lo)) {
          cur.parentId = t.split(/id:?\s+/i)[1]?.trim()
        }
      }

      push(cur)

      if (files.length === 0) {
        const fallback = await this.execFile(bin('mtp-filetree'), [], 90_000)
        const fallbackOutput = compactOutput(fallback.stdout, fallback.stderr)

        if (fallback.timedOut) {
          safeLog('mtp-filetree fallback timed out after mtp-files returned no files')
        } else if (/no raw devices found|no devices/i.test(fallbackOutput)) {
          return {
            success: false,
            error: 'No Android device connected. Please reconnect the USB cable.',
          }
        } else if (/device is locked/i.test(fallbackOutput)) {
          return {
            success: false,
            error: 'Device is locked. Please unlock your screen.',
          }
        } else {
          const fallbackItems = parseMtpFileTree(fallbackOutput)

          if (fallbackItems.length > 0) {
            return {
              success: true,
              files: fallbackItems.reverse(),
            }
          }

          safeLog(
            `file scan returned 0 files. mtp-files sample: ${combined
              .slice(0, 1200)
              .replace(/\s+/g, ' ')}`
          )
          safeLog(
            `mtp-filetree fallback returned 0 items. sample: ${fallbackOutput
              .slice(0, 1200)
              .replace(/\s+/g, ' ')}`
          )
        }
      }

      if (files.length === 0) {
        const adbFallback = await this.listAdbTree(true)

        if (adbFallback.success && adbFallback.files && adbFallback.files.length > 0) {
          safeLog(`using ADB fallback for file listing (${adbFallback.files.length} items)`)

          return {
            success: true,
            files: adbFallback.files.reverse(),
          }
        }

        if (adbFallback.error) {
          adbFallbackError = adbFallback.error
          safeLog(`ADB file fallback unavailable: ${adbFallback.error}`)
        }
      }

      if (
        files.length === 0 &&
        /get storage information failed|LIBMTP_Get_Storage|could not get object handles/i.test(
          combined
        )
      ) {
        return {
          success: false,
          error: `Your phone is connected, but this Xiaomi MTP session is refusing file enumeration. ${
            adbFallbackError
              ? `ADB fallback could not start: ${adbFallbackError}`
              : 'Enable USB debugging on the phone, authorize this Mac, then scan again.'
          }`,
        }
      }

      return {
        success: true,
        files: files.reverse(),
      }
    })
  }

  public static async listFolderFiles(
    parentId?: string
  ): Promise<{ success: boolean; files?: MtpFile[]; error?: string }> {
    return mtpQueue.run(async () => {
      if (isAdbId(parentId) || !parentId) {
        return this.listAdbFolderFiles(parentId)
      }

      const all = await this.listFiles()

      if (!all.success) {
        return all
      }

      return {
        success: true,
        files: (all.files || []).filter(
          (file) => file.parentId === parentId && !file.isFolder
        ),
      }
    })
  }

  // ── Download file from Android to Mac ─────────────────────────────────────
  public static async downloadFile(
    fileId: string,
    fileName: string,
    destinationDir: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    return mtpQueue.run(async () => {
      const localPath = path.join(destinationDir, fileName)

      if (isAdbId(fileId)) {
        const remotePath = adbPathFromId(fileId)
        const result = await this.runAdbTransfer(
          ['pull', remotePath, localPath],
          120_000
        )

        return result.success
          ? {
              success: true,
              path: localPath,
            }
          : result
      }

      const { stdout, stderr, timedOut } = await this.execFile(
        bin('mtp-getfile'),
        [fileId, localPath],
        120_000
      )

      if (timedOut) {
        return {
          success: false,
          error: 'Download timed out. Reconnect your phone and try again.',
        }
      }

      const hasError =
        /error sending|no mtp device|failed to send|object not found|access denied|error/i.test(
          stdout + stderr
        )

      if (hasError) {
        return {
          success: false,
          error: `Download failed: ${stderr || stdout || 'Unknown MTP error'}`,
        }
      }

      return {
        success: true,
        path: localPath,
      }
    })
  }

  // ── Upload file from Mac to Android ───────────────────────────────────────
  public static async uploadFile(
    localFilePath: string,
    parentId?: string
  ): Promise<{ success: boolean; fileName?: string; error?: string }> {
    return mtpQueue.run(async () => {
      const fileName = path.basename(localFilePath)

      if (isAdbId(parentId)) {
        const parentPath = adbPathFromId(parentId) || ADB_ROOT
        const remotePath = normalizeRemotePath(
          path.posix.join(parentPath, fileName)
        )
        const result = await this.runAdbTransfer(
          ['push', localFilePath, remotePath],
          120_000
        )

        return result.success
          ? {
              success: true,
              fileName,
            }
          : result
      }

      const args = [localFilePath, parentId || '0']

      const { stdout, stderr, timedOut } = await this.execFile(
        bin('mtp-sendfile'),
        args,
        120_000
      )

      if (timedOut) {
        return {
          success: false,
          error: 'Upload timed out. Reconnect your phone and try again.',
        }
      }

      const hasError =
        /error sending|no mtp device|failed to send|object not found|access denied|error/i.test(
          stdout + stderr
        )

      if (hasError) {
        return {
          success: false,
          error: `Upload failed: ${stderr || stdout || 'Unknown MTP error'}`,
        }
      }

      return {
        success: true,
        fileName,
      }
    })
  }

  // ── Delete file or folder on Android ──────────────────────────────────────
  public static async deleteFile(
    fileId: string
  ): Promise<{ success: boolean; error?: string }> {
    return mtpQueue.run(async () => {
      if (isAdbId(fileId)) {
        return this.runAdbTransfer(
          ['shell', `rm -rf ${shellQuote(adbPathFromId(fileId))}`],
          30_000
        )
      }

      let result = await this.execFile(bin('mtp-delfile'), ['-n', fileId], 30_000)

      if (/error|failed/i.test(result.stderr + result.stdout)) {
        result = await this.execFile(bin('mtp-delfile'), [fileId], 30_000)
      }

      if (result.timedOut) {
        return {
          success: false,
          error: 'Delete timed out. Reconnect your phone and try again.',
        }
      }

      if (/error|failed/i.test(result.stderr + result.stdout)) {
        return {
          success: false,
          error: `Deletion failed: ${result.stderr || result.stdout}`,
        }
      }

      return {
        success: true,
      }
    })
  }

  // ── Create folder on Android ──────────────────────────────────────────────
  public static async createFolder(
    name: string,
    parentId?: string
  ): Promise<{ success: boolean; error?: string }> {
    return mtpQueue.run(async () => {
      if (isAdbId(parentId)) {
        const parentPath = adbPathFromId(parentId) || ADB_ROOT
        const remotePath = normalizeRemotePath(path.posix.join(parentPath, name))

        return this.runAdbTransfer(
          ['shell', `mkdir -p ${shellQuote(remotePath)}`],
          30_000
        )
      }

      const args = [name, parentId || '0', '0']

      const { stdout, stderr, timedOut } = await this.execFile(
        bin('mtp-newfolder'),
        args,
        15_000
      )

      if (timedOut) {
        return {
          success: false,
          error: 'Folder creation timed out. Reconnect your phone and try again.',
        }
      }

      if (/error|failed/i.test(stderr + stdout)) {
        return {
          success: false,
          error: `Folder creation failed: ${stderr || stdout}`,
        }
      }

      return {
        success: true,
      }
    })
  }
}
