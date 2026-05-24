import React from 'react'

export const ICONS = {
  folder: (
    <svg viewBox="0 0 28 22" fill="none" width="28" height="22">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3H9L11 5H24.5C25.33 5 26 5.67 26 6.5V7.5H2V4.5Z" fill="var(--folder-tab)"/>
      <path d="M2 7.5H26V18.5C26 19.33 25.33 20 24.5 20H3.5C2.67 20 2 19.33 2 18.5V7.5Z" fill="var(--folder-front)"/>
      <path d="M2 7H26" stroke="var(--folder-highlight)" strokeWidth="0.5" opacity="0.5"/>
    </svg>
  ),
  folderOpen: (
    <svg viewBox="0 0 28 22" fill="none" width="28" height="22">
      <path d="M2 4.5C2 3.67 2.67 3 3.5 3H9L11 5H24.5C25.33 5 26 5.67 26 6.5V7.5H2V4.5Z" fill="var(--folder-tab)"/>
      <path d="M1 9L4 20H24.5C25.33 20 26 19.33 26 18.5V9H1Z" fill="var(--folder-front)"/>
      <path d="M1 9H26" stroke="var(--folder-highlight)" strokeWidth="0.5" opacity="0.4"/>
    </svg>
  ),
  pdf: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#FF3B30" opacity="0.08"/>
      <rect x="8" y="12" width="12" height="2" rx="1" fill="#FF3B30" opacity="0.5"/>
      <rect x="8" y="16" width="10" height="2" rx="1" fill="#FF3B30" opacity="0.35"/>
      <rect x="8" y="20" width="8" height="2" rx="1" fill="#FF3B30" opacity="0.25"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#FF3B30" opacity="0.15"/>
      <text x="14" y="11" textAnchor="middle" fontSize="4.5" fontWeight="700" fill="#FF3B30" fontFamily="-apple-system,sans-serif">PDF</text>
    </svg>
  ),
  image: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#5AC8FA" opacity="0.06"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#5AC8FA" opacity="0.15"/>
      <circle cx="11" cy="13" r="3" fill="#FFCC00" opacity="0.7"/>
      <path d="M8 22L13 16L17 20L20 17L22 22H8Z" fill="#34C759" opacity="0.5"/>
    </svg>
  ),
  video: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#AF52DE" opacity="0.06"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#AF52DE" opacity="0.15"/>
      <circle cx="14" cy="17" r="5" fill="#AF52DE" opacity="0.15"/>
      <path d="M12.5 15L17 17.5L12.5 20V15Z" fill="#AF52DE" opacity="0.7"/>
    </svg>
  ),
  audio: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#FF2D55" opacity="0.06"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#FF2D55" opacity="0.15"/>
      <circle cx="11" cy="20" r="3" fill="#FF2D55" opacity="0.6"/>
      <path d="M14 20V10L20 8V18" stroke="#FF2D55" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <circle cx="20" cy="18" r="2.5" fill="#FF2D55" opacity="0.5"/>
    </svg>
  ),
  text: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#8E8E93" opacity="0.04"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#8E8E93" opacity="0.12"/>
      <rect x="8" y="12" width="12" height="1.5" rx="0.75" fill="#8E8E93" opacity="0.35"/>
      <rect x="8" y="16" width="10" height="1.5" rx="0.75" fill="#8E8E93" opacity="0.25"/>
      <rect x="8" y="20" width="7" height="1.5" rx="0.75" fill="#8E8E93" opacity="0.18"/>
    </svg>
  ),
  spreadsheet: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#34C759" opacity="0.06"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#34C759" opacity="0.15"/>
      <rect x="8" y="11" width="5" height="4" rx="0.5" fill="#34C759" opacity="0.2"/>
      <rect x="15" y="11" width="5" height="4" rx="0.5" fill="#34C759" opacity="0.12"/>
      <rect x="8" y="17" width="5" height="4" rx="0.5" fill="#34C759" opacity="0.12"/>
      <rect x="15" y="17" width="5" height="4" rx="0.5" fill="#34C759" opacity="0.2"/>
      <text x="14" y="10" textAnchor="middle" fontSize="3.5" fontWeight="700" fill="#34C759" fontFamily="-apple-system,sans-serif">XLS</text>
    </svg>
  ),
  presentation: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#FF9500" opacity="0.06"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#FF9500" opacity="0.15"/>
      <rect x="8" y="12" width="12" height="8" rx="1" fill="#FF9500" opacity="0.15"/>
      <rect x="10" y="14" width="4" height="4" rx="0.5" fill="#FF9500" opacity="0.4"/>
      <rect x="15" y="14" width="3" height="2" rx="0.3" fill="#FF9500" opacity="0.3"/>
      <rect x="15" y="17" width="3" height="1" rx="0.3" fill="#FF9500" opacity="0.2"/>
    </svg>
  ),
  archive: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#8E8E93" opacity="0.04"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#8E8E93" opacity="0.12"/>
      <rect x="11" y="11" width="6" height="12" rx="1" fill="#8E8E93" opacity="0.12"/>
      <rect x="12" y="12" width="4" height="2" rx="0.3" fill="#8E8E93" opacity="0.3"/>
      <rect x="12" y="15" width="4" height="2" rx="0.3" fill="#8E8E93" opacity="0.3"/>
      <rect x="12" y="18" width="4" height="2" rx="0.3" fill="#8E8E93" opacity="0.3"/>
      <circle cx="14" cy="22" r="1" fill="#8E8E93" opacity="0.4"/>
    </svg>
  ),
  code: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#5856D6" opacity="0.04"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#5856D6" opacity="0.12"/>
      <path d="M11 13L8 16L11 19" stroke="#5856D6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      <path d="M17 13L20 16L17 19" stroke="#5856D6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
      <path d="M15 12L13 20" stroke="#5856D6" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  apk: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#34C759" opacity="0.06"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#34C759" opacity="0.15"/>
      <circle cx="11" cy="13" r="1.2" fill="#34C759" opacity="0.6"/>
      <circle cx="17" cy="13" r="1.2" fill="#34C759" opacity="0.6"/>
      <path d="M9 11L7 7" stroke="#34C759" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M19 11L21 7" stroke="#34C759" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
      <path d="M9 16C9 18 11 20 14 20C17 20 19 18 19 16" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      <text x="14" y="24" textAnchor="middle" fontSize="3.5" fontWeight="700" fill="#34C759" fontFamily="-apple-system,sans-serif">APK</text>
    </svg>
  ),
  vcf: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#007AFF" opacity="0.06"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#007AFF" opacity="0.15"/>
      <circle cx="14" cy="13" r="3" fill="#007AFF" opacity="0.25"/>
      <path d="M8 22C8 19 10.5 17 14 17C17.5 17 20 19 20 22" stroke="#007AFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
    </svg>
  ),
  svg: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M4 2H18L24 8V26C24 27.1 23.1 28 22 28H6C4.9 28 4 27.1 4 26V2Z" fill="#FF2D55" opacity="0.04"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#FF2D55" opacity="0.12"/>
      <path d="M10 20L14 10L18 16L20 14" stroke="#FF2D55" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
    </svg>
  ),
  mac: (
    <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
      <rect x="1" y="1" width="16" height="11" rx="2" fill="#8E8E93" opacity="0.15" stroke="#8E8E93" strokeWidth="0.8"/>
      <rect x="3" y="3" width="12" height="7" rx="0.5" fill="#007AFF" opacity="0.2"/>
      <rect x="6" y="12" width="6" height="2" rx="0.5" fill="#8E8E93" opacity="0.15"/>
      <rect x="4" y="14" width="10" height="1.5" rx="0.75" fill="#8E8E93" opacity="0.15"/>
    </svg>
  ),
  android: (
    <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
      <circle cx="9" cy="6" r="4" fill="#34C759" opacity="0.2"/>
      <circle cx="7.5" cy="5.5" r="0.6" fill="#34C759" opacity="0.5"/>
      <circle cx="10.5" cy="5.5" r="0.6" fill="#34C759" opacity="0.5"/>
      <path d="M5 8C5 11 7 13 9 13C11 13 13 11 13 8" stroke="#34C759" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
      <path d="M6 3L5 1" stroke="#34C759" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
      <path d="M12 3L13 1" stroke="#34C759" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
    </svg>
  ),
  generic: (
    <svg viewBox="0 0 28 28" fill="none" width="28" height="28">
      <rect x="4" y="2" width="20" height="24" rx="2" fill="white" stroke="#E5E5EA" strokeWidth="0.5"/>
      <path d="M18 2L24 8H20C18.9 8 18 7.1 18 6V2Z" fill="#8E8E93" opacity="0.1"/>
      <rect x="8" y="13" width="12" height="1.5" rx="0.75" fill="#C7C7CC" opacity="0.5"/>
      <rect x="8" y="17" width="9" height="1.5" rx="0.75" fill="#C7C7CC" opacity="0.35"/>
      <rect x="8" y="21" width="6" height="1.5" rx="0.75" fill="#C7C7CC" opacity="0.25"/>
    </svg>
  ),
  arrowDown: (
    <svg viewBox="0 0 22 22" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" width="22" height="22">
      <path d="M11 4v12M6 12l5 5 5-5"/>
    </svg>
  ),
  arrowUp: (
    <svg viewBox="0 0 22 22" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" width="22" height="22">
      <path d="M11 18V6M6 10l5-5 5 5"/>
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" width="14" height="14">
      <path d="M7 2v10M2 7h10"/>
    </svg>
  ),
  up: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" width="14" height="14">
      <path d="M7 11V3M3 7l4-4 4 4"/>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" width="14" height="14">
      <path d="M2 7a5 5 0 019 0 5 5 0 01-9 0"/>
      <path d="M11 2v3h-3"/>
    </svg>
  ),
  emptyFolder: (
    <svg viewBox="0 0 56 44" fill="none" opacity="0.35" width="56" height="44">
      <path d="M4 9C4 7.34 5.34 6 7 6H18L22 10H49C50.66 10 52 11.34 52 13V15H4V9Z" fill="var(--folder-tab)"/>
      <path d="M4 15H52V37C52 38.66 50.66 40 49 40H7C5.34 40 4 38.66 4 37V15Z" fill="var(--folder-front)"/>
    </svg>
  ),
}

