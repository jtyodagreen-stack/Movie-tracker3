import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Table,
  Accessibility,
  Palette,
  Database,
  BarChart3,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  Check,
  User,
  ShieldCheck,
  ExternalLink,
  Clock,
  Sparkles,
  WifiOff,
  Bell,
  Search,
  Unlink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  extractSpreadsheetId,
  findMatchingWishlistSheet,
  findMatchingMasterSheet,
  fetchSpreadsheetDetails,
} from '../services/sheetsService';
import { getAccessToken } from '../firebase';
import {
  getProfilePicture,
  getProfileDisplayName,
  getProfileEmail,
  GOOGLE_AVATAR_DATA_URI,
  DEFAULT_PROFILE_USER,
} from '../utils/userProfile';
import { ShowItem, AccessibilitySettings, AlertIntervals, PREDEFINED_ACCENT_THEMES } from '../types';
import { applyAccentTheme, getAccentTheme } from '../utils/themeManager';
import {
  PROFILE_COLOR_PALETTE,
  getViewerColor,
  getViewerColorName,
} from '../utils/profileColors';

interface SettingsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  // User Authentication
  user: FirebaseUser | null;
  onSignIn: (options?: { forceConsent?: boolean }) => any;
  onSignOut: () => void;
  // Google Sheets Sync
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  availableTabs?: string[];
  onConnect: (id: string, name: string, wishlistName?: string) => Promise<void>;
  onDisconnect: () => void;
  isSyncing: boolean;
  lastSyncedAt?: string;
  sheetTitle?: string;
  shows: ShowItem[];
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  syncFrequency?: number;
  onUpdateSyncFrequency?: (freq: number) => void;
  syncOnlyOnWifi?: boolean;
  onToggleSyncOnlyOnWifi?: (enabled: boolean) => void;
  onTriggerSync?: () => void;
  isOnline?: boolean;
  // Viewer Profile settings
  customViewers: string[];
  onUpdateCustomViewers: (viewers: string[], colors?: Record<string, string>) => void;
  viewerColors?: Record<string, string>;
  onUpdateViewerColors?: (colors: Record<string, string>) => void;
  activeProfile?: string;
  onSwitchProfile?: (profile: string) => void;
  // Alerts
  alertIntervals: AlertIntervals;
  onUpdateAlertIntervals: (intervals: AlertIntervals) => void;
  // Accessibility
  accessibilitySettings: AccessibilitySettings;
  setAccessibilitySettings: (settings: AccessibilitySettings) => void;
  defaultTab?: 'all' | 'user' | 'sync' | 'acc' | 'theme' | 'data' | 'help' | 'alerts' | 'stats';
  defaultHelpSubSection?: 'guide' | 'bug' | 'feedback' | 'support';
}

