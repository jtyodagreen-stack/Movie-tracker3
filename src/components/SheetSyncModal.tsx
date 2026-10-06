import { useState, useEffect } from 'react';
import {
  X,
  Table,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import type { User } from 'firebase/auth';
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

interface SheetSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSignIn: (options?: { forceConsent?: boolean }) => Promise<any>;
  spreadsheetId: string;
  sheetName: string;
  wishlistSheetName?: string;
  availableTabs?: string[];
  onConnect: (id: string, name: string, wishlistName?: string) => Promise<void>;
  onDisconnect: () => void;
  isLoading: boolean;
  lastSyncedAt?: string;
  sheetTitle?: string;
  rowCount: number;
  autoSyncEnabled?: boolean;
  onToggleAutoSync?: (enabled: boolean) => void;
  syncFrequency?: number;
  onUpdateSyncFrequency?: (freq: number) => void;
  syncOnlyOnWifi?: boolean;
  onToggleSyncOnlyOnWifi?: (enabled: boolean) => void;
  onTriggerSync?: () => void;
  isOnline?: boolean;
}

export default function SheetSyncModal({
  isOpen,
  onClose,
  user,
  onSignIn,
  spreadsheetId,
  sheetName,
  wishlistSheetName = '📋  WISHLIST',
  availableTabs = [],
  onConnect,
  onDisconnect,
  isLoading,
  lastSyncedAt,
  sheetTitle,
  rowCount,
  autoSyncEnabled = true,
  onToggleAutoSync,
  syncFrequency = 900,
  onUpdateSyncFrequency,
  syncOnlyOnWifi = false,
  onToggleSyncOnlyOnWifi,
  onTriggerSync,
  isOnline = true,
}: SheetSyncModalProps) {
  const [inputVal, setInputVal] = useState(spreadsheetId);
  const [selectedSheet, setSelectedSheet] = useState(sheetName || 'MASTER TRACKER');
  const [selectedWishlist, setSelectedWishlist] = useState(wishlistSheetName || '📋  WISHLIST');
  const [tabsList, setTabsList] = useState<string[]>(availableTabs);
  const [fetchingSheets, setFetchingSheets] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeUser = user || DEFAULT_PROFILE_USER;
  const profilePictureUrl = getProfilePicture(activeUser);
  const profileDisplayName = getProfileDisplayName(activeUser);
  const profileEmail = getProfileEmail(activeUser);

  useEffect(() => {
    if (isOpen) {
      if (spreadsheetId) setInputVal(spreadsheetId);
      if (sheetName) setSelectedSheet(sheetName);
      if (wishlistSheetName) setSelectedWishlist(wishlistSheetName);
      if (availableTabs && availableTabs.length > 0) {
        setTabsList(availableTabs);
        const matchedW = findMatchingWishlistSheet(availableTabs);
        if (matchedW) {
          setSelectedWishlist(matchedW);
        }
      }
      setErrorMsg(null);
    }
  }, [isOpen, spreadsheetId, sheetName, wishlistSheetName, availableTabs]);

  // Dynamically load sheet tabs if user is connected and sheet ID changes
  useEffect(() => {
    if (!isOpen) return;
    const cleanId = extractSpreadsheetId(inputVal) || inputVal.trim();
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
        // Tab preview check notice
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOpen, inputVal]);

  if (!isOpen) return null;

  const isConnected = Boolean(spreadsheetId && sheetTitle);
  const detectedWishlist = findMatchingWishlistSheet(tabsList);

  const handleTestOrLoadTabs = async () => {
    const cleanId = extractSpreadsheetId(inputVal) || inputVal.trim();
    if (!cleanId) {
      setErrorMsg('Please paste a valid Google Sheet URL or Spreadsheet ID.');
      return;
    }

    setErrorMsg(null);
    setFetchingSheets(true);

    try {
      const isActuallySignedIn = user && user.uid && user.uid !== 'user_default';
      if (!isActuallySignedIn) {
        await onSignIn();
      }
      // Connect to Google Sheets with token and tab names (only close on success)
      await onConnect(
        cleanId,
        selectedSheet.trim() || 'MASTER TRACKER',
        selectedWishlist.trim() || detectedWishlist || '📋  WISHLIST'
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect to Google Sheets. Check permissions.');
    } finally {
      setFetchingSheets(false);
    }
  };

  return (
    <div
      id="sheet-sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="sheet-sync-modal-card"
        className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-[#181818] border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-950">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Google Sheets Integration</span>
                <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Auto-Sync
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Seamless real-time synchronization with your Master Tracker spreadsheet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              id="close-sync-modal-btn"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* NEW USER ONBOARDING SECTION */}
          {!isConnected && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-3 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Sparkles className="w-16 h-16 text-amber-500" />
              </div>
              <div className="relative z-10 space-y-2">
                <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Official Template Required
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  To use this tracker, make a copy of our official template and set it up:
                </p>
                <div className="space-y-1.5 text-xs text-zinc-400">
                  <p>1. <strong className="text-amber-400">Click to make a copy of the official Sheet template</strong></p>
                  <p>2. Paste your new spreadsheet URL in the box below</p>
                  <p>3. Go to the <span className="font-mono text-zinc-300">Lists</span> sheet tab in your spreadsheet and enter profile names in Column D to populate your profile dropdown</p>
                </div>
                <div className="pt-2">
                  <a
                    href="https://docs.google.com/spreadsheets/d/1XWlhjlmRO3l85Ng_uVVGsAAApNiv469KGTRX0ZtpBBA/copy"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black px-4 py-2.5 rounded-md shadow-lg shadow-amber-900/20 transition-all cursor-pointer active:scale-95 no-underline uppercase text-center break-words max-w-full"
                  >
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span className="break-words">1. Click to make a copy of the official Sheet template</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* RE-SYNC PROMPT ALERT BANNER (If connected & signed in) */}
          {isConnected && (
            <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                <span className="truncate">
                  Google Account connected! Click <strong>"Re-Sync Now"</strong> to refresh your Google Sheets data.
                </span>
              </div>
              <button
                type="button"
                onClick={handleTestOrLoadTabs}
                disabled={fetchingSheets || isLoading}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-3 py-1.5 rounded-lg text-xs shrink-0 transition-all shadow-md cursor-pointer flex items-center gap-1 hover:scale-105 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetchingSheets || isLoading ? 'animate-spin' : ''}`} />
                <span>Re-Sync Now</span>
              </button>
            </div>
          )}

          {/* OFFLINE STATUS ALERT (If offline) */}
          {!isOnline && (
            <div className="p-3.5 rounded-lg bg-amber-950/70 border border-amber-500/50 flex items-start gap-3 animate-in fade-in duration-150">
              <WifiOff className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
              <div className="space-y-1">
                <h4 className="text-xs sm:text-sm font-bold text-amber-200">
                  Offline Mode Active
                </h4>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  No internet connection detected. You can continue updating episodes, ratings, and statuses — all changes are stored locally and will automatically sync to your Google Sheet once connectivity is restored.
                </p>
              </div>
            </div>
          )}

          {/* Auto-Sync Banner & Frequency Settings */}
          <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-600/50 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs sm:text-sm font-bold text-emerald-200">
                  Persistent Background Auto-Sync
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline">
                  {autoSyncEnabled ? 'Auto-Sync Active' : 'Auto-Sync Paused'}
                </span>
                {onToggleAutoSync && (
                  <button
                    type="button"
                    onClick={() => onToggleAutoSync(!autoSyncEnabled)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoSyncEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoSyncEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            {/* Sync Frequency Control & Wi-Fi toggle */}
            {autoSyncEnabled && (
              <div className="pt-2.5 border-t border-emerald-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Background Sync Frequency</span>
                  </label>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/90 border border-emerald-700/50 px-2 py-0.5 rounded">
                    Every {syncFrequency >= 60 ? `${Math.round(syncFrequency / 60)}m` : `${syncFrequency}s`}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-0.5">
                  {[
                    { label: '30s', value: 30 },
                    { label: '1m', value: 60 },
                    { label: '2m', value: 120 },
                    { label: '5m', value: 300 },
                    { label: '15m', value: 900, tag: 'Default' },
                    { label: '30m', value: 1800 },
                  ].map((preset) => {
                    const isSelected = syncFrequency === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => onUpdateSyncFrequency && onUpdateSyncFrequency(preset.value)}
                        className={`py-1.5 px-2 rounded-md text-xs font-medium border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-400 font-bold shadow-md shadow-emerald-950'
                            : 'bg-zinc-900/90 text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        <div>{preset.label}</div>
                        {preset.tag && (
                          <div className={`text-[9px] ${isSelected ? 'text-emerald-100' : 'text-zinc-500'}`}>
                            {preset.tag}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Sync only on Wi-Fi toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-emerald-800/30">
                  <span className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sync only on Wi-Fi (skip mobile data)</span>
                  </span>
                  {onToggleSyncOnlyOnWifi && (
                    <button
                      type="button"
                      onClick={() => onToggleSyncOnlyOnWifi(!syncOnlyOnWifi)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        syncOnlyOnWifi ? 'bg-emerald-500' : 'bg-zinc-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          syncOnlyOnWifi ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>
            )}

            <p className="text-[11px] text-emerald-300/80 leading-relaxed">
              ✨ ShowFlix automatically fetches updates from Google Sheets every <strong>{syncFrequency >= 60 ? `${syncFrequency / 60} min` : `${syncFrequency}s`}</strong> and whenever you switch back to this tab.
            </p>
          </div>

          {/* User Profile & Google Account Status Card with Profile Picture */}
          <a
            id="sync-modal-profile-card"
            href="https://myaccount.google.com/?pli=1"
            target="_blank"
            rel="noopener noreferrer"
            className="p-3.5 rounded-xl bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900/90 border border-zinc-800 flex items-center justify-between gap-3 shadow-md hover:border-zinc-700 transition-colors block"
            title="Manage Google Account"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  id="sync-modal-profile-img"
                  src={profilePictureUrl}
                  alt={profileDisplayName || 'Google Account Profile Picture'}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover ring-2 ring-emerald-500/80 shadow-md"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    if (e.currentTarget.src !== GOOGLE_AVATAR_DATA_URI) {
                      e.currentTarget.src = GOOGLE_AVATAR_DATA_URI;
                    }
                  }}
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#181818]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-bold text-white truncate">
                    {profileDisplayName}
                  </span>
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full font-semibold">
                    Google Account
                  </span>
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5 font-mono">
                  {profileEmail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold bg-emerald-950/60 border border-emerald-700/40 px-2.5 py-1.5 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="hidden xs:inline">Connected</span>
              </span>
            </div>
          </a>

          {/* Current Connection Status */}
          {isConnected && (
            <div className="p-3 sm:p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 space-y-2.5 overflow-hidden w-full max-w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 w-full min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-emerald-200 truncate" title={`Linked to: ${sheetTitle}`}>
                    Linked to: {sheetTitle}
                  </span>
                </div>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 underline cursor-pointer shrink-0 self-start sm:self-auto py-0.5 max-w-full truncate"
                  title="Open in Google Sheets"
                >
                  <span className="truncate">Open in Google Sheets</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
              <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 w-full break-words">
                <span>Master Tab: <strong className="text-zinc-200">{sheetName}</strong></span>
                <span>•</span>
                <span>Wishlist Tab: <strong className="text-emerald-300">{wishlistSheetName}</strong></span>
                <span>•</span>
                <span>Rows: <strong className="text-zinc-200">{rowCount}</strong></span>
                {lastSyncedAt && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-emerald-300 font-medium">
                      <Clock className="w-3 h-3 text-emerald-400 shrink-0" />
                      Last Auto-Sync: <strong>{lastSyncedAt}</strong>
                    </span>
                  </>
                )}
              </div>
              {onTriggerSync && (
                <div className="pt-1 flex flex-wrap items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={onTriggerSync}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
                    <span>Sync from Google Sheets Now</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Input Form */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="spreadsheet-id-input" className="text-xs font-semibold text-zinc-300 block">
                  Google Sheets URL or Spreadsheet ID
                </label>
                {isConnected && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-700/60 px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Permanent Default Sheet Saved
                  </span>
                )}
              </div>
              <input
                id="spreadsheet-id-input"
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleTestOrLoadTabs();
                  }
                }}
                placeholder="Paste the full link from your browser address bar..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-base text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
              />

              
            </div>

            {/* Detected Tabs Section */}
            {/* Removed for simplicity */}

            {/* Detected Wishlist Highlight Alert */}
            {/* Removed for simplicity */}

            {/* <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="sheet-tab-name-input" className="text-xs font-semibold text-zinc-300 block">
                    📊 Master Tracker Tab Name
                  </label>
                  {tabsList.length > 0 && (
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="text-[11px] bg-zinc-800 text-zinc-300 border border-zinc-700 rounded px-1.5 py-0.5"
                    >
                      {tabsList.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  id="sheet-tab-name-input"
                  type="text"
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  placeholder="e.g. MASTER TRACKER"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[11px] text-zinc-500">
                  Tab holding your active watched &amp; watching shows.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="wishlist-tab-name-input" className="text-xs font-semibold text-zinc-300 block">
                    🎁 Wishlist Tab Name
                  </label>
                  {tabsList.length > 0 && (
                    <select
                      value={selectedWishlist}
                      onChange={(e) => setSelectedWishlist(e.target.value)}
                      className="text-[11px] bg-zinc-800 text-amber-300 border border-zinc-700 rounded px-1.5 py-0.5 font-medium"
                    >
                      {tabsList.map((t) => (
                        <option key={t} value={t}>
                          {t} {t === detectedWishlist ? '⭐ (Detected Wishlist)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <input
                  id="wishlist-tab-name-input"
                  type="text"
                  value={selectedWishlist}
                  onChange={(e) => setSelectedWishlist(e.target.value)}
                  placeholder="e.g. 📋  WISHLIST"
                  className="w-full bg-zinc-900 border border-amber-600/50 rounded-md px-3 py-2 text-sm text-amber-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-zinc-500">
                  Tab holding titles on your wishlist to watch later.
                </p>
              </div>
            </div> */}
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-300 flex items-start gap-2 max-h-[300px] overflow-y-auto">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="whitespace-pre-line text-left leading-relaxed">{errorMsg}</span>
              </div>
              {errorMsg.includes('403 Forbidden') && (
                <button
                  type="button"
                  onClick={async () => {
                    setErrorMsg(null);
                    setFetchingSheets(true);
                    try {
                      await onSignIn({ forceConsent: true });
                      setErrorMsg(
                        '✅ Re-authorization flow initiated! Please grant Sheets permissions on the Google popup and then click "Connect Google Sheet" again.'
                      );
                    } catch (e: any) {
                      setErrorMsg(`Re-authorization failed: ${e.message || String(e)}`);
                    } finally {
                      setFetchingSheets(false);
                    }
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold py-2 px-3 rounded text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Re-authorize with Full Google Sheets Permissions
                </button>
              )}
            </div>
          )}

          {/* Column structure guide & template download */}
          {!isConnected && (
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  Supported Columns in Your Master Tracker:
                </h4>
                <button
                  type="button"
                  onClick={() => window.open('https://docs.google.com/spreadsheets/d/1XWlhjlmRO3l85Ng_uVVGsAAApNiv469KGTRX0ZtpBBA/copy', '_blank')}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 underline underline-offset-2 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Make a Copy of Master Template</span>
                </button>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Title, Type, Platform, Seasons, Episodes, Genre, Year, Status, Rating, Notes, Who, Max Ep, Poster.
                Any rows you update in this Netflix view will sync right back to your Google Sheet!
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
            {isConnected ? (
              <button
                id="disconnect-sheets-btn"
                type="button"
                onClick={onDisconnect}
                className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
              >
                Disconnect Sheet
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-2 cursor-pointer"
              >
                Close
              </button>
              <button
                id="sync-now-btn"
                type="button"
                disabled={fetchingSheets || isLoading}
                onClick={handleTestOrLoadTabs}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-4 py-2 rounded-md shadow-md transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${fetchingSheets || isLoading ? 'animate-spin' : ''}`} />
                <span>{isConnected ? 'Re-Sync Now' : 'Connect & Load Sheet'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