export function getFileIcon(type: string, name?: string): React.ReactNode {
  const fileType = (type || '').toUpperCase()
  const fileName = (name || '').toUpperCase()
  
  if (fileType === 'FOLDER' || fileType === 'ASSOCIATION') {
    return ICONS.folder
  }
  
  const extMap: Record<string, keyof typeof ICONS> = {
    PDF: 'pdf',
    JPG: 'image',
    JPEG: 'image',
    PNG: 'image',
    GIF: 'image',
    WEBP: 'image',
    MP4: 'video',
    MOV: 'video',
    AVI: 'video',
    MKV: 'video',
    MP3: 'audio',
    WAV: 'audio',
    M4A: 'audio',
    FLAC: 'audio',
    TXT: 'text',
    DOC: 'text',
    DOCX: 'text',
    RTF: 'text',
    XLS: 'spreadsheet',
    XLSX: 'spreadsheet',
    CSV: 'spreadsheet',
    PPT: 'presentation',
    PPTX: 'presentation',
    ZIP: 'archive',
    RAR: 'archive',
    '7Z': 'archive',
    TAR: 'archive',
    GZ: 'archive',
    JSON: 'code',
    JS: 'code',
    TS: 'code',
    JSX: 'code',
    TSX: 'code',
    HTML: 'code',
    CSS: 'code',
    PY: 'code',
    SH: 'code',
    GO: 'code',
    APK: 'apk',
    VCF: 'vcf',
    SVG: 'svg'
  }

  // Fallback by extension parsing from name
  if (fileName) {
    const ext = fileName.split('.').pop() || ''
    if (ext && extMap[ext]) {
      return ICONS[extMap[ext]]
    }
  }

  return ICONS[extMap[fileType]] || ICONS.generic
}