export default function SettingsCenterModal({
  isOpen,
  onClose,
  user,
  onSignIn,
  onSignOut,
  spreadsheetId,
  sheetName,
  wishlistSheetName = '📋  WISHLIST',
  availableTabs = [],
  onConnect,
  onDisconnect,
  isSyncing,
  lastSyncedAt,
  sheetTitle,
  shows,
  autoSyncEnabled = true,
  onToggleAutoSync,
  syncFrequency = 900,
  onUpdateSyncFrequency,
  syncOnlyOnWifi = false,
  onToggleSyncOnlyOnWifi,
  onTriggerSync,
  isOnline = true,
  customViewers,
  onUpdateCustomViewers,
  viewerColors = {},
  onUpdateViewerColors,
  activeProfile,
  onSwitchProfile,
  alertIntervals,
  onUpdateAlertIntervals,
  accessibilitySettings,
  setAccessibilitySettings,
  defaultTab = 'all',
  defaultHelpSubSection = 'guide',
}: SettingsCenterModalProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'user' | 'sync' | 'acc' | 'alerts' | 'data' | 'stats' | 'help'>(defaultTab === 'theme' ? 'alerts' : (defaultTab as any));

  // Resolved active accent theme
  const activeTheme = getAccentTheme(accessibilitySettings.accentColor);

  // Help & Support form state
  const [helpFirstName, setHelpFirstName] = useState('');
  const [helpLastName, setHelpLastName] = useState('');
  const [userIpAddress, setUserIpAddress] = useState('');
  const [helpMessage, setHelpMessage] = useState('');
  const [helpSubject, setHelpSubject] = useState('');
  const [helpSenderEmail, setHelpSenderEmail] = useState('');
  const [helpReportType, setHelpReportType] = useState<'bug' | 'feature' | 'feedback' | 'support'>(defaultHelpSubSection !== 'guide' ? defaultHelpSubSection : 'bug');
  const [helpSubSection, setHelpSubSection] = useState<'guide' | 'bug' | 'feedback' | 'support'>(defaultHelpSubSection);
  const [isSubmittingHelp, setIsSubmittingHelp] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [guideSearchQuery, setGuideSearchQuery] = useState('');

  // Auto-detect client IP address for Formsubmit reporting
  useEffect(() => {
    let isMounted = true;
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.ip) {
            setUserIpAddress(data.ip);
            return;
          }
        }
      } catch {
        // Try fallback IP provider
        try {
          const fallbackRes = await fetch('https://ipapi.co/json/');
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            if (isMounted && fallbackData?.ip) {
              setUserIpAddress(fallbackData.ip);
            }
          }
        } catch {
          // Ignore
        }
      }
    };
    fetchIp();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSendDirectFeedback = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!helpMessage.trim()) {
      toast.error('✏️ Write details above — description needed');
      return;
    }

    setIsSubmittingHelp(true);
    const toastId = toast.loading('🚀 Dispatching report via Formsubmit...');

    const finalSender = helpSenderEmail.trim() || user?.email || 'user@showflix.app';
    const finalSubject = helpSubject.trim() || `ShowFlix [${helpReportType.toUpperCase()}] Report`;
    const fullName = `${helpFirstName.trim()} ${helpLastName.trim()}`.trim();

    try {
      // 1. Send via local server endpoint log
      const serverPromise = fetch('/api/feedback/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: helpReportType,
          subject: finalSubject,
          message: helpMessage.trim(),
          firstName: helpFirstName.trim(),
          lastName: helpLastName.trim(),
          fullName: fullName || undefined,
          ipAddress: userIpAddress || undefined,
          userEmail: finalSender,
          userAgent: navigator.userAgent,
        }),
      }).catch((err) => console.warn('Server feedback log notice:', err));

      // 2. Direct client-side Formsubmit AJAX dispatch directly to developer inbox
      const formSubmitPromise = fetch('https://formsubmit.co/ajax/jtyodagreen@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          _subject: `[Formsubmit] ${finalSubject}${fullName ? ` - from ${fullName}` : ''}`,
          _template: 'table',
          _captcha: 'false',
          category_type: helpReportType.toUpperCase(),
          first_name: helpFirstName.trim() || 'Not specified',
          last_name: helpLastName.trim() || 'Not specified',
          full_name: fullName || 'Anonymous User',
          ip_address: userIpAddress || 'Auto-detected via network',
          reply_to_email: finalSender,
          summary_subject: finalSubject,
          detailed_message: helpMessage.trim(),
          submitted_at: new Date().toLocaleString(),
          user_agent: navigator.userAgent,
          app_version: 'v1.0.0',
        }),
      }).catch((err) => console.warn('Formsubmit endpoint notice:', err));

      await Promise.all([serverPromise, formSubmitPromise]);

      toast.success('📧 Delivered securely via Formsubmit!', { id: toastId, duration: 6000 });
      setHelpMessage('');
      setHelpSubject('');
      setHelpFirstName('');
      setHelpLastName('');
    } catch (err: any) {
      toast.error('📧 Message not sent — check connection and try again', { id: toastId });
    } finally {
      setIsSubmittingHelp(false);
    }
  };

  // Synchronize tab if defaultTab changes when open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab === 'theme' ? 'alerts' : (defaultTab as any));
      if (defaultHelpSubSection) {
        setHelpSubSection(defaultHelpSubSection);
        if (defaultHelpSubSection !== 'guide') {
          setHelpReportType(defaultHelpSubSection);
        }
      }
    }
  }, [isOpen, defaultTab, defaultHelpSubSection]);

  // Sync Input States
  const [sheetInputVal, setSheetInputVal] = useState(spreadsheetId);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
    } else {
      // Restore scroll position
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [isOpen]);

  const [selectedSheet, setSelectedSheet] = useState(sheetName || 'MASTER TRACKER');
  const [selectedWishlist, setSelectedWishlist] = useState(wishlistSheetName || '📋  WISHLIST');
  const [tabsList, setTabsList] = useState<string[]>(availableTabs);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile Viewer States & Color Coding
  const [newViewerName, setNewViewerName] = useState('');
  const [selectedNewColor, setSelectedNewColor] = useState<string>(PROFILE_COLOR_PALETTE[0].hex);
  const [activeColorPickerIndex, setActiveColorPickerIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Local storage profile picture customization options
  const [customAvatarUri, setCustomAvatarUri] = useState<string>('');

  const activeUser = user || DEFAULT_PROFILE_USER;
  const isConnected = Boolean(spreadsheetId && sheetTitle);

  useEffect(() => {
    if (isOpen) {
      if (spreadsheetId) setSheetInputVal(spreadsheetId);
      if (sheetName) setSelectedSheet(sheetName);
      if (wishlistSheetName) setSelectedWishlist(wishlistSheetName);
      if (availableTabs && availableTabs.length > 0) {
        setTabsList(availableTabs);
      }
      setErrorMsg(null);
    }
  }, [isOpen, spreadsheetId, sheetName, wishlistSheetName, availableTabs]);

  // Dynamically load sheet tabs if user is connected and sheet ID changes
  useEffect(() => {
    if (!isOpen) return;
    const cleanId = extractSpreadsheetId(sheetInputVal) || sheetInputVal.trim();
    if (!cleanId) {
      setTabsList([]);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const token = await getAccessToken();
        if (token && cleanId) {
          const meta = await fetchSpreadsheetDetails(cleanId, token);
          if (isMounted && meta?.sheetNames && meta.sheetNames.length > 0) {
            setTabsList(meta.sheetNames);
            const matchedWishlist = findMatchingWishlistSheet(meta.sheetNames);
            if (matchedWishlist) {
              setSelectedWishlist(matchedWishlist);
            }
            const matchedMaster = findMatchingMasterSheet(meta.sheetNames);
            if (matchedMaster && (!selectedSheet || selectedSheet === 'Sheet1')) {
              setSelectedSheet(matchedMaster);
            }
          }
        }
      } catch (e) {
        // Tab check preview notice
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, sheetInputVal]);

  if (!isOpen) return null;

  const defaultList = ['Me', 'Family', 'Guest', 'Shared'];
  const currentList = customViewers.length > 0 ? customViewers : defaultList;

  // Add profile viewer with chosen color tag
  const handleAddViewer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newViewerName.trim();
    if (!trimmed) return;

    if (currentList.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      toast.error(`👤 "${trimmed}" is already added — try a different name`);
      return;
    }

    const updated = [...currentList, trimmed];
    const updatedColors = { ...(viewerColors || {}), [trimmed]: selectedNewColor };
    onUpdateCustomViewers(updated, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }
    setNewViewerName('');
    // Advance to next unused palette color
    const nextIdx = (PROFILE_COLOR_PALETTE.findIndex((c) => c.hex === selectedNewColor) + 1) % PROFILE_COLOR_PALETTE.length;
    setSelectedNewColor(PROFILE_COLOR_PALETTE[nextIdx].hex);
    toast.success(`✨ Added profile: "${trimmed}" with ${getViewerColorName(selectedNewColor)} tag!`, { duration: 5000 });
  };

  // Update a single profile's color tag
  const handleUpdateProfileColor = (viewer: string, newColor: string) => {
    const updatedColors = { ...(viewerColors || {}), [viewer]: newColor };
    onUpdateCustomViewers(currentList, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }
    toast.success(`🎨 Color tag for "${viewer}" updated to ${getViewerColorName(newColor)}!`, { duration: 5000 });
  };

  // Save edited profile name while preserving their color tag
  const handleSaveEdit = (index: number) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;

    const updated = [...currentList];
    const oldName = updated[index];
    updated[index] = trimmed;

    const updatedColors = { ...(viewerColors || {}) };
    if (updatedColors[oldName]) {
      updatedColors[trimmed] = updatedColors[oldName];
      delete updatedColors[oldName];
    }

    onUpdateCustomViewers(updated, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }

    if (activeProfile === oldName && onSwitchProfile) {
      onSwitchProfile(trimmed);
    }

    setEditingIndex(null);
    setEditingName('');
    toast.success(`✅ Profile renamed to "${trimmed}" — saved`, { duration: 5000 });
  };

  // Remove profile viewer
  const handleRemoveViewer = (index: number) => {
    const nameToRemove = currentList[index];
    if (currentList.length <= 1) {
      toast.error("👤 Can't delete — you need at least one profile");
      return;
    }

    const updated = currentList.filter((_, i) => i !== index);
    const updatedColors = { ...(viewerColors || {}) };
    delete updatedColors[nameToRemove];

    onUpdateCustomViewers(updated, updatedColors);
    if (onUpdateViewerColors) {
      onUpdateViewerColors(updatedColors);
    }

    if (activeProfile === nameToRemove && onSwitchProfile) {
      onSwitchProfile(updated[0]);
    }

    toast.success(`Removed "${nameToRemove}"`, { duration: 5000 });
  };

  // Immediate manual re-sync without forcing authentication window
  const handleSyncNow = () => {
    if (onTriggerSync) {
      onTriggerSync();
    } else {
      toast('⏱️ Syncing with Google Sheet...');
    }
  };

  // Handle full authentication popup and sheet reconnect
  const handleReconnectGoogleAccount = async () => {
    const cleanId = extractSpreadsheetId(sheetInputVal) || sheetInputVal.trim();
    try {
      toast.loading('🔑 Opening Google authentication popup...', { id: 'resync-loader' });
      await onSignIn({ forceConsent: true });
      if (cleanId) {
        await onConnect(cleanId, selectedSheet, selectedWishlist);
      }
      if (onTriggerSync) {
        onTriggerSync();
      }
      toast.success('⚡ Connected and synced Google Sheets successfully!', { id: 'resync-loader', duration: 5000 });
    } catch (err: any) {
      toast.error('🔐 Connection cancelled — you can try again anytime', { id: 'resync-loader' });
    }
  };

  const handleReSync = handleSyncNow;

  // Connect Google Sheet
  const handleSheetConnect = async () => {
    setErrorMsg(null);
    const cleanId = extractSpreadsheetId(sheetInputVal) || sheetInputVal.trim();
    if (!cleanId) {
      setErrorMsg('🔗 Not a valid link — paste your full Google Sheet URL');
      return;
    }

    try {
      await onConnect(cleanId, selectedSheet, selectedWishlist);
      if (onTriggerSync) {
        onTriggerSync();
      }
      toast.success('Connected and synced Google Sheets successfully!', { duration: 5000 });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect. Verify your URL and permissions.');
    }
  };

  // Export Data to JSON File
  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(shows, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportFileDefaultName = 'showflix-library-backup.json';

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      toast.success('💾 Library backup exported successfully!', { duration: 5000 });
    } catch (e) {
      toast.error('💾 Export failed — try again in a moment');
    }
  };

  // Force sync / reload cache
  const handleForcePullUpdate = () => {
    if (onTriggerSync) {
      onTriggerSync();
      toast.success('⚡ Requesting full library update from Sheets...', { duration: 5000 });
    } else {
      toast.error("🔌 Offline — will sync when you're back online");
    }
  };

  return (
    <div
      id="settings-center-modal-backdrop"
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        id="settings-center-modal-dialog"
        className="relative w-full max-w-4xl bg-[#141414] border-0 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in-95 duration-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
        style={{ border: 'none', outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-zinc-900 bg-gradient-to-r from-zinc-900 to-zinc-900/80 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-lg shrink-0">
              <Palette className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-black text-white flex items-center gap-1.5 sm:gap-2">
                <span>ShowFlix Settings Center</span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-500/10 px-2 sm:px-2.5 py-0.5 rounded border border-red-500/20">
                  Control Panel
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">
                  v1.0.0
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-zinc-400 line-clamp-1">
                Configure your profiles, sync preferences, display themes, and inclusive settings.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto overscroll-contain space-y-4 sm:space-y-6 flex-1 bg-zinc-950/20 border-0">
          
          {/* VIEW A: CENTRAL GRID DASHBOARD (3x2 Grid matching the user's rough Paint sketch) */}
          {activeTab === 'all' && (
            <div className="space-y-3.5 sm:space-y-4.5">
              {/* Mini Box Metrics Display Row on Control Panel Home (Matching Quick Metrics Tab) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 sm:gap-2 select-none">
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-zinc-400 uppercase font-bold tracking-wider block">Total</span>
                  <span className="text-sm sm:text-base font-black text-white">{shows.length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-amber-400/90 uppercase font-bold tracking-wider block">Watching</span>
                  <span className="text-sm sm:text-base font-black text-amber-400">{shows.filter((s) => s.status === '⏳ Watching').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-emerald-400/90 uppercase font-bold tracking-wider block">Completed</span>
                  <span className="text-sm sm:text-base font-black text-emerald-400">{shows.filter((s) => s.status === '✅ Watched').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-[#f87171] uppercase font-bold tracking-wider block preserve-theme-color">Progress</span>
                  <span className="text-sm sm:text-base font-black text-[#f87171] preserve-theme-color">
                    {shows.length > 0 ? Math.round((shows.filter((s) => s.status === '✅ Watched').length / shows.length) * 100) : 0}%
                  </span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-purple-400/90 uppercase font-bold tracking-wider block">Movies</span>
                  <span className="text-sm sm:text-base font-black text-purple-300">{shows.filter((s) => s.type === 'Movie').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-blue-400/90 uppercase font-bold tracking-wider block">Series</span>
                  <span className="text-sm sm:text-base font-black text-blue-300">{shows.filter((s) => s.type === 'Series').length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-amber-400/90 uppercase font-bold tracking-wider block">Wishlist</span>
                  <span className="text-sm sm:text-base font-black text-amber-300">{shows.filter((s) => s.isWishlist).length}</span>
                </div>
                <div className="bg-zinc-900/90 border border-zinc-800/80 p-2 sm:p-2.5 rounded-lg sm:rounded-xl text-center shadow-sm">
                  <span className="text-[8px] sm:text-[9px] text-sky-400/90 uppercase font-bold tracking-wider block">Coming Soon</span>
                  <span className="text-sm sm:text-base font-black text-sky-300">
                    {shows.filter((s) => Boolean(s.releaseDate || s.releaseNote || s.nextAirDate || s.nextAirTimestamp)).length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4.5">
              
              {/* CARD 1: User Profile Settings (user) */}
              <div
                onClick={() => setActiveTab('user')}
                className="group relative p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] preserve-theme-color"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all duration-200 preserve-theme-color">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-red-500 transition-colors preserve-theme-color">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors preserve-theme-color">👤 Profile Users & Color Tags</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Manage viewer names & visual color tags synced with your Google Sheet.
                </p>
                <span className="inline-block text-[10px] text-red-400 font-bold mt-3 underline decoration-dotted preserve-theme-color">Open profile & color settings &rarr;</span>
              </div>

              {/* CARD 2: Google Sheets Sync (sheets) */}
              <div
                onClick={() => setActiveTab('sync')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:bg-amber-600 group-hover:text-white transition-all duration-200">
                    <Table className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-amber-500 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">📂 Google Sheets Sync</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  {isConnected ? `Connected to sheet "${sheetTitle || 'Spreadsheet'}"` : 'Google Sheets Sync not connected yet.'} Set frequency & edit URL.
                </p>
                {isConnected && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span>Last Synced: <strong className="font-mono text-white">{lastSyncedAt || 'Just now'}</strong></span>
                  </div>
                )}
                <span className="inline-block text-[10px] text-amber-400 font-bold mt-2 underline decoration-dotted">Open sync manager &rarr;</span>
              </div>

              {/* CARD 3: Personalization & Accessible */}
              <div
                onClick={() => setActiveTab('acc')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-all duration-200">
                    <Accessibility className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-purple-400 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">🎨 Personalization / Accessible</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Theme switcher colour options, Large / Clear Print, High Contrast WCAG mode, Dyslexia-friendly text fonts & reduced motion.
                </p>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="inline-block text-[10px] text-purple-400 font-bold underline decoration-dotted">Open personalization &rarr;</span>
                </div>
              </div>

              {/* CARD 4: Alert Intervals (alerts) */}
              <div
                onClick={() => setActiveTab('alerts')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
                    <Bell className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-blue-400 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">🔔 Alert Intervals</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Choose custom notification triggers for upcoming releases (e.g. 1 week, 3 days, or 1 hour before).
                </p>
                <span className="inline-block text-[10px] text-blue-400 font-bold mt-3 underline decoration-dotted">Open alert settings &rarr;</span>
              </div>

              {/* CARD 5: Data Backup & Reset (data) */}
              <div
                onClick={() => setActiveTab('data')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-200">
                    <Database className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-emerald-400 transition-colors">Configure</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">💾 Backup & Reset Cache</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Download offline JSON backups of your tracking, force sync live data, or reset local app cached data.
                </p>
                <span className="inline-block text-[10px] text-emerald-400 font-bold mt-3 underline decoration-dotted">Open backup tools &rarr;</span>
              </div>

              {/* CARD 6: Help & Support (help) */}
              <div
                onClick={() => setActiveTab('help')}
                className="group relative p-5 rounded-2xl bg-zinc-900/80 border-0 hover:border-red-500/60 shadow-lg cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between mb-3.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-600 group-hover:text-white transition-all duration-200">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-cyan-400 transition-colors">Direct</span>
                </div>
                <h4 className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors">Help & Support</h4>
                <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                  Quick guide, report issue, feedback, Contact support. Any report goes straight to app development via email (jtyodagreen@gmail.com).
                </p>
                <span className="inline-block text-[10px] text-cyan-400 font-bold mt-3 underline decoration-dotted">Open support & report &rarr;</span>
              </div>

            </div>
          </div>
        )}

          {/* VIEW B: USER PROFILE SETTINGS DETAIL PANEL */}
          {activeTab === 'user' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">👤 Profile Settings & Color Tags</h4>
                  <p className="text-xs text-zinc-400">
                    Assign visual color tags to distinct profile names.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              {/* Add New Profile Form with Color Tag Picker */}
              <form onSubmit={handleAddViewer} className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800/80 space-y-3 shadow-lg">
                <div>
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-1.5">
                    ➕ Add New Profile Name & Color Tag
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Me, Alex, Family, Kids..."
                      value={newViewerName}
                      onChange={(e) => setNewViewerName(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500 shadow-inner"
                    />
                    <button
                      type="submit"
                      disabled={!newViewerName.trim()}
                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md hover:scale-105 active:scale-95"
                    >
                      <Plus className="w-4 h-4" /> Add Profile
                    </button>
                  </div>
                </div>

                {/* Color Tag Swatch Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold text-zinc-400">Assign Color Tag:</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    {PROFILE_COLOR_PALETTE.map((c) => {
                      const isSelected = selectedNewColor.toLowerCase() === c.hex.toLowerCase();
                      return (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => setSelectedNewColor(c.hex)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'scale-115 ring-2 ring-white ring-offset-2 ring-offset-zinc-900 shadow-lg'
                              : 'opacity-70 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </form>

              {/* Configured Profiles List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Configured Profile Viewers ({currentList.length})
                  </h5>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentList.map((viewer, index) => {
                    const isSelected = activeProfile === viewer;
                    const isEditing = editingIndex === index;
                    const viewerColor = getViewerColor(viewer, viewerColors);
                    const colorName = getViewerColorName(viewerColor);
                    const isPaletteOpen = activeColorPickerIndex === index;

                    return (
                      <div
                        key={`modal-viewer-${index}`}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-zinc-900/95 border-red-500/50 shadow-md ring-1 ring-red-500/20'
                            : 'bg-zinc-900/80 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(index);
                                }}
                                className="flex-1 bg-zinc-950 border border-red-500 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(index)}
                                className="p-1.5 bg-emerald-600 text-white rounded cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Color-coded Avatar with soft colored shadow */}
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-md ring-2 transition-transform"
                                style={{
                                  backgroundColor: viewerColor,
                                  borderColor: `${viewerColor}80`,
                                  boxShadow: `0 4px 12px ${viewerColor}40`,
                                }}
                              >
                                {viewer.charAt(0).toUpperCase()}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-black text-white truncate block">
                                    {viewer}
                                  </span>
                                  {isSelected && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-600/20 text-red-400 border border-red-500/30">
                                      Active
                                    </span>
                                  )}
                                </div>

                                {/* Clickable Color Tag Badge */}
                                <button
                                  type="button"
                                  onClick={() => setActiveColorPickerIndex(isPaletteOpen ? null : index)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 border transition-all cursor-pointer hover:scale-105"
                                  style={{
                                    backgroundColor: `${viewerColor}18`,
                                    color: viewerColor,
                                    borderColor: `${viewerColor}40`,
                                  }}
                                  title="Click to change profile color tag"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: viewerColor }}
                                  />
                                  <span>{colorName}</span>
                                  <span className="text-[8px] opacity-70 ml-0.5">▼</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              {onSwitchProfile && !isSelected && (
                                <button
                                  type="button"
                                  onClick={() => onSwitchProfile(viewer)}
                                  className="text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                >
                                  Select
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveColorPickerIndex(isPaletteOpen ? null : index)}
                                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Change Profile Color Tag"
                              >
                                <Palette className="w-3.5 h-3.5" style={{ color: viewerColor }} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingIndex(index);
                                  setEditingName(viewer);
                                }}
                                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Rename Profile"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveViewer(index)}
                                className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete Profile"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expandable Mini Palette for this profile */}
                        {isPaletteOpen && (
                          <div className="mt-3 pt-3 border-t border-zinc-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Choose Color Tag for {viewer}:
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400 font-bold">
                                {colorName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {PROFILE_COLOR_PALETTE.map((c) => {
                                const isCurr = viewerColor.toLowerCase() === c.hex.toLowerCase();
                                return (
                                  <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() => {
                                      handleUpdateProfileColor(viewer, c.hex);
                                      setActiveColorPickerIndex(null);
                                    }}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                                      isCurr
                                        ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-zinc-900 shadow-md'
                                        : 'opacity-70 hover:opacity-100 hover:scale-110'
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                    title={c.name}
                                  >
                                    {isCurr && <Check className="w-3 h-3 text-white drop-shadow" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* VIEW C: GOOGLE SHEETS SYNC DETAIL PANEL */}
          {activeTab === 'sync' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">📂 Google Sheets Sync Manager</h4>
                  <p className="text-xs text-zinc-400">Configure secure background sync and change connected spreadsheet URL details.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>
              
              <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 flex-wrap ${isConnected ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-zinc-900 border-zinc-900'}`}>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Connection Status</span>
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                    <strong className="text-sm text-white">{isConnected ? 'Spreadsheet Connected' : 'Disconnected'}</strong>
                  </div>
                  {isConnected && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs text-zinc-400">
                        Syncing: <strong className="text-zinc-300 font-mono">{sheetTitle}</strong> ({shows.length} shows total)
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/40 px-2.5 py-1 rounded-md shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                          <span>Last Auto-Sync:</span>
                          <strong className="font-mono text-white">{lastSyncedAt || 'Just now'}</strong>
                        </span>
                        {isSyncing && (
                          <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1 animate-pulse">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Syncing in progress...</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isConnected ? (
                    <>
                      <button
                        id="btn-force-re-sync"
                        type="button"
                        onClick={handleSyncNow}
                        disabled={isSyncing}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-all shadow-md cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95 disabled:opacity-50"
                        title="Pull fresh data from Google Sheet now"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing...' : 'Force Re-Sync'}</span>
                      </button>

                      <button
                        id="btn-reconnect-google"
                        type="button"
                        onClick={handleReconnectGoogleAccount}
                        className="bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-500/40 font-bold text-xs px-3 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95 focus:ring-2 focus:ring-amber-400 focus:outline-none"
                        title="Full re-authorization when you tap"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Reconnect</span>
                      </button>

                      <button
                        id="btn-disconnect-sheet"
                        type="button"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to disconnect this Google Sheet? You can reconnect anytime.')) {
                            onDisconnect();
                            toast.success('Disconnected from Google Sheet', { duration: 5000 });
                          }
                        }}
                        className="bg-red-950 hover:bg-red-900 text-red-300 border border-red-800/40 text-xs font-bold px-3 py-2 rounded-lg preserve-theme-color cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95"
                        title="Unlink spreadsheet with confirmation"
                      >
                        <Unlink className="w-3.5 h-3.5 text-red-400" />
                        <span>Disconnect</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await onSignIn();
                          if (onTriggerSync) {
                            onTriggerSync();
                          }
                          onClose();
                        } catch (err: any) {
                          toast.error('🔐 Connection cancelled — you can try again anytime');
                        }
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Connect Google Account
                    </button>
                  )}
                </div>
              </div>

              {/* Update Sync URL / ID Details */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                  Spreadsheet URL / ID
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={sheetInputVal}
                    onChange={(e) => setSheetInputVal(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 bg-zinc-900 border-0 rounded-lg px-3 py-2 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleSheetConnect}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shrink-0"
                  >
                    Save & Test Sync
                  </button>
                </div>
                {errorMsg && <p className="text-red-400 text-xs font-medium">{errorMsg}</p>}
              </div>

              {/* Live Sync Model Information */}
              <div className="pt-2 border-t border-zinc-900 text-xs text-zinc-400 space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">⚡ Live Sync Model</span>
                <p className="text-zinc-400 text-[11px] leading-relaxed">
                  ShowFlix syncs directly with your Google Sheet on page open, whenever you return to this tab, or when you tap <strong>Force Re-Sync</strong>.
                </p>
              </div>
            </div>
          )}

          {/* VIEW D: ACCESSIBILITY & INCLUSION DETAIL PANEL */}
          {activeTab === 'acc' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">🎨 Personalization / Accessible Settings</h4>
                  <p className="text-xs text-zinc-400">Configure theme switcher colours, typography sizes, contrast levels, and frame motions.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 0. Primary Accent Color & Theme Selector */}
                <div className="md:col-span-2 p-5 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 space-y-3.5 shadow-lg">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h5 className="text-sm font-black text-white flex items-center gap-2">
                        <Palette className="w-4 h-4 text-red-500 preserve-theme-color" />
                        <span>Primary Accent Color & Theme Switcher</span>
                      </h5>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Pick your preferred primary accent color from our predefined theme palette. Applies instantly across all buttons, highlights, badges, and controls.
                      </p>
                    </div>
                    {activeTheme && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950 border border-zinc-800 text-xs font-bold text-white shadow-inner">
                        <span
                          className="w-2.5 h-2.5 rounded-full preserve-theme-color"
                          data-preserve-theme="true"
                          style={{ backgroundColor: activeTheme.hex }}
                        />
                        <span>Active: {activeTheme.name}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-1">
                    {PREDEFINED_ACCENT_THEMES.map((theme) => {
                      const currentAccent = accessibilitySettings.accentColor || '#E50914';
                      const isSelected =
                        currentAccent.toLowerCase() === theme.hex.toLowerCase() ||
                        currentAccent.toLowerCase() === theme.id.toLowerCase();
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            const newSettings = {
                              ...accessibilitySettings,
                              accentColor: theme.hex,
                            };
                            setAccessibilitySettings(newSettings);
                            applyAccentTheme(theme.hex);
                            toast.success(`🎨 Theme changed to ${theme.name} — looks great!`, { duration: 5000 });
                          }}
                          style={
                            isSelected
                              ? {
                                  borderColor: theme.hex,
                                  boxShadow: `0 0 16px ${theme.hex}45`,
                                  outline: `2px solid ${theme.hex}60`,
                                }
                              : undefined
                          }
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-zinc-800/90'
                              : 'bg-zinc-950/60 border-zinc-800 hover:bg-zinc-800/70 hover:border-zinc-700'
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full shrink-0 shadow-sm flex items-center justify-center text-white text-[9px] preserve-theme-color"
                            data-preserve-theme="true"
                            style={{ backgroundColor: theme.hex }}
                          >
                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white block truncate">{theme.name}</span>
                            <span className="text-[10px] font-mono text-zinc-500 block">{theme.hex}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* 1. Large Print */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Large / Clear Print</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Increases typography sizing parameters (WCAG standard).</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        textSize: accessibilitySettings.textSize === 'large' ? 'standard' : 'large',
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.textSize === 'large' ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.textSize === 'large' ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* 2. Color Contrast */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">High contrast dark</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Applies direct black contrast lines on borders.</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        contrastMode: accessibilitySettings.contrastMode === 'high' ? 'default' : 'high',
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.contrastMode === 'high' ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.contrastMode === 'high' ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* 3. Dyslexia Friendly */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Dyslexia-Friendly Fonts</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Switches text headings to highly readable sans serif styles.</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        dyslexiaFont: !accessibilitySettings.dyslexiaFont,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.dyslexiaFont ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.dyslexiaFont ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {/* 4. Motion Reduce */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Reduce Transition Motion</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Turns off sliding shelves and animation effects.</p>
                  </div>
                  <button
                    onClick={() =>
                      setAccessibilitySettings({
                        ...accessibilitySettings,
                        reduceMotion: !accessibilitySettings.reduceMotion,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      accessibilitySettings.reduceMotion ? 'bg-yellow-400 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {accessibilitySettings.reduceMotion ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* VIEW E: ALERT INTERVALS PANEL */}
          {activeTab === 'alerts' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">🔔 Customizable Alert Intervals</h4>
                  <p className="text-xs text-zinc-400">Choose when you want to be notified about upcoming premieres.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { id: 'oneWeek', label: '1 Week Before', desc: 'Receive an alert 7 days before premiere' },
                  { id: 'threeDays', label: '3 Days Before', desc: 'Receive an alert 72 hours before premiere' },
                  { id: 'oneDay', label: '1 Day Before', desc: 'Receive an alert 24 hours before premiere' },
                  { id: 'oneHour', label: '1 Hour Before', desc: 'Final warning 60 minutes before start' },
                  { id: 'atRelease', label: 'At Release Time', desc: '"OUT NOW" notification when it airs' },
                ].map((interval) => (
                  <div key={interval.id} className="p-4 rounded-xl bg-zinc-900 border-0 flex items-center justify-between gap-3 shadow-lg">
                    <div>
                      <h5 className="text-xs font-bold text-zinc-200">{interval.label}</h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{interval.desc}</p>
                    </div>
                    <button
                      onClick={() =>
                        onUpdateAlertIntervals({
                          ...alertIntervals,
                          [interval.id]: !alertIntervals[interval.id as keyof AlertIntervals],
                        })
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        alertIntervals[interval.id as keyof AlertIntervals] ? 'bg-amber-500 text-black font-extrabold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {alertIntervals[interval.id as keyof AlertIntervals] ? 'Enabled' : 'Off'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-amber-200/80 text-[11px] leading-relaxed">
                <strong>Note:</strong> Alerts are triggered automatically while the app is open in your browser. Ensure browser notifications are allowed to receive native system alerts.
              </div>
            </div>
          )}

          {/* VIEW F: BACKUP & DATA MAINTENANCE */}
          {activeTab === 'data' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-zinc-900">
                <div>
                  <h4 className="text-base font-black text-white">💾 Library Backups & Maintenance</h4>
                  <p className="text-xs text-zinc-400">Export local library cached data or reset local system cache storage completely.</p>
                </div>
                <button
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3 py-1.5 rounded-lg"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Offline JSON Backup */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 space-y-3.5">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Export Offline JSON Backup</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Download a complete structured JSON list of all tracked titles offline.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer text-center block"
                  >
                    Download JSON Backup
                  </button>
                </div>

                {/* 2. Force Pull Update */}
                <div className="p-4 rounded-xl bg-zinc-900 border-0 space-y-3.5">
                  <div>
                    <h5 className="text-xs font-bold text-zinc-200">Force Pull Raw Sheets Update</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Bypasses cached local storage data and retrieves raw content directly.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleForcePullUpdate}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-2 rounded-lg transition-colors cursor-pointer text-center block"
                  >
                    Force Live Refresh
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* VIEW E: HELP & SUPPORT DETAIL PANEL */}
          {activeTab === 'help' && (
            <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl mx-auto">
              
              {/* Header Banner */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-zinc-800">
                <div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <span>Help & Support Center</span>
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    User guide, issue reporter, feedback & direct support hotline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-3.5 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  &larr; Back to Control Panel
                </button>
              </div>

              {/* 4 Main Section Tabs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'guide', label: '📖 Quick Guide', sub: 'How to use ShowFlix', color: 'border-cyan-500/60 bg-cyan-500/15 text-cyan-400' },
                  { id: 'bug', label: '🐛 Report Issue', sub: 'Bugs & Glitches', color: 'border-[#E50914] bg-[#E50914]/20 text-white preserve-theme-color' },
                  { id: 'feedback', label: '💬 Send Feedback', sub: 'Ideas & Suggestions', color: 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400' },
                  { id: 'support', label: '🎧 Contact Support', sub: 'Direct Help', color: 'border-amber-500/60 bg-amber-500/15 text-amber-400' },
                ].map((tab) => {
                  const isSelected = helpSubSection === tab.id;
                  const isBugTab = tab.id === 'bug';
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      data-preserve-theme={isBugTab ? 'true' : undefined}
                      style={
                        isSelected && isBugTab
                          ? { backgroundColor: 'rgba(229, 9, 20, 0.25)', borderColor: '#E50914', color: '#ffffff' }
                          : undefined
                      }
                      onClick={() => {
                        setHelpSubSection(tab.id as any);
                        if (tab.id !== 'guide') {
                          setHelpReportType(tab.id as any);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isBugTab ? 'preserve-theme-color' : ''
                      } ${
                        isSelected
                          ? `${tab.color} ring-1 ring-white/20 scale-[1.02]`
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      <span className="block text-xs font-black">{tab.label}</span>
                      <span className="block text-[10px] text-zinc-400 mt-0.5 font-medium">{tab.sub}</span>
                    </button>
                  );
                })}
              </div>

              {/* SECTION 1: QUICK GUIDE HOW TO USE SHOWFLIX */}
              {helpSubSection === 'guide' && (
                <div className="p-5 sm:p-7 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-6 shadow-2xl animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-3 border-b border-zinc-800/80 pb-4">
                    <div>
                      <h5 className="text-base font-extrabold text-white flex items-center gap-2">
                        <span>📖 Quick Guide: How to use ShowFlix</span>
                      </h5>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Master tracking shows, Google Sheets sync, profiles, release radar alerts & offline backups.
                      </p>
                    </div>

                    {/* Search bar inside Quick Guide */}
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        value={guideSearchQuery}
                        onChange={(e) => setGuideSearchQuery(e.target.value)}
                        placeholder="Search guide topics..."
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 placeholder:text-zinc-600"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                    </div>
                  </div>

                  {/* Feature Guide Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-300">
                    {[
                      {
                        title: '1. Tracking Movies & Series',
                        badge: 'Library',
                        color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                        desc: 'Click "+ Add Show" to search TMDB for posters, synopsis, and episode counts. Increment watched episodes with 1-click `+` buttons. Reaching the max episode count automatically marks the title as "✅ Watched".',
                        tags: ['add show', 'episodes', 'library', 'tmdb', 'progress', 'status']
                      },
                      {
                        title: '2. Connecting Google Sheets Sync',
                        badge: 'Cloud Sync',
                        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                        desc: 'Sync watch history live to your personal Google Sheet! Paste your Sheet ID/URL in Settings → Google Sheets Sync. ShowFlix updates rows automatically and supports dual MASTER TRACKER and Wishlist tabs.',
                        tags: ['google sheets', 'sheet id', 'auto sync', 'wishlist', 'realtime', 'cloud']
                      },
                      {
                        title: '3. Multi-User Profiles & Color Badges',
                        badge: 'Profiles',
                        color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                        desc: 'Set up distinct viewer profiles (e.g. Me, Alex, Family). Assign custom color badges (Red, Blue, Emerald, Gold, Pink) to color-code or filter titles on your main watch list instantly.',
                        tags: ['profiles', 'viewer', 'color tags', 'tags', 'multi-user', 'filter']
                      },
                      {
                        title: '4. Release Radar & Episode Alerts',
                        badge: 'Notifications',
                        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                        desc: 'The Release Radar tab highlights episodes airing within 24 hours with live ticking countdowns. Turn on browser alerts in Alert Preferences to receive native push notifications before premiere time.',
                        tags: ['release radar', 'episodes', 'alerts', 'notifications', 'premiere', 'airing']
                      },
                      {
                        title: '5. Offline Storage & Data Backups',
                        badge: 'Backup',
                        color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
                        desc: 'All edits work offline seamlessly. ShowFlix queues changes locally and syncs to Google Sheets when internet restores. You can also export full JSON or CSV backups anytime in Control Panel.',
                        tags: ['offline', 'backup', 'export', 'import', 'json', 'csv']
                      },
                      {
                        title: '6. Custom Themes & Accessibility',
                        badge: 'Themes',
                        color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                        desc: 'Tailor your experience with High Contrast visibility mode, Dyslexia-friendly accessible fonts, large WCAG text, and custom theme accent colors (Netflix Red, Ocean Cyan, Cyber Pink, Emerald Green).',
                        tags: ['themes', 'accent color', 'high contrast', 'dyslexia font', 'accessibility']
                      }
                    ]
                      .filter((item) => {
                        if (!guideSearchQuery.trim()) return true;
                        const q = guideSearchQuery.toLowerCase();
                        return (
                          item.title.toLowerCase().includes(q) ||
                          item.desc.toLowerCase().includes(q) ||
                          item.tags.some((t) => t.includes(q))
                        );
                      })
                      .map((item, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2 shadow-sm hover:border-zinc-700 transition-colors">
                          <div className="flex items-center justify-between font-bold text-xs">
                            <span className="text-white">{item.title}</span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${item.color}`}>
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-zinc-400 leading-relaxed text-[11px]">
                            {item.desc}
                          </p>
                        </div>
                      ))}
                  </div>

                  {/* Frequently Asked Questions Accordion */}
                  <div className="pt-3 border-t border-zinc-800 space-y-3">
                    <h6 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center gap-2">
                      <span>❓ Frequently Asked Questions (FAQ)</span>
                    </h6>

                    <div className="space-y-2 text-xs">
                      {[
                        {
                          q: 'How do I fix Google Sheets "Permission Denied" or sync errors?',
                          a: 'Ensure your Google Sheet is shared as "Anyone with the link can edit". In Google Sheets, click Share (top right) → Change to Anyone with the link → Editor. Then click "Force Live Refresh" in Settings.'
                        },
                        {
                          q: 'How do I turn on 24-hour release notifications?',
                          a: 'Go to Settings → Control Panel → Alert Preferences. Enable the release reminder toggle. When prompted by your browser, grant notification permissions.'
                        },
                        {
                          q: 'Can I import my watch history from CSV or another app?',
                          a: 'Yes! Go to Settings → Control Panel → Backup & Recovery. Select "Import Data" and choose your CSV or JSON backup file.'
                        },
                        {
                          q: 'How do profile viewer tags work?',
                          a: 'Go to Settings → Profiles & Color Badges. Create names for family members and pick a color badge. On any show card or details modal, select who is watching to tag it.'
                        }
                      ].map((faq, i) => {
                        const isOpen = activeFaq === i;
                        return (
                          <div key={i} className="rounded-xl bg-zinc-950/60 border border-zinc-800/80 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setActiveFaq(isOpen ? null : i)}
                              className="w-full text-left p-3 flex items-center justify-between text-xs font-bold text-zinc-200 hover:text-white transition-colors cursor-pointer"
                            >
                              <span>{faq.q}</span>
                              <span className="text-zinc-500 font-mono text-sm">{isOpen ? '−' : '+'}</span>
                            </button>
                            {isOpen && (
                              <div className="px-3 pb-3 pt-1 text-[11px] text-zinc-400 border-t border-zinc-800/50 leading-relaxed bg-zinc-900/40">
                                {faq.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-center justify-between text-xs text-cyan-200/90">
                    <span>Have a question not covered here? Switch to the Report Issue, Send Feedback, or Contact Support tabs above!</span>
                  </div>
                </div>
              )}

              {/* SECTION 2, 3, 4: FORMSUBMIT FORMS (REPORT ISSUE / SEND FEEDBACK / CONTACT SUPPORT) */}
              {helpSubSection !== 'guide' && (
                <div className="p-5 sm:p-7 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-5 shadow-2xl animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-800/80 pb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                        helpSubSection === 'bug'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : helpSubSection === 'feedback'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {helpSubSection === 'bug' ? '🐛' : helpSubSection === 'feedback' ? '💬' : '🎧'}
                      </div>
                      <div>
                        <h5 className="text-base font-extrabold text-white">
                          {helpSubSection === 'bug'
                            ? 'Report an Issue / Bug'
                            : helpSubSection === 'feedback'
                            ? 'Send Feature Ideas & Feedback'
                            : 'Contact Support Directly'}
                        </h5>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handleSendDirectFeedback} className="space-y-4">
                    {/* First Name & Last Name */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          value={helpFirstName}
                          onChange={(e) => setHelpFirstName(e.target.value)}
                          placeholder="e.g. John"
                          className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder:text-zinc-600 shadow-inner ${
                            helpSubSection === 'bug'
                              ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                              : helpSubSection === 'feedback'
                              ? 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                              : 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={helpLastName}
                          onChange={(e) => setHelpLastName(e.target.value)}
                          placeholder="e.g. Doe"
                          className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder:text-zinc-600 shadow-inner ${
                            helpSubSection === 'bug'
                              ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                              : helpSubSection === 'feedback'
                              ? 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                              : 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Email & Subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Your Reply-To Email
                        </label>
                        <input
                          type="email"
                          value={helpSenderEmail}
                          onChange={(e) => setHelpSenderEmail(e.target.value)}
                          placeholder="Enter your email address"
                          className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder:text-zinc-600 shadow-inner ${
                            helpSubSection === 'bug'
                              ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                              : helpSubSection === 'feedback'
                              ? 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                              : 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                          Subject Summary
                        </label>
                        <input
                          type="text"
                          value={helpSubject}
                          onChange={(e) => setHelpSubject(e.target.value)}
                          placeholder={
                            helpSubSection === 'bug'
                              ? 'e.g. Poster image not loading'
                              : helpSubSection === 'feedback'
                              ? 'e.g. Suggestion for custom tags'
                              : 'e.g. Question about Sheets auto-sync'
                          }
                          className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none placeholder:text-zinc-600 shadow-inner ${
                            helpSubSection === 'bug'
                              ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                              : helpSubSection === 'feedback'
                              ? 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                              : 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Detailed Message */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
                          {helpSubSection === 'bug'
                            ? 'Describe Bug & Steps to Reproduce'
                            : helpSubSection === 'feedback'
                            ? 'Describe Your Feedback / Feature Request'
                            : 'Describe How We Can Assist You'}
                        </label>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {helpMessage.length} / 1000 chars
                        </span>
                      </div>

                      <textarea
                        rows={5}
                        maxLength={1000}
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        placeholder={
                          helpSubSection === 'bug'
                            ? 'Please detail what happened, what you expected, and steps to reproduce...'
                            : helpSubSection === 'feedback'
                            ? 'Share your thoughts, feature ideas, or feedback to improve ShowFlix...'
                            : 'Ask any questions or request assistance with setting up ShowFlix...'
                        }
                        className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-xs sm:text-sm text-white focus:outline-none placeholder:text-zinc-600 shadow-inner ${
                          helpSubSection === 'bug'
                            ? 'focus:border-red-500 focus:ring-1 focus:ring-red-500/30'
                            : helpSubSection === 'feedback'
                            ? 'focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'
                            : 'focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30'
                        }`}
                      />
                    </div>

                    {/* Formsubmit Action Button */}
                    <button
                      type="submit"
                      disabled={isSubmittingHelp || !helpMessage.trim()}
                      data-preserve-theme={helpSubSection === 'bug' ? 'true' : undefined}
                      style={
                        helpSubSection === 'bug'
                          ? {
                              backgroundColor: isSubmittingHelp || !helpMessage.trim() ? 'rgba(229, 9, 20, 0.55)' : '#E50914',
                              color: '#ffffff',
                              border: '1px solid #E50914',
                            }
                          : undefined
                      }
                      className={`w-full text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl transition-colors cursor-pointer text-center block disabled:cursor-not-allowed ${
                        helpSubSection === 'bug'
                          ? 'preserve-theme-color hover:brightness-110 active:brightness-90'
                          : helpSubSection === 'feedback'
                          ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:bg-emerald-600/50 disabled:opacity-60'
                          : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:bg-amber-600/50 disabled:opacity-60'
                      }`}
                    >
                      {isSubmittingHelp ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Sending Report...
                        </span>
                      ) : (
                        `🚀 Submit ${
                          helpSubSection === 'bug'
                            ? 'Bug Report'
                            : helpSubSection === 'feedback'
                            ? 'Feedback'
                            : 'Support Query'
                        } \u2192`
                      )}
                    </button>
                  </form>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4.5 bg-zinc-900 border-t border-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>ShowFlix settings dashboard synced automatically.</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">
              v1.0.0
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-md transition-colors cursor-pointer"
          >
            Done & Save
          </button>
        </div>
      </div>
    </div>
  );
}
