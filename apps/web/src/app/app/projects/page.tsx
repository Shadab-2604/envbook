'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Folder,
  FileText,
  Plus,
  Search,
  ExternalLink,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
} from 'lucide-react';
import { useVault } from '@/contexts/VaultContext';
import {
  apiGetEntries,
  apiCreateEntry,
  apiDeleteEntry,
} from '@/lib/api';
import { EntryRecord, DecryptedNotePayload, TEMPLATES } from '@envbook/shared';

interface ProjectItem {
  record: EntryRecord;
  payload: DecryptedNotePayload;
}

export default function ProjectsPage() {
  const router = useRouter();
  const vault = useVault();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('project');

  useEffect(() => {
    document.title = 'Project Library — EnvBook';
  }, []);

  const loadProjects = useCallback(async () => {
    if (!vault.isUnlocked) return;

    try {
      setLoading(true);
      // Fetch pages that have 'project' or 'prd' tags or type
      const res = await apiGetEntries({ isDeleted: false });
      const decryptedList: ProjectItem[] = [];

      for (const rec of res.entries) {
        if (rec.type === 'page' || rec.type === 'folder') {
          try {
            const payload = await vault.decrypt<DecryptedNotePayload>(
              rec.encryptedPayload,
              rec.nonce,
              rec.entryId
            );
            if (
              payload.tags?.includes('project') ||
              payload.tags?.includes('prd') ||
              rec.type === 'folder'
            ) {
              decryptedList.push({ record: rec, payload });
            }
          } catch (err) {
            console.error('Failed to decrypt project entry:', rec.entryId, err);
          }
        }
      }

      setProjects(decryptedList);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, [vault]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async () => {
    if (!projectName.trim() || !vault.isUnlocked) return;

    try {
      const entryId = crypto.randomUUID();
      const templateContent =
        TEMPLATES.find((t) => t.id === selectedTemplate)?.content || '# Project Overview';

      const payload: DecryptedNotePayload = {
        title: projectName.trim(),
        content: `# ${projectName.trim()}\n\n${templateContent}`,
        tags: ['project', selectedTemplate],
        createdAt: new Date().toISOString(),
      };

      const { ciphertext, nonce } = await vault.encrypt(payload, entryId);
      await apiCreateEntry({
        entryId,
        type: 'page',
        encryptedPayload: ciphertext,
        nonce,
      });

      setIsNewProjectModalOpen(false);
      setProjectName('');
      router.push(`/app/page/${entryId}`);
    } catch (err: any) {
      alert(`Failed to create project: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Move project to Trash?')) return;
    try {
      await apiDeleteEntry(id);
      await loadProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const filteredProjects = projects.filter(
    (p) =>
      searchQuery === '' ||
      p.payload.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.payload.tags && p.payload.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      {/* Top Header */}
      <header className="h-12 border-b border-border-subtle bg-surface/90 backdrop-blur px-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <Link href="/app" className="text-text-muted hover:text-text-primary text-xs font-label-mono">
            EnvBook
          </Link>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <span className="text-text-secondary text-xs font-label-mono">Workspace</span>
          <span className="text-mask-glyph font-label-mono text-xs">/</span>
          <h1 className="text-text-primary text-xs font-medium flex items-center gap-1.5 inline-flex">
            <Folder className="w-3.5 h-3.5 text-primary" />
            Project Library
          </h1>
          <span className="ml-1 text-[10px] font-label-mono text-text-muted bg-surface-panel border border-border-subtle px-1.5 py-0.2 rounded">
            {projects.length} projects
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="px-3 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="h-11 px-4 bg-surface-subtle border-b border-border-subtle flex items-center justify-between shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-label-mono text-text-muted">Technical projects, specs &amp; PRDs</span>
        </div>

        <div className="relative w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-surface-panel border border-border-subtle rounded pl-8 pr-2.5 py-1 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
          />
        </div>
      </div>

      {/* Main Grid */}
      <main className="flex-1 overflow-y-auto p-6 max-w-6xl mx-auto w-full mono-scroll">
        {loading ? (
          <div className="text-center py-16 text-xs text-text-muted font-label-mono">
            Decrypting projects...
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border-subtle rounded-lg">
            <Folder className="w-8 h-8 text-primary/50 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-text-primary mb-1">No Projects Found</h3>
            <p className="text-xs text-text-muted font-label-mono mb-4">
              Create structured project roadmaps, architecture PRDs, or API documentation.
            </p>
            <button
              onClick={() => setIsNewProjectModalOpen(true)}
              className="px-3 py-1.5 rounded bg-primary-container text-on-primary-container text-xs font-semibold"
            >
              Create First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map(({ record, payload }) => (
              <div
                key={record.entryId}
                className="p-4 rounded-lg bg-surface-panel border border-border-subtle hover:border-border-muted hover:bg-surface-raised/40 transition-all flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-8 h-8 rounded bg-surface border border-border-subtle flex items-center justify-center text-primary shrink-0">
                        <Folder className="w-4 h-4" />
                      </div>
                      <Link
                        href={`/app/page/${record.entryId}`}
                        className="text-sm font-semibold text-text-primary hover:text-primary transition-colors truncate"
                      >
                        {payload.title}
                      </Link>
                    </div>

                    <button
                      onClick={() => handleDelete(record.entryId)}
                      className="p-1 text-text-muted hover:text-status-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {payload.tags && payload.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {payload.tags.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.2 rounded bg-surface border border-border-subtle text-[10px] font-label-mono text-text-muted"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle/50 text-xs">
                  <span className="text-[10px] font-label-mono text-text-muted">
                    {new Date(record.updatedAt).toLocaleDateString()}
                  </span>

                  <Link
                    href={`/app/page/${record.entryId}`}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-accent-emerald-bright font-label-ui font-medium"
                  >
                    <span>Open Specs</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Project Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface-panel border border-border-subtle rounded-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-surface-subtle">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-text-primary">Create New Project</h3>
              </div>
              <button onClick={() => setIsNewProjectModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-xs font-body-sm">
              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Project Title *
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Auth Gateway v2 or Payments Engine"
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] font-label-mono uppercase text-text-muted mb-1">
                  Project Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-accent"
                >
                  <option value="project">Standard Project Architecture</option>
                  <option value="prd">Complete PRD Template</option>
                  <option value="api">API Specification Template</option>
                </select>
              </div>
            </div>

            <div className="p-4 border-t border-border-subtle bg-surface-subtle flex justify-end gap-2">
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="px-3 py-1.5 rounded bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!projectName.trim()}
                className="px-3.5 py-1.5 rounded bg-primary-container text-on-primary-container hover:bg-accent-emerald-bright text-xs font-semibold disabled:opacity-50"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
