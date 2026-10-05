import React, { useState, useEffect } from 'react';
import { X, Check, Users, Edit3, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { getViewerColor } from '../utils/profileColors';
import { ShowItem } from '../types';

interface NetflixProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  customViewers: string[];
  activeProfile?: string;
  onSwitchProfile?: (profile: string) => void;
  viewerColors?: Record<string, string>;
  onUpdateViewerColors?: (colors: Record<string, string>) => void;
  viewerAvatars?: Record<string, string>;
  onUpdateViewerAvatars?: (avatars: Record<string, string>) => void;
  onUpdateCustomViewers?: (viewers: string[], colors?: Record<string, string>) => void;
  shows?: ShowItem[];
  onOpenManageProfiles?: () => void;
}

const COLOR_SWATCHES = [
  '#E50914', // Netflix Red
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#eab308', // Yellow
];

export default function NetflixProfileSwitcherModal({
  isOpen,
  onClose,
  customViewers,
  activeProfile = '',
  onSwitchProfile,
  viewerColors = {},
  viewerAvatars = {},
  onUpdateViewerColors,
  onUpdateViewerAvatars,
  onUpdateCustomViewers,
  shows = [],
}: NetflixProfileSwitcherModalProps) {
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editingViewer, setEditingViewer] = useState<string | null>(null); // viewer name or '__NEW_PROFILE__'

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#E50914');

  // Close on Escape key & manage scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingViewer) {
          setEditingViewer(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const prevTop = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, parseInt(prevTop || '0', 10) * -1);
    };
  }, [isOpen, onClose, editingViewer]);

  if (!isOpen) return null;

  const handleSelect = (profileName: string) => {
    if (isEditingMode) return;
    if (onSwitchProfile) {
      onSwitchProfile(profileName);
    }
    onClose();
    if (profileName) {
      toast.success(`Switched to "${profileName}"'s profile`, {
        icon: '👤',
        duration: 5000,
        style: {
          background: '#181818',
          color: '#fff',
          border: '1px solid #333',
        },
      });
    } else {
      toast.success('Viewing All Household Profiles', {
        icon: '👥',
        duration: 5000,
        style: {
          background: '#181818',
          color: '#fff',
          border: '1px solid #333',
        },
      });
    }
  };

  const handleOpenEditPopup = (viewer: string) => {
    setEditingViewer(viewer);
    setEditName(viewer);
    setEditColor(getViewerColor(viewer, viewerColors));
  };

  const handleOpenAddPopup = () => {
    setEditingViewer('__NEW_PROFILE__');
    setEditName('');
    setEditColor('#E50914');
  };

  const handleSaveProfileChanges = () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('Profile name cannot be empty');
      return;
    }

    const currentList = customViewers.length > 0 ? customViewers : ['Me', 'Family', 'Guest'];

    if (editingViewer === '__NEW_PROFILE__') {
      // Adding new profile
      if (currentList.some((v) => v.toLowerCase() === trimmedName.toLowerCase())) {
        toast.error(`Profile "${trimmedName}" already exists`);
        return;
      }
      const updatedList = [...currentList, trimmedName];
      if (onUpdateCustomViewers) {
        onUpdateCustomViewers(updatedList);
      }

      if (onUpdateViewerColors) {
        const updatedColors = { ...viewerColors, [trimmedName]: editColor };
        onUpdateViewerColors(updatedColors);
      }

      toast.success(`✨ Added profile: "${trimmedName}"`, { duration: 5000 });
      setEditingViewer(null);
    } else if (editingViewer) {
      // Editing existing profile
      if (trimmedName !== editingViewer) {
        if (currentList.some((v) => v.toLowerCase() === trimmedName.toLowerCase())) {
          toast.error(`Profile "${trimmedName}" already exists`);
          return;
        }
        const updatedList = currentList.map((v) => (v === editingViewer ? trimmedName : v));
        if (onUpdateCustomViewers) {
          onUpdateCustomViewers(updatedList);
        }
        if (activeProfile === editingViewer && onSwitchProfile) {
          onSwitchProfile(trimmedName);
        }
      }

      if (onUpdateViewerColors) {
        const updatedColors = { ...viewerColors, [trimmedName]: editColor };
        onUpdateViewerColors(updatedColors);
      }

      toast.success(`✅ Saved changes for "${trimmedName}"`, { duration: 4000 });
      setEditingViewer(null);
    }
  };

  // Helper to count shows matching a profile
  const countForProfile = (profileName: string) => {
    if (!profileName) return shows.length;
    const norm = profileName.trim().toLowerCase();
    return shows.filter((s) => {
      if (!s.who) return false;
      const showWho = String(s.who).trim().toLowerCase();
      return (
        showWho === norm ||
        showWho.includes(norm) ||
        showWho
          .split(/[&,\/]/)
          .map((p) => p.trim())
          .includes(norm)
      );
    }).length;
  };

  const currentList = customViewers.length > 0 ? customViewers : ['Me', 'Family', 'Guest'];

  return (
    <div
      id="netflix-profile-switcher-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="netflix-profile-switcher-modal-dialog"
        className="relative w-full max-w-3xl bg-[#141414] border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-900 border border-zinc-700 hover:border-white text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow-lg"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Header */}
        <div className="mb-6 sm:mb-8 space-y-1.5 sm:space-y-2">
          <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors ${
            isEditingMode
              ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-600/10 border-red-500/30 text-red-400'
          }`}>
            <span>{isEditingMode ? 'Manage Profiles' : 'Profile Switcher'}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
            {isEditingMode ? 'Edit Profiles' : "Who's watching?"}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto px-2">
            {isEditingMode
              ? 'Select a profile to customize name and colour tag, or tap Add Profile to create a new viewer.'
              : 'Select your personal profile to filter your watchlist, watching progress, and category shelves.'}
          </p>
        </div>

        {/* Profiles Grid */}
        <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap max-w-3xl mx-auto mb-4">
          {/* 1. All Profiles Tile (Normal) OR Add Profile Tile (Edit Mode) */}
          {!isEditingMode ? (
            <div
              onClick={() => handleSelect('')}
              className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95"
            >
              <div
                className={`relative w-20 h-20 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center bg-zinc-900 border-2 transition-all duration-200 shadow-lg ${
                  !activeProfile
                    ? 'border-red-500 ring-4 ring-red-500/30 shadow-red-950/60'
                    : 'border-zinc-800'
                }`}
              >
                <Users className="w-8 h-8 sm:w-12 sm:h-12 text-zinc-300" />
                {!activeProfile && (
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-600 flex items-center justify-center text-white shadow-md">
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                  </div>
                )}
              </div>
              <span className="mt-2 sm:mt-3 text-xs sm:text-base font-bold text-white font-black">
                All Profiles
              </span>
              <span className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
                {shows.length} titles
              </span>
            </div>
          ) : (
            <div
              onClick={handleOpenAddPopup}
              className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95 animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center bg-zinc-900/80 border-2 border-dashed border-zinc-700 hover:border-white transition-all duration-200 group-hover:scale-105 group-hover:bg-zinc-800 shadow-lg">
                <Plus className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-400 group-hover:text-white transition-colors" />
              </div>
              <span className="mt-2 sm:mt-3 text-xs sm:text-base font-bold text-zinc-300 group-hover:text-white transition-colors">
                Add Profile
              </span>
              <span className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
                New viewer
              </span>
            </div>
          )}

          {/* 2. Custom Configured Profile Viewers */}
          {currentList.map((viewer) => {
            const isSelected = activeProfile === viewer;
            const color = getViewerColor(viewer, viewerColors);
            const count = countForProfile(viewer);
            const avatarSymbol = viewer.charAt(0).toUpperCase();

            return (
              <div
                key={`netflix-profile-${viewer}`}
                onClick={() => {
                  if (isEditingMode) {
                    handleOpenEditPopup(viewer);
                  } else {
                    handleSelect(viewer);
                  }
                }}
                className="group relative flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95"
              >
                <div className="relative">
                  <div
                    style={{ backgroundColor: color }}
                    className={`w-20 h-20 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center text-white font-black text-2xl sm:text-4xl shadow-xl shadow-black/50 transition-all duration-200 group-hover:scale-105 overflow-hidden ${
                      isSelected && !isEditingMode
                        ? 'ring-4 ring-white shadow-2xl scale-102'
                        : 'ring-2 ring-transparent group-hover:ring-4 group-hover:ring-white/40'
                    }`}
                  >
                    <span>{avatarSymbol}</span>

                    {/* Transparent tile background with centered pencil icon when isEditingMode */}
                    {isEditingMode && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditPopup(viewer);
                        }}
                        className="absolute inset-0 rounded-2xl bg-black/40 border-2 border-white/70 flex items-center justify-center text-white cursor-pointer transition-all hover:bg-black/20 hover:border-white"
                        title="Edit Profile"
                      >
                        <Edit3 className="w-7 h-7 sm:w-9 sm:h-9 text-white drop-shadow-md" />
                      </div>
                    )}
                  </div>

                  {isSelected && !isEditingMode && (
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white flex items-center justify-center text-zinc-950 shadow-md">
                      <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 stroke-[3]" />
                    </div>
                  )}
                </div>

                <span
                  className={`mt-2 sm:mt-3 text-xs sm:text-base font-bold transition-colors truncate max-w-[90px] sm:max-w-[110px] ${
                    isSelected ? 'text-white font-black' : 'text-zinc-400 group-hover:text-white'
                  }`}
                >
                  {viewer}
                </span>
                <span className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
                  {count} titles
                </span>
              </div>
            );
          })}

          {/* 3. Edit Profiles / Done Tile at the end of the row */}
          <div
            onClick={() => setIsEditingMode(!isEditingMode)}
            className="group flex flex-col items-center cursor-pointer transition-all duration-200 hover:-translate-y-1 active:scale-95"
          >
            <div
              className={`w-20 h-20 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center border-2 transition-all duration-200 shadow-lg group-hover:scale-105 ${
                isEditingMode
                  ? 'border-emerald-500 ring-4 ring-emerald-500/30 bg-emerald-950/40 text-emerald-400'
                  : 'border-zinc-800 bg-zinc-900 group-hover:border-white group-hover:ring-4 group-hover:ring-white/20 text-zinc-300 group-hover:text-white'
              }`}
            >
              {isEditingMode ? <Check className="w-8 h-8 sm:w-12 sm:h-12" /> : <Edit3 className="w-8 h-8 sm:w-12 sm:h-12" />}
            </div>
            <span
              className={`mt-2 sm:mt-3 text-xs sm:text-base font-bold transition-colors ${
                isEditingMode ? 'text-emerald-400 font-black' : 'text-zinc-400 group-hover:text-white'
              }`}
            >
              {isEditingMode ? 'Done' : 'Edit profiles'}
            </span>
            <span className="text-[10px] sm:text-[11px] text-zinc-500 font-mono">
              {isEditingMode ? 'Save edit' : 'Customize'}
            </span>
          </div>
        </div>
      </div>

      {/* --- EDIT / ADD PROFILE POPUP --- */}
      {editingViewer !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setEditingViewer(null)}
        >
          <div
            className="relative w-full max-w-md bg-[#181818] border border-zinc-700/80 rounded-2xl p-6 sm:p-7 shadow-2xl text-left animate-in zoom-in-95 duration-200 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-red-500" />
                <span>{editingViewer === '__NEW_PROFILE__' ? 'Add New Profile' : `Edit Profile: ${editingViewer}`}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingViewer(null)}
                className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Popup Form Body: Picture on Left Side, Inputs on Right Side */}
            <div className="flex items-start gap-4 sm:gap-5">
              {/* Profile Picture Tile Preview on Left Side */}
              <div
                style={{
                  backgroundColor: editColor,
                  boxShadow: `0 8px 24px ${editColor}40`,
                }}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center text-white text-3xl sm:text-4xl font-black shadow-2xl shrink-0 ring-2 ring-white/30 mt-1 transition-colors duration-200"
              >
                <span>{editName.trim() ? editName.trim().charAt(0).toUpperCase() : 'P'}</span>
              </div>

              {/* Form Inputs on Right Side */}
              <div className="flex-1 space-y-4 min-w-0">
                {/* Field 1: Profile Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                    Profile Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter profile name..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    autoFocus
                  />
                </div>

                {/* Field 2: Change Colour */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                    Change Colour
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {COLOR_SWATCHES.map((hex) => {
                      const isSelected = editColor.toLowerCase() === hex.toLowerCase();
                      return (
                        <button
                          key={`color-swatch-${hex}`}
                          type="button"
                          onClick={() => setEditColor(hex)}
                          style={{ backgroundColor: hex }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                            isSelected
                              ? 'ring-4 ring-white scale-110 shadow-lg'
                              : 'hover:scale-105 opacity-80 hover:opacity-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Save / Done button */}
            <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingViewer(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfileChanges}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center gap-1.5 hover:scale-105 active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
