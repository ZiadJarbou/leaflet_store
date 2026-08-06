import { cssClass, cx } from '../../utils/styleClass';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { adminListBackups, adminCreateBackup, adminImportBackup, adminDeleteBackup, adminGetBackupSettings, adminSaveBackupSettings, adminDownloadFile, } from './adminApi';
import './AdminPage.css';
/* â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface BackupFile {
    name: string;
    size: number;
    created_at: string;
}
interface BackupSettings {
    auto_enabled: string;
    auto_hours: string;
    max_keep: string;
}
/* â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function fmtSize(bytes: number) {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1048576)
        return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
}
function fmtDate(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
function nextBackupLabel(hours: string, files: BackupFile[]) {
    if (!files.length)
        return 'No backups yet';
    const h = parseFloat(hours) || 24;
    const last = new Date(files[0].created_at);
    const next = new Date(last.getTime() + h * 3600000);
    const diff = next.getTime() - Date.now();
    if (diff <= 0)
        return 'Due now';
    const hh = Math.floor(diff / 3600000);
    const mm = Math.floor((diff % 3600000) / 60000);
    return hh > 0 ? `in ${hh}h ${mm}m` : `in ${mm}m`;
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   AdminBackup
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function AdminBackup() {
    const [files, setFiles] = useState<BackupFile[]>([]);
    const [settings, setSettings] = useState<BackupSettings>({ auto_enabled: '0', auto_hours: '24', max_keep: '20' });
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmDel, setConfirmDel] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [{ files: f }, s] = await Promise.all([
                adminListBackups() as Promise<{
                    files: BackupFile[];
                }>,
                adminGetBackupSettings() as Promise<BackupSettings>,
            ]);
            setFiles(f);
            setSettings(s);
        }
        catch (e: any) {
            setError(e.message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    async function handleCreate() {
        setCreating(true);
        setError('');
        setSuccess('');
        try {
            const f = await adminCreateBackup() as BackupFile & {
                ok: boolean;
            };
            setFiles(prev => [f, ...prev]);
            setSuccess(`Backup created: ${f.name}`);
        }
        catch (e: any) {
            setError(e.message);
        }
        finally {
            setCreating(false);
        }
    }
    async function handleImportBackup(file: File | null) {
        if (!file)
            return;
        if (!window.confirm('Importing a backup will replace the current database. A safety backup will be created first. Continue?')) {
            if (importInputRef.current)
                importInputRef.current.value = '';
            return;
        }
        setImporting(true);
        setError('');
        setSuccess('');
        try {
            const form = new FormData();
            form.append('backup', file);
            const result = await adminImportBackup(form) as {
                message?: string;
                safety_backup?: string;
            };
            setSuccess(result.message || `Backup imported. Safety backup: ${result.safety_backup || 'created'}.`);
            setTimeout(() => window.location.reload(), 1800);
        }
        catch (e: any) {
            setError(e.message);
        }
        finally {
            setImporting(false);
            if (importInputRef.current)
                importInputRef.current.value = '';
        }
    }
    function handleDelete(name: string) {
        setConfirmDel(name);
    }
    async function doDelete(name: string) {
        setConfirmDel(null);
        setDeleting(name);
        setError('');
        try {
            await adminDeleteBackup(name);
            setFiles(prev => prev.filter(f => f.name !== name));
            setSuccess(`Backup "${name}" deleted.`);
        }
        catch (e: any) {
            setError(e.message);
        }
        finally {
            setDeleting(null);
        }
    }
    async function handleDownload(name: string) {
        setError('');
        try {
            await adminDownloadFile(`/backup/download/${encodeURIComponent(name)}`, name);
        }
        catch (e: any) {
            setError(e.message);
        }
    }
    async function handleSaveSettings(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');
        try {
            await adminSaveBackupSettings(settings);
            setSuccess('Auto-backup settings saved.');
        }
        catch (e: any) {
            setError(e.message);
        }
        finally {
            setSaving(false);
        }
    }
    const lastBackup = files[0] ?? null;
    const isAutoOn = settings.auto_enabled === '1';
    return (<div className="cms-section">
      <div className="cms-section-header">
        <h2 className="cms-section-title">
          Backup &amp; Restore
          <span className="cms-count"> - {files.length} backup{files.length !== 1 ? 's' : ''}</span>
        </h2>
        <div className="bk-header-actions">
          <input ref={importInputRef} className="bk-import-input" type="file" accept=".db.gz,application/gzip" onChange={e => handleImportBackup(e.target.files?.[0] || null)}/>
          <button className="cms-btn" type="button" onClick={() => importInputRef.current?.click()} disabled={importing || creating}>
            {importing ? <><span className="material-symbol" aria-hidden="true">progress_activity</span> Importing...</> : <><span className="material-symbol" aria-hidden="true">upload_file</span> Import Backup Data</>}
          </button>
          <button className="cms-btn cms-btn-primary" onClick={handleCreate} disabled={creating || importing}>
            {creating ? <><span className="material-symbol" aria-hidden="true">progress_activity</span> Creating...</> : <><span className="material-symbol" aria-hidden="true">download</span> Create Backup Now</>}
          </button>
        </div>
      </div>

      {error && <div className={cx("cms-error", cssClass({ marginBottom: 12 }))}>{error}</div>}
      {success && <div className={cx("cms-success", cssClass({ marginBottom: 12 }))}>{success}</div>}

      {/* â”€â”€ Status cards â”€â”€ */}
      <div className={cx("cms-stat-grid", cssClass({ marginBottom: 24 }))}>
        <div className="cms-stat-card">
          <div className="cms-stat-icon">source</div>
          <div className="cms-stat-body">
            <div className="cms-stat-value">{files.length}</div>
            <div className="cms-stat-label">Total Backups</div>
          </div>
        </div>
        <div className="cms-stat-card">
          <div className="cms-stat-icon">schedule</div>
          <div className="cms-stat-body">
            <div className={cx("cms-stat-value", cssClass({ fontSize: '1rem' }))}>
              {lastBackup ? fmtDate(lastBackup.created_at) : '-'}
            </div>
            <div className="cms-stat-label">Last Backup</div>
          </div>
        </div>
        <div className="cms-stat-card">
          <div className="cms-stat-icon">{isAutoOn ? 'check_circle' : 'cancel'}</div>
          <div className="cms-stat-body">
            <div className={cx("cms-stat-value", cssClass({ fontSize: '1rem' }))}>
              {isAutoOn ? `Every ${settings.auto_hours}h` : 'Disabled'}
            </div>
            <div className="cms-stat-label">Auto-Backup</div>
          </div>
        </div>
        <div className="cms-stat-card">
          <div className="cms-stat-icon">fast_forward</div>
          <div className="cms-stat-body">
            <div className={cx("cms-stat-value", cssClass({ fontSize: '1rem' }))}>
              {isAutoOn ? nextBackupLabel(settings.auto_hours, files) : '-'}
            </div>
            <div className="cms-stat-label">Next Backup</div>
          </div>
        </div>
      </div>

      <div className="bk-grid">

        {/* â”€â”€ Auto-backup settings â”€â”€ */}
        <div className="cms-card">
          <div className="cms-card-title"><span className="material-symbol" aria-hidden="true">settings</span> Auto-Backup Schedule</div>
          <form onSubmit={handleSaveSettings} className={cssClass({ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 })}>

            <label className="bk-field">
              <span className="bk-label">Auto-Backup</span>
              <div className="bk-toggle-row">
                <button type="button" className={`bk-toggle ${isAutoOn ? 'on' : ''}`} onClick={() => setSettings(s => ({ ...s, auto_enabled: isAutoOn ? '0' : '1' }))}>
                  <span className="bk-toggle-knob"/>
                </button>
                <span className="bk-toggle-lbl">{isAutoOn ? 'Enabled' : 'Disabled'}</span>
              </div>
            </label>

            <label className="bk-field">
              <span className="bk-label">Interval (hours)</span>
              <div className="bk-interval-row">
                {[6, 12, 24, 48, 168].map(h => (<button key={h} type="button" className={`bk-pill${settings.auto_hours === String(h) ? ' active' : ''}`} onClick={() => setSettings(s => ({ ...s, auto_hours: String(h) }))}>
                    {h === 168 ? '7d' : h + 'h'}
                  </button>))}
                <input type="number" min="1" max="720" value={settings.auto_hours} onChange={e => setSettings(s => ({ ...s, auto_hours: e.target.value }))} className="bk-num-input" title="Custom hours"/>
              </div>
            </label>

            <label className="bk-field">
              <span className="bk-label">Keep last N backups</span>
              <input type="number" min="1" max="100" value={settings.max_keep} onChange={e => setSettings(s => ({ ...s, max_keep: e.target.value }))} className={cx("bk-num-input", cssClass({ width: 80 }))}/>
            </label>

            <button type="submit" className={cx("cms-btn cms-btn-primary", cssClass({ alignSelf: 'flex-start', marginTop: 4 }))} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        {/* â”€â”€ Backup list â”€â”€ */}
        <div className={cx("cms-card", cssClass({ flex: 1 }))}>
          <div className="cms-card-title"><span className="material-symbol" aria-hidden="true">inventory_2</span> Backup Files</div>
          {loading ? (<div className={cx("cms-loading", cssClass({ padding: '24px 0' }))}>Loading...</div>) : files.length === 0 ? (<div className="bk-empty">No backups yet. Click "Create Backup Now" to start.</div>) : (<div className="bk-list">
              {files.map((f, i) => (<div key={f.name} className={`bk-row${i === 0 ? ' bk-row-latest' : ''}`}>
                  <div className="bk-row-icon">
                    {i === 0 ? 'star' : 'inventory_2'}
                  </div>
                  <div className="bk-row-info">
                    <div className="bk-row-name">{f.name}</div>
                    <div className="bk-row-meta">
                      {fmtDate(f.created_at)} &nbsp;-&nbsp; {fmtSize(f.size)}
                      {i === 0 && <span className="bk-badge-latest">latest</span>}
                    </div>
                  </div>
                  <div className="bk-row-actions">
                    <button className="cms-btn cms-btn-sm material-symbol" onClick={() => handleDownload(f.name)} title="Download" aria-label="Download">
                      download
                    </button>
                    <button className="cms-btn cms-btn-sm cms-btn-danger material-symbol" onClick={() => handleDelete(f.name)} disabled={deleting === f.name} title="Delete" aria-label="Delete">
                      {deleting === f.name ? 'progress_activity' : 'delete'}
                    </button>
                  </div>
                </div>))}
            </div>)}
        </div>

      </div>

      {/* â”€â”€ Delete confirmation modal â”€â”€ */}
      {confirmDel && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">delete Delete Backup?</div>
            <p className="cms-modal-body">
              <code className={cssClass({ wordBreak: 'break-all', fontSize: '.8rem', color: '#94a3b8' })}>{confirmDel}</code>
              <br /><br />
              This backup will be permanently removed and cannot be recovered.
            </p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={() => doDelete(confirmDel)}>Delete</button>
            </div>
          </div>
        </div>)}
    </div>);
}

