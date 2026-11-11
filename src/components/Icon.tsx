import React from 'react';
import {
  Bold, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Download, Eye, FileBraces, FilePlus, ImageUp, Italic, List, Lock, LockOpen, LucideIcon, Pencil, Plus, RefreshCw,
  TriangleAlert, Upload, X,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  bold: Bold,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  copy: Copy,
  download: Download,
  eye: Eye,
  'file-json': FileBraces,
  'file-plus': FilePlus,
  'image-up': ImageUp,
  italic: Italic,
  list: List,
  lock: Lock,
  'lock-open': LockOpen,
  pencil: Pencil,
  plus: Plus,
  'refresh-cw': RefreshCw,
  'triangle-alert': TriangleAlert,
  upload: Upload,
  x: X,
};

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
}

// Lucide at the Sallas stroke (1.5), inheriting the text colour.
const Icon: React.FC<IconProps> = ({ name, size = 16 }): JSX.Element => {
  const Svg = ICONS[name];
  return <Svg size={size} strokeWidth={1.5} aria-hidden="true" style={{ flex: 'none' }} />;
};

export default Icon;
