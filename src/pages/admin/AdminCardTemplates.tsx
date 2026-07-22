import { cssClass } from '../../utils/styleClass';
import { useEffect, useState } from 'react';
import LayoutCustomizer from '../../components/LayoutCustomizer';
import { LayoutThumbnail } from '../../components/CardTemplateModal';
import { deleteLayoutTemplate, getLayoutTemplates, savePlatformLayoutTemplate, updateLayoutTemplate, type CardLayout, type LayoutTemplate } from '../../services/api';
import { adminGetSettings, adminSaveSettings } from './adminApi';
import './AdminPage.css';
const EMPTY_LAYOUT = {} as CardLayout;
export default function AdminCardTemplates() {
    const [templates, setTemplates] = useState<LayoutTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [designerOpen, setDesignerOpen] = useState(false);
    const [draftLayout, setDraftLayout] = useState<CardLayout>(EMPTY_LAYOUT);
    const [defaultTemplateId, setDefaultTemplateId] = useState<number | null>(null);
    const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<LayoutTemplate | null>(null);
    const [viewingTemplate, setViewingTemplate] = useState<LayoutTemplate | null>(null);
    const [renamingTemplate, setRenamingTemplate] = useState<LayoutTemplate | null>(null);
    const [deletingTemplate, setDeletingTemplate] = useState<LayoutTemplate | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [busyTemplateId, setBusyTemplateId] = useState<number | null>(null);
    async function load() {
        setLoading(true);
        setError(null);
        try {
            const [res, settings] = await Promise.all([
                getLayoutTemplates(),
                adminGetSettings() as Promise<Record<string, string>>,
            ]);
            setTemplates(res.templates);
            const id = parseInt(String(settings.default_card_template_id || ''), 10);
            setDefaultTemplateId(Number.isNaN(id) ? null : id);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load card templates.');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);
    async function saveTemplate(layout: CardLayout) {
        const name = (editingTemplate ? editingTemplate.name : templateName).trim();
        if (!name)
            throw new Error('Enter a template name before saving.');
        if (editingTemplate) {
            const res = await updateLayoutTemplate(editingTemplate.id, { name, layout, is_platform: true });
            setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? res.template : t));
            setSuccess(`"${name}" template updated.`);
        }
        else {
            const res = await savePlatformLayoutTemplate(name, layout);
            setTemplates(prev => [res.template, ...prev]);
            setTemplateName('');
            setSuccess(`"${name}" saved as a platform card template.`);
        }
        setDraftLayout(layout);
        setEditingTemplate(null);
        setTimeout(() => setSuccess(null), 2500);
    }
    async function setAsDefault(template: LayoutTemplate) {
        setSettingDefaultId(template.id);
        setError(null);
        try {
            if (template.is_platform !== true && template.is_default !== true) {
                const promoted = await updateLayoutTemplate(template.id, { name: template.name, layout: template.layout, is_platform: true });
                setTemplates(prev => prev.map(t => t.id === template.id ? promoted.template : t));
            }
            await adminSaveSettings({ default_card_template_id: String(template.id) });
            setDefaultTemplateId(template.id);
            setSuccess(`"${template.name}" is now the default card template for new leaflets.`);
            setTimeout(() => setSuccess(null), 2500);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to set default card template.');
        }
        finally {
            setSettingDefaultId(null);
        }
    }
    function openEdit(template: LayoutTemplate) {
        setEditingTemplate(template);
        setDraftLayout(template.layout);
        setDesignerOpen(true);
    }
    function openRename(template: LayoutTemplate) {
        setRenamingTemplate(template);
        setRenameValue(template.name);
    }
    async function confirmRename() {
        if (!renamingTemplate)
            return;
        const name = renameValue.trim();
        if (!name) {
            setError('Template name is required.');
            return;
        }
        setBusyTemplateId(renamingTemplate.id);
        setError(null);
        try {
            const res = await updateLayoutTemplate(renamingTemplate.id, { name, layout: renamingTemplate.layout, is_platform: true });
            setTemplates(prev => prev.map(t => t.id === renamingTemplate.id ? res.template : t));
            setSuccess(`Template renamed to "${name}".`);
            setRenamingTemplate(null);
            setTimeout(() => setSuccess(null), 2500);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to rename template.');
        }
        finally {
            setBusyTemplateId(null);
        }
    }
    async function deleteTemplate(template: LayoutTemplate) {
        setBusyTemplateId(template.id);
        setError(null);
        try {
            await deleteLayoutTemplate(template.id);
            setTemplates(prev => prev.filter(t => t.id !== template.id));
            if (defaultTemplateId === template.id) {
                await adminSaveSettings({ default_card_template_id: '' });
                setDefaultTemplateId(null);
            }
            setSuccess(`"${template.name}" deleted.`);
            setTimeout(() => setSuccess(null), 2500);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete template.');
        }
        finally {
            setBusyTemplateId(null);
            setDeletingTemplate(null);
        }
    }
    return (<div className="cms-section">
      <div className="cms-section-header">
        <div>
          <h1>Card Templates</h1>
          <p>Create platform card templates with the same visual designer used in Customize Card Layout.</p>
        </div>
      </div>

      {error && <p className="cms-error">{error}</p>}
      {success && <p className="cms-success">{success}</p>}

      <div className="cms-card">
        <h2 className="cms-card-title">Create New Platform Template</h2>
        <div className="cms-form-row">
          <label>
            Template name
            <input className="cms-input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Example: Ramadan Offer Card" maxLength={80}/>
          </label>
          <button className="cms-btn cms-btn-primary" onClick={() => setDesignerOpen(true)}>
            Open Card Designer
          </button>
        </div>
        <p className="cms-help-text">
          Click Save changes in the designer to publish this layout into the Templates tab for all users.
        </p>
      </div>

      <div className="cms-card">
        <h2 className="cms-card-title">Platform Templates</h2>
        {loading && <p className="cms-muted">Loading templates...</p>}
        {!loading && templates.length === 0 && <p className="cms-muted">No admin-created platform templates yet.</p>}
        {!loading && templates.length > 0 && (<div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Created</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map(t => (<tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.created_at ? new Date(t.created_at).toLocaleString() : '-'}</td>
                    <td>{t.is_default ? 'Default template' : t.is_platform ? 'Admin platform template' : 'Private admin template'}</td>
                    <td>
                      {defaultTemplateId === t.id ? (<span className="cms-badge badge-pro">Current default</span>) : (<button className="cms-btn cms-btn-sm" disabled={settingDefaultId === t.id} onClick={() => setAsDefault(t)}>
                          {settingDefaultId === t.id ? 'Setting...' : 'Set as default'}
                        </button>)}
                    </td>
                    <td>
                      <div className="cms-actions">
                        <button className="cms-btn cms-btn-sm" onClick={() => setViewingTemplate(t)}>View</button>
                        <button className="cms-btn cms-btn-sm" onClick={() => openEdit(t)}>Edit</button>
                        <button className="cms-btn cms-btn-sm" onClick={() => openRename(t)}>Rename</button>
                        <button className="cms-btn cms-btn-sm cms-btn-danger" disabled={t.is_default === true || busyTemplateId === t.id} onClick={() => setDeletingTemplate(t)} title={t.is_default ? 'Default built-in templates cannot be deleted.' : 'Delete template'}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>

      {designerOpen && (<LayoutCustomizer initial={draftLayout} onSave={saveTemplate} onReset={async () => setDraftLayout(editingTemplate?.layout ?? EMPTY_LAYOUT)} onClose={() => { setDesignerOpen(false); setEditingTemplate(null); }}/>)}

      {viewingTemplate && (<div className="cms-modal-bg" onClick={e => { if (e.currentTarget === e.target)
            setViewingTemplate(null); }}>
          <div className="cms-modal">
            <h3>View Template</h3>
            <p className="cms-muted">{viewingTemplate.name}</p>
            <div className="cms-template-preview">
              <LayoutThumbnail layout={viewingTemplate.layout}/>
            </div>
            <div className="cms-modal-actions">
              <button className="cms-btn" onClick={() => setViewingTemplate(null)}>Close</button>
              <button className="cms-btn cms-btn-primary" onClick={() => { openEdit(viewingTemplate); setViewingTemplate(null); }}>Edit</button>
            </div>
          </div>
        </div>)}

      {renamingTemplate && (<div className="cms-modal-bg" onClick={e => { if (e.currentTarget === e.target)
            setRenamingTemplate(null); }}>
          <div className="cms-modal">
            <h3>Rename Template</h3>
            <input className="cms-input" value={renameValue} onChange={e => setRenameValue(e.target.value)} maxLength={80} autoFocus/>
            <div className="cms-modal-actions">
              <button className="cms-btn" onClick={() => setRenamingTemplate(null)}>Cancel</button>
              <button className="cms-btn cms-btn-primary" disabled={busyTemplateId === renamingTemplate.id} onClick={confirmRename}>
                {busyTemplateId === renamingTemplate.id ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>)}

      {deletingTemplate && (<div className="cms-modal-bg" onClick={e => { if (e.currentTarget === e.target)
            setDeletingTemplate(null); }}>
          <div className="cms-modal cms-modal-sm">
            <h3>Delete Template</h3>
            <p className="cms-modal-body">
              Delete <strong className={cssClass({ color: '#f1f5f9' })}>{deletingTemplate.name}</strong>? This removes it from the platform Templates tab for users.
            </p>
            <div className="cms-modal-actions">
              <button className="cms-btn" onClick={() => setDeletingTemplate(null)} disabled={busyTemplateId === deletingTemplate.id}>
                Cancel
              </button>
              <button className="cms-btn cms-btn-danger" onClick={() => deleteTemplate(deletingTemplate)} disabled={busyTemplateId === deletingTemplate.id}>
                {busyTemplateId === deletingTemplate.id ? 'Deleting...' : 'Delete Template'}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
