'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Globe,
  Link as LinkIcon,
  Users,
  Copy,
  Check,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Search,
  UserCheck,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import {
  apiGetShareSettings,
  apiUpdatePublicLink,
  apiRevokePublicLink,
  apiPublishPage,
  apiUnpublishPage,
  apiSearchUsers,
  apiAddCollaborator,
  apiUpdateCollaborator,
  apiRemoveCollaborator,
} from '@/lib/api';
import { PageShareRecord, CollaboratorRole } from '@envbook/shared';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pageId: string;
  pageTitle: string;
  pageContent: string;
}

export function ShareModal({
  isOpen,
  onClose,
  pageId,
  pageTitle,
  pageContent,
}: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<'link' | 'collab' | 'publish'>('link');
  const [loading, setLoading] = useState(true);
  const [share, setShare] = useState<PageShareRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Public Link state
  const [copiedLink, setCopiedLink] = useState(false);
  const [linkRole, setLinkRole] = useState<CollaboratorRole>('viewer');

  // Collaborator search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; email: string; name?: string }>>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; email: string; name?: string } | null>(null);
  const [collabRole, setCollabRole] = useState<CollaboratorRole>('viewer');
  const [inviting, setInviting] = useState(false);

  // Publishing state
  const [customSlug, setCustomSlug] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [copiedPublishUrl, setCopiedPublishUrl] = useState(false);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen || !pageId) return;

    async function fetchSettings() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiGetShareSettings(pageId);
        setShare(res.share);
        setLinkRole(res.share.publicAccessLevel || 'viewer');
        if (res.share.publishedSlug) {
          setCustomSlug(res.share.publishedSlug);
        } else {
          setCustomSlug(
            pageTitle
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '') || 'page'
          );
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load sharing settings');
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [isOpen, pageId, pageTitle]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiSearchUsers(searchQuery.trim());
        setSearchResults(res.users);
      } catch {
        setSearchResults([]);
      }
    }, 250);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleTogglePublicLink = async (enable: boolean) => {
    try {
      setError(null);
      const res = await apiUpdatePublicLink(pageId, {
        isEnabled: enable,
        accessLevel: linkRole,
      });
      setShare(res.share);
      showSuccess(enable ? 'Public link generated' : 'Public link disabled');
    } catch (err: any) {
      setError(err.message || 'Failed to update public link');
    }
  };

  const handleRevokePublicLink = async () => {
    if (!confirm('Revoke public link? Anyone with the existing link will lose access immediately.')) return;
    try {
      setError(null);
      await apiRevokePublicLink(pageId);
      setShare((prev) =>
        prev
          ? {
              ...prev,
              isPublicLinkEnabled: false,
              publicShareToken: null,
              publicUrl: undefined,
            }
          : null
      );
      showSuccess('Public share link revoked');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedUser) return;
    try {
      setInviting(true);
      setError(null);
      const res = await apiAddCollaborator(pageId, {
        usernameOrEmail: selectedUser.username,
        role: collabRole,
      });
      setShare(res.share);
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      showSuccess(`Added @${selectedUser.username} as ${collabRole}`);
    } catch (err: any) {
      setError(err.message || 'Failed to add collaborator');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateCollaboratorRole = async (userId: string, newRole: CollaboratorRole) => {
    try {
      setError(null);
      const res = await apiUpdateCollaborator(pageId, userId, { role: newRole });
      setShare(res.share);
      showSuccess('Collaborator permission updated');
    } catch (err: any) {
      setError(err.message || 'Failed to update collaborator role');
    }
  };

  const handleRemoveCollaborator = async (userId: string, username: string) => {
    if (!confirm(`Revoke access for @${username}?`)) return;
    try {
      setError(null);
      const res = await apiRemoveCollaborator(pageId, userId);
      setShare(res.share);
      showSuccess(`Access revoked for @${username}`);
    } catch (err: any) {
      setError(err.message || 'Failed to remove collaborator');
    }
  };

  const handlePublish = async () => {
    try {
      setPublishing(true);
      setError(null);
      const res = await apiPublishPage(pageId, {
        slug: customSlug,
        title: pageTitle,
        content: pageContent,
      });
      setShare(res.share);
      showSuccess('Page published to the web!');
    } catch (err: any) {
      setError(err.message || 'Failed to publish page');
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!confirm('Unpublish this page? Unauthenticated public visitors will immediately lose access.')) return;
    try {
      setPublishing(true);
      setError(null);
      await apiUnpublishPage(pageId);
      setShare((prev) =>
        prev
          ? {
              ...prev,
              isPublished: false,
              publishedSlug: null,
              publishedUrl: undefined,
            }
          : null
      );
      showSuccess('Page unpublished');
    } catch (err: any) {
      setError(err.message || 'Failed to unpublish page');
    } finally {
      setPublishing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-surface-elevated border border-border-muted rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface-panel/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-surface-raised border border-border-muted flex items-center justify-center">
              <Share2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Share & Collaboration</h2>
              <p className="text-[11px] text-text-muted truncate max-w-xs">{pageTitle || 'Untitled Note'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border-subtle bg-surface-subtle px-5 pt-2 gap-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'link'
                ? 'border-primary text-text-primary font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Public Link</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('collab')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'collab'
                ? 'border-primary text-text-primary font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Collaborators</span>
            {share && share.collaborators.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-surface-raised rounded-full text-[10px] font-mono">
                {share.collaborators.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('publish')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors border-b-2 ${
              activeTab === 'publish'
                ? 'border-primary text-text-primary font-semibold'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publish to Web</span>
            {share?.isPublished && (
              <span className="w-2 h-2 rounded-full bg-primary ml-1" />
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 min-h-[300px] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded bg-surface-raised border border-border-muted text-text-primary text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-primary shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48 text-xs font-mono text-text-muted">
              Loading share configuration...
            </div>
          ) : (
            <>
              {/* TAB 1: PUBLIC LINK */}
              {activeTab === 'link' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-panel border border-border-muted">
                    <div>
                      <span className="font-semibold text-text-primary block mb-0.5">
                        Share with anyone with link
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Generates a unique, high-entropy cryptographic token for instant access.
                      </span>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(share?.isPublicLinkEnabled)}
                        onChange={(e) => handleTogglePublicLink(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-raised peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {share?.isPublicLinkEnabled && share?.publicShareToken && (
                    <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface-subtle border border-border-muted">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={
                            typeof window !== 'undefined'
                              ? `${window.location.origin}/s/${share.publicShareToken}`
                              : `/s/${share.publicShareToken}`
                          }
                          className="flex-1 px-3 py-1.5 bg-surface-canvas border border-border-muted rounded text-xs font-mono text-text-secondary select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyLink(`/s/${share.publicShareToken}`)}
                          className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-muted text-text-primary flex items-center gap-1.5 transition-colors"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Access Level:</span>
                          <select
                            value={linkRole}
                            onChange={(e) => {
                              const r = e.target.value as CollaboratorRole;
                              setLinkRole(r);
                              apiUpdatePublicLink(pageId, { isEnabled: true, accessLevel: r });
                            }}
                            className="bg-surface-panel border border-border-muted rounded px-2 py-1 text-text-primary text-xs focus:outline-none"
                          >
                            <option value="viewer">Can View</option>
                            <option value="editor">Can Edit</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={handleRevokePublicLink}
                          className="btn-destructive-outline px-2.5 py-1 rounded text-xs transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          <span>Revoke Link</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Security Boundary Notice */}
                  <div className="p-3 rounded-lg bg-surface-panel/60 border border-border-muted text-[11px] text-text-muted flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-text-primary block mb-0.5">Zero-Leakage Privacy Boundary</span>
                      Public link sharing grants access exclusively to this individual page. Environment variables, credential items, secret-bearing vaults, and unpublished subpages are never exposed.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PRIVATE COLLABORATORS */}
              {activeTab === 'collab' && (
                <div className="flex flex-col gap-4 text-xs">
                  {/* User Search Picker */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-text-secondary">
                      Invite registered EnvBook user
                    </label>
                    <div className="flex items-center gap-2 relative">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search username or email address..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-surface-panel border border-border-muted rounded text-xs text-text-primary placeholder:text-text-muted focus:border-accent-emerald focus:ring-1 focus:ring-accent-emerald"
                        />
                      </div>

                      <select
                        value={collabRole}
                        onChange={(e) => setCollabRole(e.target.value as CollaboratorRole)}
                        className="bg-surface-panel border border-border-muted rounded px-2.5 py-1.5 text-text-primary text-xs"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>

                      <button
                        type="button"
                        disabled={!selectedUser || inviting}
                        onClick={handleAddCollaborator}
                        className="px-3 py-1.5 rounded bg-primary text-surface-canvas font-semibold hover:opacity-90 disabled:opacity-40 transition-colors shrink-0 shadow-sm"
                      >
                        {inviting ? 'Inviting...' : 'Invite'}
                      </button>
                    </div>

                    {/* Search results dropdown */}
                    {searchResults.length > 0 && !selectedUser && (
                      <div className="bg-surface-raised border border-border-muted rounded-md shadow-xl max-h-40 overflow-y-auto divide-y divide-border-subtle z-20">
                        {searchResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setSearchQuery(`@${u.username}`);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface-panel transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary font-mono text-[10px] flex items-center justify-center font-bold">
                                {u.username.slice(0, 1).toUpperCase()}
                              </div>
                              <span className="font-semibold text-text-primary">@{u.username}</span>
                              <span className="text-[11px] text-text-muted truncate max-w-[140px]">{u.email}</span>
                            </div>
                            <span className="text-[10px] text-primary font-mono">Select</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {selectedUser && (
                      <div className="flex items-center gap-2 p-2 rounded bg-surface-subtle border border-primary/30 text-xs">
                        <UserCheck className="w-3.5 h-3.5 text-primary" />
                        <span className="text-text-primary font-medium">Selected: @{selectedUser.username}</span>
                        <span className="text-text-muted">({selectedUser.email})</span>
                        <button
                          type="button"
                          onClick={() => setSelectedUser(null)}
                          className="ml-auto text-text-muted hover:text-text-primary"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Collaborator List */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
                      People with access ({1 + (share?.collaborators.length || 0)})
                    </span>

                    {/* Owner row */}
                    <div className="flex items-center justify-between p-2 rounded bg-surface-panel/50 border border-border-subtle">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-surface-raised border border-border-muted flex items-center justify-center font-mono text-xs font-bold text-primary">
                          O
                        </div>
                        <div>
                          <span className="font-medium text-text-primary block leading-none">You</span>
                          <span className="text-[10px] text-text-muted">Workspace Owner</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-primary uppercase bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        Owner
                      </span>
                    </div>

                    {/* Collaborator rows */}
                    {share?.collaborators.map((c) => (
                      <div
                        key={c.userId}
                        className="flex items-center justify-between p-2 rounded bg-surface-panel border border-border-subtle hover:border-border-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-surface-raised flex items-center justify-center font-mono text-xs text-text-secondary">
                            {c.username.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-text-primary block leading-none">@{c.username}</span>
                            <span className="text-[10px] text-text-muted">{c.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={c.role}
                            onChange={(e) =>
                              handleUpdateCollaboratorRole(c.userId, e.target.value as CollaboratorRole)
                            }
                            className="bg-surface-subtle border border-border-muted rounded px-2 py-0.5 text-xs text-text-primary"
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                          </select>
                          <button
                            type="button"
                            title="Remove collaborator"
                            onClick={() => handleRemoveCollaborator(c.userId, c.username)}
                            className="p-1 rounded text-destructive hover:bg-destructive/15 border border-transparent hover:border-destructive/30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: PUBLISH TO WEB */}
              {activeTab === 'publish' && (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-surface-panel border border-border-muted">
                    <div>
                      <span className="font-semibold text-text-primary block mb-0.5">
                        Publish to Public Web
                      </span>
                      <span className="text-text-muted text-[11px]">
                        Generates a public, search-engine indexable web page with clean URL slug.
                      </span>
                    </div>

                    {share?.isPublished ? (
                      <button
                        type="button"
                        onClick={handleUnpublish}
                        disabled={publishing}
                        className="btn-destructive-outline px-3 py-1.5 rounded text-xs transition-colors"
                      >
                        {publishing ? 'Updating...' : 'Unpublish'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={publishing}
                        className="px-3.5 py-1.5 rounded bg-primary text-surface-canvas font-semibold hover:opacity-90 transition-colors shadow-sm"
                      >
                        {publishing ? 'Publishing...' : 'Publish to Web'}
                      </button>
                    )}
                  </div>

                  {/* Slug Customization */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-text-secondary">
                      Custom Web Slug
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-text-muted text-xs bg-surface-panel px-2.5 py-1.5 rounded border border-border-muted shrink-0">
                        /p/
                      </span>
                      <input
                        type="text"
                        disabled={Boolean(share?.isPublished)}
                        value={customSlug}
                        onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                        placeholder="clean-url-slug"
                        className="flex-1 px-3 py-1.5 bg-surface-panel border border-border-muted rounded text-xs font-mono text-text-primary focus:border-border-focus focus:ring-1 focus:ring-border-focus disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Published URL details */}
                  {share?.isPublished && share?.publishedSlug && (
                    <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface-subtle border border-border-muted">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                          <span className="font-semibold text-text-primary text-xs">Live on Web</span>
                        </div>
                        {share.publishedAt && (
                          <span className="text-[10px] text-text-muted font-mono">
                            Published {new Date(share.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={
                            typeof window !== 'undefined'
                              ? `${window.location.origin}/p/${share.publishedSlug}`
                              : `/p/${share.publishedSlug}`
                          }
                          className="flex-1 px-3 py-1.5 bg-surface-canvas border border-border-muted rounded text-xs font-mono text-text-secondary select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopyLink(`/p/${share.publishedSlug}`)}
                          className="px-2.5 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-muted text-text-primary flex items-center gap-1 transition-colors"
                        >
                          {copiedLink ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                        </button>
                        <a
                          href={`/p/${share.publishedSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded bg-surface-panel hover:bg-surface-raised border border-border-muted text-text-primary flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-primary" />
                          <span>Preview</span>
                        </a>
                      </div>

                      <div className="pt-2 border-t border-border-subtle/40 flex justify-end">
                        <button
                          type="button"
                          onClick={handlePublish}
                          disabled={publishing}
                          className="text-[11px] text-primary hover:underline font-mono"
                        >
                          {publishing ? 'Updating...' : 'Republish latest changes'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle bg-surface-panel/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-surface-raised hover:bg-surface-panel border border-border-subtle text-xs text-text-primary transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
