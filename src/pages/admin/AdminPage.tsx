import { cssClass, cx } from '../../utils/styleClass';
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStoredToken } from '../../services/authService';
import { PRESET_ICON_URLS } from '../../data/editorIcons';
import { adminGetMe, adminCheck, adminGetStats, adminGetUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, adminGetLeaflets, adminDeleteLeaflet, adminBulkDeleteLeaflets, adminGetUploads, adminDeleteUpload, adminGetSettings, adminSaveSettings, adminGetCoverTemplates, adminCreateCoverTemplate, adminDeleteCoverTemplate, adminGetPresetIcons, adminUpdatePresetIcon, adminDeletePresetIcon, adminGetIcons, adminUploadIcon, adminUpdateIcon, adminDeleteIcon, type AdminApiError, } from './adminApi';
import AdminSEO from './AdminSEO';
import AdminBackup from './AdminBackup';
import AdminPages from './AdminPages';
import AdminHelpCenter from './AdminHelpCenter';
import AdminCardTemplates from './AdminCardTemplates';
import LeafletView from '../LeafletView';
import './AdminPage.css';
const NANO_A4_VISIBILITY_STORAGE_KEY = 'leafletai_nano_a4_enabled';
/* â”€â”€ types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: string;
    email_verified: number;
    subscription_plan: string;
    subscription_status: string;
    subscription_period: string;
    subscription_start: string | null;
    subscription_end: string | null;
    created_at: string;
    leaflet_count: number;
}
interface AdminCreateUserForm {
    name: string;
    email: string;
    password: string;
    subscription_plan: 'starter' | 'pro' | 'business' | 'agency';
    subscription_period: 'monthly' | 'annual';
    email_verified: boolean;
}
interface AdminLeaflet {
    id: number;
    title: string;
    description: string;
    created_at: string;
    owner_id: number;
    owner_name: string;
    owner_email: string;
    product_count: number;
}
interface UploadFile {
    name: string;
    size: number;
    modified: string;
    url: string;
}
interface SiteSettings {
    site_name: string;
    maintenance_mode: string;
    allow_signups: string;
    max_leaflets_free: string;
    max_leaflets_starter: string;
    max_leaflets_pro: string;
    max_leaflets_business: string;
    max_leaflets_agency: string;
    concurrent_logins_free: string;
    concurrent_logins_starter: string;
    concurrent_logins_pro: string;
    concurrent_logins_business: string;
    concurrent_logins_agency: string;
    plan_price_starter_monthly: string;
    plan_price_starter_annual: string;
    plan_price_pro_monthly: string;
    plan_price_pro_annual: string;
    plan_price_business_monthly: string;
    plan_price_business_annual: string;
    plan_price_agency_monthly: string;
    plan_price_agency_annual: string;
    free_pdf_export_limit: string;
    ai_cover_generations_free: string;
    ai_cover_generations_starter: string;
    ai_cover_generations_pro: string;
    ai_cover_generations_business: string;
    ai_cover_generations_agency: string;
    support_email: string;
    announcement_banner: string;
    stripe_secret_key: string;
    stripe_checkout_url: string;
    openai_api_key: string;
    home_demo_video_url: string;
    help_video_1_url: string;
    help_video_2_url: string;
    help_video_3_url: string;
    help_video_4_url: string;
    help_video_5_url: string;
    help_video_6_url: string;
}
const AI_COVER_GENERATION_LIMIT_FIELDS = [
    { key: 'ai_cover_generations_free', label: 'Free', icon: 'person' },
    { key: 'ai_cover_generations_starter', label: 'Starter', icon: 'rocket_launch' },
    { key: 'ai_cover_generations_pro', label: 'Professional', icon: 'workspace_premium' },
    { key: 'ai_cover_generations_business', label: 'Business', icon: 'business_center' },
    { key: 'ai_cover_generations_agency', label: 'Agency', icon: 'groups' },
] as const;
const LEAFLET_CREATION_LIMIT_FIELDS = [
    { key: 'max_leaflets_free', label: 'Free', icon: 'person' },
    { key: 'max_leaflets_starter', label: 'Starter', icon: 'rocket_launch' },
    { key: 'max_leaflets_pro', label: 'Professional', icon: 'workspace_premium' },
    { key: 'max_leaflets_business', label: 'Business', icon: 'business_center' },
    { key: 'max_leaflets_agency', label: 'Agency', icon: 'groups' },
] as const;
const CONCURRENT_LOGIN_LIMIT_FIELDS = [
    { key: 'concurrent_logins_free', label: 'Free', icon: 'person' },
    { key: 'concurrent_logins_starter', label: 'Starter', icon: 'rocket_launch' },
    { key: 'concurrent_logins_pro', label: 'Professional', icon: 'workspace_premium' },
    { key: 'concurrent_logins_business', label: 'Business', icon: 'business_center' },
    { key: 'concurrent_logins_agency', label: 'Agency', icon: 'groups' },
] as const;
const PLAN_PRICE_FIELDS = [
    { plan: 'starter', label: 'Starter', icon: 'rocket_launch', monthlyKey: 'plan_price_starter_monthly', annualKey: 'plan_price_starter_annual' },
    { plan: 'pro', label: 'Professional', icon: 'workspace_premium', monthlyKey: 'plan_price_pro_monthly', annualKey: 'plan_price_pro_annual' },
    { plan: 'business', label: 'Business', icon: 'business_center', monthlyKey: 'plan_price_business_monthly', annualKey: 'plan_price_business_annual' },
    { plan: 'agency', label: 'Agency', icon: 'groups', monthlyKey: 'plan_price_agency_monthly', annualKey: 'plan_price_agency_annual' },
] as const;
const DEFAULT_LEAFLET_CREATION_LIMITS: Pick<SiteSettings,
  'max_leaflets_free' |
  'max_leaflets_starter' |
  'max_leaflets_pro' |
  'max_leaflets_business' |
  'max_leaflets_agency'
> = {
    max_leaflets_free: '3',
    max_leaflets_starter: '5',
    max_leaflets_pro: '25',
    max_leaflets_business: '100',
    max_leaflets_agency: '1000',
};
const DEFAULT_CONCURRENT_LOGIN_LIMITS: Pick<SiteSettings,
  'concurrent_logins_free' |
  'concurrent_logins_starter' |
  'concurrent_logins_pro' |
  'concurrent_logins_business' |
  'concurrent_logins_agency'
> = {
    concurrent_logins_free: '1',
    concurrent_logins_starter: '2',
    concurrent_logins_pro: '3',
    concurrent_logins_business: '5',
    concurrent_logins_agency: '10',
};
const DEFAULT_AI_COVER_GENERATION_LIMITS: Pick<SiteSettings,
  'ai_cover_generations_free' |
  'ai_cover_generations_starter' |
  'ai_cover_generations_pro' |
  'ai_cover_generations_business' |
  'ai_cover_generations_agency'
> = {
    ai_cover_generations_free: '1',
    ai_cover_generations_starter: '2',
    ai_cover_generations_pro: '4',
    ai_cover_generations_business: '6',
    ai_cover_generations_agency: '10',
};
const DEFAULT_PLAN_PRICES: Pick<SiteSettings,
  'plan_price_starter_monthly' |
  'plan_price_starter_annual' |
  'plan_price_pro_monthly' |
  'plan_price_pro_annual' |
  'plan_price_business_monthly' |
  'plan_price_business_annual' |
  'plan_price_agency_monthly' |
  'plan_price_agency_annual'
> = {
    plan_price_starter_monthly: '13.34',
    plan_price_starter_annual: '133.42',
    plan_price_pro_monthly: '26.96',
    plan_price_pro_annual: '269.57',
    plan_price_business_monthly: '67.80',
    plan_price_business_annual: '677.99',
    plan_price_agency_monthly: '163.10',
    plan_price_agency_annual: '',
};
interface AdminIcon {
    id: number;
    label: string;
    url: string;
    active: number;
    sort_order: number;
    created_at: string;
}
interface PresetIconOverride {
    icon_key: string;
    label: string | null;
    active: number;
    sort_order: number;
    deleted: number;
    updated_at: string;
}
interface AdminPresetIcon {
    key: string;
    originalLabel: string;
    label: string;
    url: string;
    active: number;
    sort_order: number;
    deleted: number;
}
/* â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function fmtDate(s: string) { return s ? new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'; }
function fmtSize(b: number) { if (b < 1024)
    return b + 'B'; if (b < 1048576)
    return (b / 1024).toFixed(1) + 'KB'; return (b / 1048576).toFixed(1) + 'MB'; }
function billingPeriodLabel(period: string | null | undefined) {
    return String(period || 'monthly').toLowerCase() === 'annual' ? 'Yearly' : 'Monthly';
}
function planBadge(plan: string) {
    const map: Record<string, string> = { free: 'badge-free', starter: 'badge-pro', pro: 'badge-pro', business: 'badge-business', enterprise: 'badge-business' };
    const labels: Record<string, string> = { pro: 'professional' };
    return <span className={`cms-badge ${map[plan] ?? 'badge-free'}`}>{labels[plan] ?? plan}</span>;
}
function roleBadge(role: string) {
    return <span className={`cms-badge ${role === 'admin' ? 'badge-admin' : 'badge-user'}`}>{role}</span>;
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SIDEBAR
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function Sidebar({ active }: {
    active: string;
}) {
    const nav = useNavigate();
    const links = [
        { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
        { key: 'users', icon: 'group', label: 'Users' },
        { key: 'leaflets', icon: 'content_paste', label: 'Leaflets' },
        { key: 'cover-pages', icon: 'wallpaper', label: 'Cover Pages' },
        { key: 'cover-templates', icon: 'view_quilt', label: 'Cover Templates' },
        { key: 'uploads', icon: 'source', label: 'Media' },
        { key: 'icons', icon: 'auto_awesome', label: 'Icon Library' },
        { key: 'seo', icon: 'search', label: 'SEO' },
        { key: 'pages', icon: 'description', label: 'Pages CMS' },
        { key: 'help-center', icon: 'support', label: 'Help Center' },
        { key: 'backup', icon: 'save', label: 'Backup' },
        { key: 'settings', icon: 'settings', label: 'Settings' },
    ];
    return (<aside className="cms-sidebar">
      <div className="cms-logo">
        <span className="cms-logo-icon">shield</span>
        <span className="cms-logo-text">Admin CMS</span>
      </div>
      <nav className="cms-nav">
        {links.map(l => (<button key={l.key} className={`cms-nav-btn ${active === l.key ? 'active' : ''}`} onClick={() => nav(`/admin/${l.key}`)}>
            <span className="cms-nav-icon">{l.icon}</span>
            <span>{l.label}</span>
          </button>))}
        <button className={`cms-nav-btn ${active === 'card-templates' ? 'active' : ''}`} onClick={() => nav('/admin/card-templates')}>
          <span className="cms-nav-icon">dashboard_customize</span>
          <span>Card Templates</span>
        </button>
      </nav>
      <button className="cms-nav-btn cms-back-btn" onClick={() => nav('/dashboard')}>
        <span className="cms-nav-icon">arrow_back</span>
        <span>Back to App</span>
      </button>
    </aside>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STAT CARD
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function StatCard({ icon, label, value, sub }: {
    icon: string;
    label: string;
    value: string | number;
    sub?: string;
}) {
    return (<div className="cms-stat-card">
      <div className="cms-stat-icon">{icon}</div>
      <div className="cms-stat-body">
        <div className="cms-stat-value">{value}</div>
        <div className="cms-stat-label">{label}</div>
        {sub && <div className="cms-stat-sub">{sub}</div>}
      </div>
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   DASHBOARD
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminDashboard() {
    const [stats, setStats] = useState<any>(null);
    const [err, setErr] = useState('');
    useEffect(() => {
        adminGetStats().then(setStats).catch(e => setErr(e.message));
    }, []);
    if (err)
        return <div className="cms-error">{err}</div>;
    if (!stats)
        return <div className="cms-loading">Loading...</div>;
    return (<div className="cms-section">
      <h2 className="cms-section-title">Dashboard</h2>

      <div className="cms-stat-grid">
        <StatCard icon="group" label="Total Users" value={stats.totalUsers} sub={`+${stats.newUsersWeek} this week`}/>
        <StatCard icon="content_paste" label="Total Leaflets" value={stats.totalLeaflets} sub={`+${stats.newLeafletsWeek} this week`}/>
        <StatCard icon="inventory_2" label="Total Products" value={stats.totalProducts}/>
        <StatCard icon="ads_click" label="Product Clicks" value={stats.totalClicks}/>
      </div>

      <div className="cms-plan-grid">
        <div className="cms-card">
          <div className="cms-card-title">Plan Breakdown</div>
          {stats.planBreakdown.map((p: any) => (<div key={p.subscription_plan} className="cms-plan-row">
              {planBadge(p.subscription_plan)}
              <span className="cms-plan-count">{p.n} users</span>
              <div className="cms-plan-bar-wrap">
                <div className={cx("cms-plan-bar", cssClass({ width: `${Math.round(p.n / stats.totalUsers * 100)}%` }))}/>
              </div>
              <span className="cms-plan-pct">{Math.round(p.n / stats.totalUsers * 100)}%</span>
            </div>))}
        </div>

        <div className="cms-card">
          <div className="cms-card-title">Recent Users</div>
          <table className="cms-mini-table">
            <thead><tr><th>Name</th><th>Plan</th><th>Joined</th></tr></thead>
            <tbody>
              {stats.recentUsers.map((u: any) => (<tr key={u.id}>
                  <td>{u.name}<br /><span className="cms-muted">{u.email}</span></td>
                  <td>{planBadge(u.subscription_plan)}</td>
                  <td className="cms-muted">{fmtDate(u.created_at)}</td>
                </tr>))}
            </tbody>
          </table>
        </div>

        <div className="cms-card">
          <div className="cms-card-title">Recent Leaflets</div>
          <table className="cms-mini-table">
            <thead><tr><th>Title</th><th>Owner</th><th>Products</th></tr></thead>
            <tbody>
              {stats.recentLeaflets.map((l: any) => (<tr key={l.id}>
                  <td>{l.title}</td>
                  <td className="cms-muted">{l.owner}</td>
                  <td>{l.product_count}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </div>
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   USERS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminUsers() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [editing, setEditing] = useState<AdminUser | null>(null);
    const [creating, setCreating] = useState(false);
    const [createForm, setCreateForm] = useState<AdminCreateUserForm>({
        name: '',
        email: '',
        password: '',
        subscription_plan: 'pro',
        subscription_period: 'monthly',
        email_verified: true,
    });
    const [confirmDel, setConfirmDel] = useState<number | null>(null);
    const PER = 15;
    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const d = await adminGetUsers({ page: String(page), limit: String(PER), search, sort_by: sortBy, sort_dir: sortDir });
            setUsers(d.users);
            setTotal(d.total);
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setLoading(false);
        }
    }, [page, search, sortBy, sortDir]);
    useEffect(() => { load(); }, [load]);
    function handleSort(col: string) {
        if (sortBy === col) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        }
        else {
            setSortBy(col);
            setSortDir('asc');
        }
        setPage(1);
    }
    function SortIcon({ col }: {
        col: string;
    }) {
        if (sortBy !== col)
            return <span className="cms-sort-icon cms-sort-icon--inactive">swap_vert</span>;
        return <span className="cms-sort-icon cms-sort-icon--active">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>;
    }
    function Th({ col, label }: {
        col: string;
        label: string;
    }) {
        return (<th className="cms-th-sortable" onClick={() => handleSort(col)}>
        <span className="cms-th-inner">
          {label} <SortIcon col={col}/>
        </span>
      </th>);
    }
    function downloadExport(format: 'csv' | 'xlsx') {
        const token = getStoredToken();
        const params = new URLSearchParams({ search, sort_by: sortBy, sort_dir: sortDir, format });
        const url = `/api/admin/users/export?${params}`;
        const a = document.createElement('a');
        // fetch with auth header then create blob URL
        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.blob())
            .then(blob => {
            a.href = URL.createObjectURL(blob);
            a.download = `users.${format}`;
            a.click();
            URL.revokeObjectURL(a.href);
        })
            .catch(() => alert('Export failed. Please try again.'));
    }
    async function saveEdit() {
        if (!editing)
            return;
        try {
            await adminUpdateUser(editing.id, {
                role: editing.role,
                subscription_plan: editing.subscription_plan,
                subscription_status: editing.subscription_status,
                subscription_period: editing.subscription_period,
                email_verified: editing.email_verified,
            });
            setEditing(null);
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    async function createUser() {
        try {
            await adminCreateUser({
                ...createForm,
                subscription_status: 'active',
            });
            setCreating(false);
            setCreateForm({
                name: '',
                email: '',
                password: '',
                subscription_plan: 'pro',
                subscription_period: 'monthly',
                email_verified: true,
            });
            setPage(1);
            load();
        }
        catch (e: any) {
            const details = e?.message || 'Failed to create user.';
            alert(details);
        }
    }
    async function doDelete(id: number) {
        try {
            await adminDeleteUser(id);
            setConfirmDel(null);
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    return (<div className="cms-section">
      <div className="cms-section-header">
        <h2 className="cms-section-title">Users <span className="cms-count">({total})</span></h2>
        <div className={cssClass({ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' })}>
          <input className="cms-search" placeholder="Search name / email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
          <button className="cms-btn cms-btn-sm cms-btn-primary" onClick={() => setCreating(true)}>
            <span className="material-symbol" aria-hidden="true">person_add</span> Add user
          </button>
          <button className="cms-btn cms-btn-sm cms-btn-export" title="Download as CSV" onClick={() => downloadExport('csv')}>
            download CSV
          </button>
          <button className="cms-btn cms-btn-sm cms-btn-export cms-btn-export--xlsx" title="Download as Excel" onClick={() => downloadExport('xlsx')}>
            download Excel
          </button>
        </div>
      </div>
      {err && <div className="cms-error">{err}</div>}
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr>
            <Th col="name" label="Name / Email"/>
            <Th col="role" label="Role"/>
            <Th col="subscription_plan" label="Plan"/>
            <Th col="subscription_period" label="Billing"/>
            <Th col="subscription_end" label="Subscription End"/>
            <Th col="email_verified" label="Verified"/>
            <Th col="leaflet_count" label="Leaflets"/>
            <Th col="created_at" label="Joined"/>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="cms-loading-row">Loading...</td></tr>}
            {!loading && users.map(u => (<tr key={u.id}>
                <td><div className="cms-user-name">{u.name}</div><div className="cms-muted">{u.email}</div></td>
                <td>{roleBadge(u.role)}</td>
                <td>{planBadge(u.subscription_plan)}</td>
                <td className="cms-muted">{u.subscription_plan === 'free' ? '-' : billingPeriodLabel(u.subscription_period)}</td>
                <td className="cms-muted">{u.subscription_plan === 'free' ? '-' : fmtDate(u.subscription_end || '')}</td>
                <td>{u.email_verified ? <span className="material-symbol cms-ok" aria-label="Verified">check_circle</span> : <span className="material-symbol cms-warn" aria-label="Not verified">cancel</span>}</td>
                <td>{u.leaflet_count}</td>
                <td className="cms-muted">{fmtDate(u.created_at)}</td>
                <td className="cms-actions">
                  <button className="cms-btn cms-btn-sm" onClick={() => setEditing({ ...u })}>Edit</button>
                  <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setConfirmDel(u.id)}>Delete</button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="cms-pagination">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="cms-btn cms-btn-sm"><span className="material-symbol" aria-hidden="true">arrow_back</span> Prev</button>
        <span>Page {page} of {Math.ceil(total / PER) || 1}</span>
        <button disabled={page >= Math.ceil(total / PER)} onClick={() => setPage(p => p + 1)} className="cms-btn cms-btn-sm">Next <span className="material-symbol" aria-hidden="true">arrow_forward</span></button>
      </div>

      {/* Create modal */}
      {creating && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setCreating(false)}>
          <div className="cms-modal">
            <div className="cms-modal-title">Add User</div>
            <p className="cms-modal-body cms-modal-body--tight">Create a registered user and activate their subscription immediately.</p>
            <div className="cms-form-row">
              <label>Name</label>
              <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Customer name"/>
            </div>
            <div className="cms-form-row">
              <label>Email</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="customer@example.com"/>
            </div>
            <div className="cms-form-row">
              <label>Password</label>
              <input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Temporary password"/>
            </div>
            <div className="cms-form-row">
              <label>Plan</label>
              <select value={createForm.subscription_plan} onChange={e => setCreateForm({ ...createForm, subscription_plan: e.target.value as 'starter' | 'pro' | 'business' | 'agency' })}>
                <option value="starter">starter</option>
                <option value="pro">professional</option>
                <option value="business">business</option>
                <option value="agency">agency</option>
              </select>
            </div>
            <div className="cms-form-row">
              <label>Billing Period</label>
              <select value={createForm.subscription_period} onChange={e => setCreateForm({ ...createForm, subscription_period: e.target.value as 'monthly' | 'annual' })}>
                <option value="monthly">Monthly</option>
                <option value="annual">Yearly</option>
              </select>
            </div>
            <div className="cms-form-row">
              <label>Email Verified</label>
              <input type="checkbox" checked={createForm.email_verified} onChange={e => setCreateForm({ ...createForm, email_verified: e.target.checked })}/>
            </div>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="cms-btn cms-btn-primary" onClick={createUser}>Create active user</button>
            </div>
          </div>
        </div>)}

      {/* Edit modal */}
      {editing && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="cms-modal">
            <div className="cms-modal-title">Edit User - {editing.name}</div>
            <div className="cms-form-row">
              <label>Role</label>
              <select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="cms-form-row">
              <label>Plan</label>
              <select value={editing.subscription_plan} onChange={e => {
                const nextPlan = e.target.value;
                setEditing({
                    ...editing,
                    subscription_plan: nextPlan,
                    subscription_status: nextPlan === 'free' ? 'active' : editing.subscription_status || 'active',
                });
            }}>
                <option value="free">free</option>
                <option value="starter">starter</option>
                <option value="pro">professional</option>
                <option value="business">business</option>
                <option value="agency">agency</option>
              </select>
            </div>
            {editing.subscription_plan !== 'free' && (<div className="cms-form-row">
              <label>Billing Period</label>
              <select value={editing.subscription_period || 'monthly'} onChange={e => setEditing({ ...editing, subscription_period: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="annual">Yearly</option>
              </select>
            </div>)}
            {editing.subscription_plan !== 'free' && (<div className="cms-form-row">
              <label>Subscription End Date</label>
              <input type="text" value={fmtDate(editing.subscription_end || '')} readOnly/>
            </div>)}
            <div className="cms-form-row">
              <label>Status</label>
              <select value={editing.subscription_status} disabled={editing.subscription_plan === 'free'} onChange={e => setEditing({ ...editing, subscription_status: e.target.value })}>
                <option value="active">active</option>
                <option value="cancelled">cancelled</option>
                <option value="past_due">past_due</option>
                <option value="paused">paused</option>
                <option value="expired">expired</option>
              </select>
            </div>
            <div className="cms-form-row">
              <label>Email Verified</label>
              <input type="checkbox" checked={!!editing.email_verified} onChange={e => setEditing({ ...editing, email_verified: e.target.checked ? 1 : 0 })}/>
            </div>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setEditing(null)}>Cancel</button>
              <button className="cms-btn cms-btn-primary" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>)}

      {/* Delete confirm */}
      {confirmDel !== null && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">Delete User?</div>
            <p className="cms-modal-body">This will permanently delete the user and all their leaflets.</p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={() => doDelete(confirmDel)}>Delete</button>
            </div>
          </div>
        </div>)}
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LEAFLETS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminLeaflets() {
    const [leaflets, setLeaflets] = useState<AdminLeaflet[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [confirmDel, setConfirmDel] = useState<number | null>(null);
    const [confirmBulkDel, setConfirmBulkDel] = useState(false);
    const [PER, setPER] = useState(15);
    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const d = await adminGetLeaflets({ page: String(page), limit: String(PER), search });
            setLeaflets(d.leaflets);
            setTotal(d.total);
            setSelected(new Set());
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setLoading(false);
        }
    }, [page, PER, search]);
    useEffect(() => { load(); }, [load]);
    /* â”€â”€ select helpers â”€â”€ */
    const allIds = leaflets.map(l => l.id);
    const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id));
    const someChecked = allIds.some(id => selected.has(id)) && !allChecked;
    function toggleAll() {
        if (allChecked) {
            setSelected(new Set());
        }
        else {
            setSelected(new Set(allIds));
        }
    }
    function toggleOne(id: number) {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }
    /* â”€â”€ delete actions â”€â”€ */
    async function doDelete(id: number) {
        setConfirmDel(null);
        try {
            await adminDeleteLeaflet(id);
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            load();
        }
    }
    async function doBulkDelete() {
        const ids = [...selected];
        setConfirmBulkDel(false);
        setSelected(new Set());
        try {
            await adminBulkDeleteLeaflets(ids);
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            load();
        }
    }
    return (<div className="cms-section">
      <div className="cms-section-header">
        <h2 className="cms-section-title">Leaflets <span className="cms-count">({total})</span></h2>
        <div className={cssClass({ display: 'flex', gap: 10, alignItems: 'center' })}>
          {selected.size > 0 && (<button className="cms-btn cms-btn-danger" onClick={() => setConfirmBulkDel(true)}>
              delete Delete Selected ({selected.size})
            </button>)}
          <input className="cms-search" placeholder="Search title / owner..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
        </div>
      </div>
      {err && <div className="cms-error">{err}</div>}
      <div className="cms-table-wrap">
        <table className="cms-table">
          <thead><tr>
            <th className={cssClass({ width: 40 })}>
              <input type="checkbox" className="cms-checkbox" checked={allChecked} ref={el => { if (el)
        el.indeterminate = someChecked; }} onChange={toggleAll} title={allChecked ? 'Deselect all' : 'Select all on this page'}/>
            </th>
            <th>Title</th><th>Owner</th><th>Products</th><th>Created</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="cms-loading-row">Loading...</td></tr>}
            {!loading && leaflets.map(l => (<tr key={l.id} className={cx(selected.has(l.id) ? 'cms-row-selected' : '', cssClass({ cursor: 'pointer' }))} onClick={e => {
                const t = e.target as HTMLElement;
                if (!t.closest('button, a, input'))
                    toggleOne(l.id);
            }}>
                <td>
                  <input type="checkbox" className="cms-checkbox" checked={selected.has(l.id)} onChange={() => toggleOne(l.id)}/>
                </td>
                <td><div className="cms-user-name">{l.title}</div><div className="cms-muted">{l.description?.slice(0, 60)}</div></td>
                <td><div>{l.owner_name}</div><div className="cms-muted">{l.owner_email}</div></td>
                <td>{l.product_count}</td>
                <td className="cms-muted">{fmtDate(l.created_at)}</td>
                <td className="cms-actions">
                  <a className="cms-btn cms-btn-sm" href={`/app/leaflet/${l.id}`} target="_blank" rel="noreferrer">View</a>
                  <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => setConfirmDel(l.id)}>Delete</button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="cms-pagination">
        <select className="cms-select-sm" value={PER} onChange={e => { setPER(Number(e.target.value)); setPage(1); }}>
          {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="cms-btn cms-btn-sm"><span className="material-symbol" aria-hidden="true">arrow_back</span> Prev</button>
        <span>Page {page} of {Math.ceil(total / PER) || 1}</span>
        <button disabled={page >= Math.ceil(total / PER)} onClick={() => setPage(p => p + 1)} className="cms-btn cms-btn-sm">Next <span className="material-symbol" aria-hidden="true">arrow_forward</span></button>
      </div>

      {/* â”€â”€ Single delete modal â”€â”€ */}
      {confirmDel !== null && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">Delete Leaflet?</div>
            <p className="cms-modal-body">This will permanently delete the leaflet and all its products.</p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={() => { const id = confirmDel; setConfirmDel(null); doDelete(id); }}>Delete</button>
            </div>
          </div>
        </div>)}

      {/* â”€â”€ Bulk delete modal â”€â”€ */}
      {confirmBulkDel && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setConfirmBulkDel(false)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">delete Delete {selected.size} Leaflet{selected.size !== 1 ? 's' : ''}?</div>
            <p className="cms-modal-body">
              You are about to permanently delete <strong className={cssClass({ color: '#f87171' })}>{selected.size} leaflet{selected.size !== 1 ? 's' : ''}</strong> and all their products. This action cannot be undone.
            </p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setConfirmBulkDel(false)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={doBulkDelete}>Delete All</button>
            </div>
          </div>
        </div>)}
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   UPLOADS / MEDIA
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminCoverPages() {
    const [leafletId, setLeafletId] = useState<string | null>(null);
    const [nanoA4Enabled, setNanoA4Enabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [settingsMsg, setSettingsMsg] = useState('');
    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [d, settings] = await Promise.all([
                adminGetLeaflets({ page: '1', limit: '1', search: '' }),
                adminGetSettings(),
            ]);
            const savedNanoA4Enabled = String(settings.nano_a4_enabled ?? '1') !== '0';
            setNanoA4Enabled(savedNanoA4Enabled);
            localStorage.setItem(NANO_A4_VISIBILITY_STORAGE_KEY, savedNanoA4Enabled ? '1' : '0');
            const firstLeaflet = d.leaflets?.[0];
            if (firstLeaflet) {
                setLeafletId(String(firstLeaflet.id));
                return;
            }
            setErr('No leaflets found.');
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    async function toggleNanoA4Visibility(next: boolean) {
        setNanoA4Enabled(next);
        setSettingsMsg('');
        localStorage.setItem(NANO_A4_VISIBILITY_STORAGE_KEY, next ? '1' : '0');
        window.dispatchEvent(new CustomEvent('leafletai:nano-a4-setting-changed', { detail: { enabled: next } }));
        try {
            await adminSaveSettings({ nano_a4_enabled: next ? '1' : '0' });
            setSettingsMsg(next ? 'Nanobanana A4 is visible on user side.' : 'Nanobanana A4 is hidden on user side.');
            window.setTimeout(() => setSettingsMsg(''), 2400);
        }
        catch (e: any) {
            setNanoA4Enabled(!next);
            localStorage.setItem(NANO_A4_VISIBILITY_STORAGE_KEY, !next ? '1' : '0');
            window.dispatchEvent(new CustomEvent('leafletai:nano-a4-setting-changed', { detail: { enabled: !next } }));
            setErr(e.message || 'Failed to save Nanobanana A4 visibility.');
        }
    }
    if (loading && !err)
        return null;
    if (leafletId)
        return <div className="cms-cover-builder-main">
            <div className="cms-card">
                <div className="cms-section-header">
                    <div>
                        <h2 className="cms-section-title">User Cover Generator</h2>
                        <p className="cms-section-subtitle">Control whether users can see the Nanobanana A4 generator in the Cover Page sidebar.</p>
                    </div>
                    <label className="cms-toggle">
                        <input type="checkbox" checked={nanoA4Enabled} onChange={e => void toggleNanoA4Visibility(e.target.checked)}/>
                        <span className="cms-toggle-track"><span className="cms-toggle-thumb"/></span>
                        <span className="cms-toggle-txt">{nanoA4Enabled ? 'Displayed' : 'Hidden'}</span>
                    </label>
                </div>
                {settingsMsg && <div className="cms-success">{settingsMsg}</div>}
            </div>
            <LeafletView coverBuilderOnly leafletId={leafletId} nanoA4VisibleOverride={nanoA4Enabled}/>
        </div>;
    return <div className="cms-error">{err}</div>;
}
function AdminCoverPageEditor() {
    const { id } = useParams<{ id: string }>();
    const [nanoA4Enabled, setNanoA4Enabled] = useState(true);
    useEffect(() => {
        adminGetSettings()
            .then(settings => setNanoA4Enabled(String(settings.nano_a4_enabled ?? '1') !== '0'))
            .catch(() => setNanoA4Enabled(true));
    }, []);
    if (!id)
        return <Navigate to="/admin/cover-pages" replace/>;
    return <div className="cms-cover-builder-main"><LeafletView coverBuilderOnly leafletId={id} nanoA4VisibleOverride={nanoA4Enabled}/></div>;
}
const COVER_TEMPLATE_BASES = [
    { id: 'hero-left', name: 'Hero left' },
    { id: 'hero-right', name: 'Hero right' },
    { id: 'centered', name: 'Centered' },
    { id: 'strip', name: 'Retail strip' },
    { id: 'badge', name: 'Badge hero' },
    { id: 'compact', name: 'Compact' },
];
function AdminCoverTemplates() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [templateName, setTemplateName] = useState('');
    const [baseLayoutId, setBaseLayoutId] = useState('hero-left');
    const [styleJson, setStyleJson] = useState('{\n  "headline": { "fontSize": 48 },\n  "products": { "x": 0, "w": 100 }\n}');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    async function load() {
        setLoading(true);
        setError('');
        try {
            const result = await adminGetCoverTemplates() as { templates?: any[] };
            setTemplates(Array.isArray(result.templates) ? result.templates : []);
        }
        catch (e: any) {
            setError(e.message || 'Failed to load cover templates.');
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { load(); }, []);
    async function createTemplate() {
        const name = templateName.trim();
        if (!name) {
            setError('Template name is required.');
            return;
        }
        let styles = {};
        try {
            styles = JSON.parse(styleJson || '{}');
            if (!styles || typeof styles !== 'object' || Array.isArray(styles))
                throw new Error('Styles must be an object.');
        }
        catch (e: any) {
            setError(e.message || 'Template styles JSON is invalid.');
            return;
        }
        setError('');
        const nextTemplate = {
            name,
            layout_id: baseLayoutId,
            headline_lines: baseLayoutId === 'strip' ? 1 : baseLayoutId === 'hero-right' || baseLayoutId === 'compact' ? 3 : 2,
            styles,
        };
        try {
            const result = await adminCreateCoverTemplate(nextTemplate) as { templates?: any[] };
            setTemplates(Array.isArray(result.templates) ? result.templates : []);
            setSuccess(`"${name}" was published as a standard cover template.`);
            setTimeout(() => setSuccess(''), 2500);
            setTemplateName('');
        }
        catch (e: any) {
            setError(e.message || 'Failed to create cover template.');
        }
    }
    async function deleteTemplate(templateId: string) {
        const template = templates.find(t => t.id === templateId);
        try {
            const result = await adminDeleteCoverTemplate(templateId) as { templates?: any[] };
            setTemplates(Array.isArray(result.templates) ? result.templates : []);
            setSuccess(`"${template?.name || 'Template'}" was deleted.`);
            setTimeout(() => setSuccess(''), 2500);
        }
        catch (e: any) {
            setError(e.message || 'Failed to delete cover template.');
        }
    }
    return (<div className="cms-section">
      <div className="cms-section-header">
        <div>
          <h2 className="cms-section-title">Cover Templates</h2>
          <p className="cms-section-subtitle">Create standard cover layout templates for all users. These templates appear in the Create Cover Page template grid.</p>
        </div>
        <button className="cms-btn cms-btn-primary" type="button" onClick={createTemplate}>Create template</button>
      </div>
      {error && <div className="cms-error">{error}</div>}
      {success && <div className="cms-success">{success}</div>}
      <div className="cms-card">
        <h3 className="cms-card-title">Create Standard Template</h3>
        <div className="cms-cover-template-form">
          <label>
            Template name
            <input className="cms-input" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Example: Weekend Mega Sale"/>
          </label>
          <label>
            Base layout
            <select className="cms-input" value={baseLayoutId} onChange={e => setBaseLayoutId(e.target.value)}>
              {COVER_TEMPLATE_BASES.map(base => <option key={base.id} value={base.id}>{base.name}</option>)}
            </select>
          </label>
          <label className="cms-cover-template-json">
            Style overrides JSON
            <textarea className="cms-input" value={styleJson} onChange={e => setStyleJson(e.target.value)} rows={8}/>
          </label>
          <div className="cms-cover-template-actions">
            <button className="cms-btn cms-btn-primary" type="button" onClick={createTemplate}>Create template</button>
          </div>
        </div>
        <p className="cms-help-text">Use element keys like logo, headline, subline, basket, dealTag, products, and contact. Any omitted values come from the selected base layout.</p>
      </div>
      <div className="cms-card">
        <h3 className="cms-card-title">Published Standard Templates</h3>
        {loading && <p className="cms-muted">Loading cover templates...</p>}
        {!loading && templates.length === 0 && <p className="cms-muted">No admin-created cover templates yet.</p>}
        {!loading && templates.length > 0 && (<div className="cms-table-wrap">
            <table className="cms-table">
              <thead><tr><th>Name</th><th>Base layout</th><th>Created</th><th>Actions</th></tr></thead>
              <tbody>
                {templates.map(template => (<tr key={template.id}>
                    <td><div className="cms-user-name">{template.name}</div><div className="cms-muted">{template.id}</div></td>
                    <td>{COVER_TEMPLATE_BASES.find(base => base.id === template.layout_id)?.name || template.layout_id || 'Hero left'}</td>
                    <td className="cms-muted">{template.created_at ? new Date(template.created_at).toLocaleString() : '-'}</td>
                    <td>
                      <div className="cms-cover-template-row-actions">
                        <button className="cms-btn cms-btn-sm cms-btn-danger" type="button" onClick={() => deleteTemplate(template.id)}>Delete template</button>
                      </div>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>
    </div>);
}
function AdminUploads() {
    const [files, setFiles] = useState<UploadFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmDel, setConfirmDel] = useState<'single' | 'multi' | null>(null);
    const [delTarget, setDelTarget] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [preview, setPreview] = useState<UploadFile | null>(null);
    const [copied, setCopied] = useState(false);
    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const d = await adminGetUploads();
            setFiles(d.files);
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    const filtered = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));
    const allSelected = filtered.length > 0 && filtered.every(f => selected.has(f.name));
    function toggleOne(name: string, e: React.MouseEvent) {
        e.stopPropagation();
        setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
    }
    function toggleAll() {
        if (allSelected) {
            setSelected(prev => { const n = new Set(prev); filtered.forEach(f => n.delete(f.name)); return n; });
        }
        else {
            setSelected(prev => { const n = new Set(prev); filtered.forEach(f => n.add(f.name)); return n; });
        }
    }
    function clearSelection() { setSelected(new Set()); }
    async function doDeleteSingle(name: string) {
        setDeleting(true);
        try {
            await adminDeleteUpload(name);
            setSelected(prev => { const n = new Set(prev); n.delete(name); return n; });
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
        finally {
            setDeleting(false);
            setConfirmDel(null);
            setDelTarget(null);
        }
    }
    async function doDeleteSelected() {
        setDeleting(true);
        try {
            await Promise.all([...selected].map(name => adminDeleteUpload(name)));
            setSelected(new Set());
            load();
        }
        catch (e: any) {
            alert(e.message);
        }
        finally {
            setDeleting(false);
            setConfirmDel(null);
        }
    }
    function copyUrl(url: string) {
        navigator.clipboard.writeText(window.location.origin + url)
            .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })
            .catch(() => { });
    }
    return (<div className="cms-section">
      {/* â”€â”€ Header â”€â”€ */}
      <div className="cms-section-header">
        <h2 className="cms-section-title">
          Media Library
          <span className="cms-count"> ({files.length} file{files.length !== 1 ? 's' : ''})</span>
        </h2>
        <input className="cms-search" placeholder="Filter files..." value={search} onChange={e => { setSearch(e.target.value); clearSelection(); }}/>
      </div>

      {/* â”€â”€ Multi-select toolbar â”€â”€ */}
      <div className={`cms-media-toolbar${selected.size > 0 ? ' cms-media-toolbar--active' : ''}`}>
        <label className="cms-media-select-all">
          <input type="checkbox" checked={allSelected} onChange={toggleAll}/>
          <span>{allSelected ? 'Deselect all' : `Select all (${filtered.length})`}</span>
        </label>
        {selected.size > 0 && (<div className="cms-media-toolbar-actions">
            <span className="cms-media-sel-count">{selected.size} selected</span>
            <button className="cms-btn cms-btn-sm cms-btn-danger" disabled={deleting} onClick={() => setConfirmDel('multi')}>
              Delete {selected.size} file{selected.size !== 1 ? 's' : ''}
            </button>
            <button className="cms-btn cms-btn-sm" onClick={clearSelection}>Clear</button>
          </div>)}
      </div>

      {err && <div className="cms-error">{err}</div>}

      {/* â”€â”€ Grid â”€â”€ */}
      <div className="cms-media-grid">
        {loading && <div className="cms-loading">Loading...</div>}
        {!loading && filtered.length === 0 && (<div className={cx("cms-empty-state", cssClass({ gridColumn: '1/-1' }))}>
            <div className={cssClass({ fontSize: '2rem', marginBottom: 8 })}>image</div>
            <div>{search ? 'No files match your search.' : 'No uploaded files yet.'}</div>
          </div>)}
        {!loading && filtered.map(f => {
            const isSel = selected.has(f.name);
            return (<div key={f.name} className={`cms-media-card${isSel ? ' cms-media-card--selected' : ''}`} onClick={() => setPreview(f)}>
              <div className="cms-media-checkbox" onClick={e => toggleOne(f.name, e)}>
                <input type="checkbox" checked={isSel} onChange={() => { }}/>
              </div>
              <div className="cms-media-thumb">
                <img src={f.url} alt={f.name} loading="lazy" onError={e => (e.currentTarget.style.display = 'none')}/>
              </div>
              <div className="cms-media-info">
                <div className="cms-media-name" title={f.name}>{f.name}</div>
                <div className="cms-muted">{fmtSize(f.size)}</div>
              </div>
              <button className="cms-media-del material-symbol" title="Delete" aria-label="Delete" onClick={e => { e.stopPropagation(); setDelTarget(f.name); setConfirmDel('single'); }}>delete</button>
            </div>);
        })}
      </div>

      {/* â”€â”€ Preview modal â”€â”€ */}
      {preview && (<div className="cms-modal-bg" onClick={() => setPreview(null)}>
          <div className="cms-media-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="cms-media-preview-header">
              <span className="cms-media-preview-name">{preview.name}</span>
              <button className="cms-modal-close-btn material-symbol" onClick={() => setPreview(null)} aria-label="Close">close</button>
            </div>
            <div className="cms-media-preview-img-wrap">
              <img src={preview.url} alt={preview.name} className="cms-media-preview-img"/>
            </div>
            <div className="cms-media-preview-footer">
              <span className="cms-muted">{fmtSize(preview.size)}</span>
              <div className={cssClass({ display: 'flex', gap: 8 })}>
                <button className="cms-btn cms-btn-sm" onClick={() => copyUrl(preview.url)}>
                  {copied ? <><span className="material-symbol" aria-hidden="true">check</span> Copied!</> : <><span className="material-symbol" aria-hidden="true">content_paste</span> Copy URL</>}
                </button>
                <a className="cms-btn cms-btn-sm" href={preview.url} download target="_blank" rel="noreferrer">download Download</a>
                <button className="cms-btn cms-btn-sm cms-btn-danger" onClick={() => { setDelTarget(preview.name); setPreview(null); setConfirmDel('single'); }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>)}

      {/* â”€â”€ Confirm single delete â”€â”€ */}
      {confirmDel === 'single' && delTarget && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">Delete File?</div>
            <p className="cms-modal-body"><code>{delTarget}</code><br />This cannot be undone.</p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => { setConfirmDel(null); setDelTarget(null); }}>Cancel</button>
              <button className="cms-btn cms-btn-danger" disabled={deleting} onClick={() => doDeleteSingle(delTarget)}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>)}

      {/* â”€â”€ Confirm multi delete â”€â”€ */}
      {confirmDel === 'multi' && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setConfirmDel(null)}>
          <div className="cms-modal cms-modal-sm">
            <div className="cms-modal-title">Delete {selected.size} Files?</div>
            <p className="cms-modal-body">
              Permanently delete <strong>{selected.size}</strong> file{selected.size !== 1 ? 's' : ''}. This cannot be undone.
            </p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" disabled={deleting} onClick={doDeleteSelected}>
                {deleting ? 'Deleting...' : `Delete ${selected.size} files`}
              </button>
            </div>
          </div>
        </div>)}
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SETTINGS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminIcons() {
    const [icons, setIcons] = useState<AdminIcon[]>([]);
    const [presetIcons, setPresetIcons] = useState<AdminPresetIcon[]>([]);
    const [label, setLabel] = useState('');
    const [sortOrder, setSortOrder] = useState('0');
    const [active, setActive] = useState(true);
    const [file, setFile] = useState<File | null>(null);
    const [draggingIcon, setDraggingIcon] = useState(false);
    const iconFileInputRef = React.useRef<HTMLInputElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<AdminIcon | null>(null);
    const [presetDeleteTarget, setPresetDeleteTarget] = useState<AdminPresetIcon | null>(null);
    function buildPresetIcons(overrides: PresetIconOverride[]) {
        const map = new Map(overrides.map(o => [o.icon_key, o]));
        return PRESET_ICON_URLS
            .map((icon, index) => {
            const override = map.get(icon.label);
            return {
                key: icon.label,
                originalLabel: icon.label,
                label: override?.label || icon.label,
                url: icon.url,
                active: override ? override.active : 1,
                sort_order: override ? override.sort_order : index,
                deleted: override ? override.deleted : 0,
            };
        })
            .filter(icon => icon.deleted !== 1)
            .sort((a, b) => a.sort_order - b.sort_order);
    }
    const load = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [iconData, presetData] = await Promise.all([adminGetIcons(), adminGetPresetIcons()]);
            setIcons(iconData.icons);
            setPresetIcons(buildPresetIcons(presetData.overrides ?? []));
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    async function uploadIcon(e: React.FormEvent) {
        e.preventDefault();
        if (!file) {
            setErr('Choose an icon image first.');
            return;
        }
        setSaving(true);
        setErr('');
        try {
            const form = new FormData();
            form.append('icon', file);
            form.append('label', label.trim() || file.name.replace(/\.[^.]+$/, ''));
            form.append('sort_order', sortOrder || '0');
            form.append('active', active ? '1' : '0');
            await adminUploadIcon(form);
            setLabel('');
            setSortOrder('0');
            setActive(true);
            setFile(null);
            const input = document.getElementById('admin-icon-file') as HTMLInputElement | null;
            if (input)
                input.value = '';
            await load();
        }
        catch (e: any) {
            setErr(e.message);
        }
        finally {
            setSaving(false);
        }
    }
    async function updateIcon(icon: AdminIcon, patch: Partial<AdminIcon>) {
        try {
            const body = { label: icon.label, active: !!icon.active, sort_order: icon.sort_order, ...patch };
            const r = await adminUpdateIcon(icon.id, body);
            setIcons(prev => prev.map(item => item.id === icon.id ? r.icon : item));
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    async function deleteIcon(icon: AdminIcon) {
        try {
            await adminDeleteIcon(icon.id);
            setIcons(prev => prev.filter(item => item.id !== icon.id));
            setDeleteTarget(null);
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    async function updatePresetIcon(icon: AdminPresetIcon, patch: Partial<AdminPresetIcon>) {
        try {
            const body = {
                label: icon.label,
                active: !!icon.active,
                sort_order: icon.sort_order,
                deleted: !!icon.deleted,
                ...patch,
            };
            await adminUpdatePresetIcon(icon.key, body);
            await load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    async function deletePresetIcon(icon: AdminPresetIcon) {
        try {
            await adminDeletePresetIcon(icon.key);
            setPresetDeleteTarget(null);
            await load();
        }
        catch (e: any) {
            alert(e.message);
        }
    }
    function acceptIconFile(nextFile: File | null | undefined) {
        if (!nextFile)
            return;
        const isImage = nextFile.type.startsWith('image/') || /\.(svg|png|jpe?g|webp|gif|avif)$/i.test(nextFile.name);
        if (!isImage) {
            setErr('Please choose an image file.');
            return;
        }
        setErr('');
        setFile(nextFile);
    }
    return (<div className="cms-section">
      <div className="cms-section-header">
        <div>
          <h2 className="cms-section-title">Icon Library</h2>
          <p className="cms-section-sub">Upload icons here to make them available in the user editor Icons panel.</p>
        </div>
      </div>

      <form className="cms-card cms-icon-upload-card" onSubmit={uploadIcon}>
        <div className="cms-card-title">Import Icon</div>
        <div className="cms-icon-upload-grid">
          <div className="cms-form-row cms-icon-name-row">
            <label>Name</label>
            <input type="text" value={label} placeholder="Sale badge, logo, marker..." onChange={e => setLabel(e.target.value)}/>
          </div>
          <div className="cms-form-row">
            <label>Sort order</label>
            <input type="number" value={sortOrder} onChange={e => setSortOrder(e.target.value)}/>
          </div>
          <div className="cms-form-row cms-icon-drop-row">
            <label>Image</label>
            <div className={`cms-icon-dropzone${draggingIcon ? ' is-dragging' : ''}${file ? ' has-file' : ''}`} role="button" tabIndex={0} onClick={() => iconFileInputRef.current?.click()} onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                iconFileInputRef.current?.click();
            }
        }} onDragEnter={e => {
            e.preventDefault();
            e.stopPropagation();
            setDraggingIcon(true);
        }} onDragOver={e => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
            setDraggingIcon(true);
        }} onDragLeave={e => {
            e.preventDefault();
            e.stopPropagation();
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setDraggingIcon(false);
            }
        }} onDrop={e => {
            e.preventDefault();
            e.stopPropagation();
            setDraggingIcon(false);
            acceptIconFile(e.dataTransfer.files?.[0]);
        }}>
              <input id="admin-icon-file" ref={iconFileInputRef} type="file" accept="image/*,.svg" onChange={e => acceptIconFile(e.target.files?.[0])}/>
              <span className="cms-icon-drop-mark">auto_awesome</span>
              <span className="cms-icon-drop-title">{file ? file.name : 'Click, or drag and drop the icon'}</span>
              <span className="cms-icon-drop-sub">SVG, PNG, JPG, WebP, GIF, or AVIF</span>
            </div>
          </div>
          <div className="cms-form-row cms-toggle-row">
            <label>Visible to users</label>
            <label className="cms-toggle">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)}/>
              <span className="cms-toggle-track"/>
            </label>
          </div>
        </div>
        {err && <div className="cms-error">{err}</div>}
        <button className="cms-btn cms-btn-primary" type="submit" disabled={saving}>
          {saving ? 'Uploading...' : 'Import icon'}
        </button>
      </form>

      <div className="cms-card cms-icon-system-card">
        <div className="cms-card-title">User Icons</div>
        <p className="cms-section-sub">Manage built-in and imported icons shown in the user editor Icons panel.</p>
        <div className="cms-icon-grid">
          {presetIcons.map(icon => (<div key={icon.key} className={`cms-icon-card cms-icon-card--preset${icon.active ? '' : ' cms-icon-card--hidden'}`}>
              <div className="cms-icon-thumb">
                <img src={icon.url} alt={icon.label} loading="lazy"/>
              </div>
              <input className="cms-icon-name" value={icon.label} onChange={e => setPresetIcons(prev => prev.map(item => item.key === icon.key ? { ...item, label: e.target.value } : item))} onBlur={e => updatePresetIcon(icon, { label: e.target.value })}/>
              <div className="cms-icon-meta">
                <label>
                  Order
                  <input type="number" value={icon.sort_order} onChange={e => setPresetIcons(prev => prev.map(item => item.key === icon.key ? { ...item, sort_order: Number(e.target.value) } : item))} onBlur={e => updatePresetIcon(icon, { sort_order: Number(e.target.value) })}/>
                </label>
                <label className="cms-icon-visible">
                  <input type="checkbox" checked={!!icon.active} onChange={e => updatePresetIcon(icon, { active: e.target.checked ? 1 : 0 })}/>
                  Visible
                </label>
              </div>
              <div className="cms-icon-actions">
                <a className="cms-btn cms-btn-sm" href={icon.url} target="_blank" rel="noreferrer">Open</a>
                <button className="cms-btn cms-btn-sm cms-btn-danger" type="button" onClick={() => setPresetDeleteTarget(icon)}>Delete</button>
              </div>
            </div>))}
          {loading && <div className="cms-loading">Loading imported icons...</div>}
          {!loading && icons.map(icon => (<div key={icon.id} className={`cms-icon-card${icon.active ? '' : ' cms-icon-card--hidden'}`}>
              <div className="cms-icon-thumb">
                <img src={icon.url} alt={icon.label} loading="lazy"/>
              </div>
              <input className="cms-icon-name" value={icon.label} onChange={e => setIcons(prev => prev.map(item => item.id === icon.id ? { ...item, label: e.target.value } : item))} onBlur={e => updateIcon(icon, { label: e.target.value })}/>
              <div className="cms-icon-meta">
                <label>
                  Order
                  <input type="number" value={icon.sort_order} onChange={e => setIcons(prev => prev.map(item => item.id === icon.id ? { ...item, sort_order: Number(e.target.value) } : item))} onBlur={e => updateIcon(icon, { sort_order: Number(e.target.value) })}/>
                </label>
                <label className="cms-icon-visible">
                  <input type="checkbox" checked={!!icon.active} onChange={e => updateIcon(icon, { active: e.target.checked ? 1 : 0 })}/>
                  Visible
                </label>
              </div>
              <div className="cms-icon-actions">
                <a className="cms-btn cms-btn-sm" href={icon.url} target="_blank" rel="noreferrer">Open</a>
                <button className="cms-btn cms-btn-sm cms-btn-danger" type="button" onClick={() => setDeleteTarget(icon)}>Delete</button>
              </div>
            </div>))}
          {!loading && presetIcons.length === 0 && icons.length === 0 && (<div className={cx("cms-empty-state", cssClass({ gridColumn: '1/-1' }))}>No icons available yet.</div>)}
        </div>
      </div>

      {deleteTarget && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setDeleteTarget(null)}>
          <div className="cms-modal cms-modal-sm cms-icon-delete-modal">
            <div className="cms-icon-delete-header">
              <div className="cms-icon-delete-preview">
                <img src={deleteTarget.url} alt={deleteTarget.label}/>
              </div>
              <button className="cms-modal-close material-symbol" type="button" onClick={() => setDeleteTarget(null)} aria-label="Close delete icon dialog">close</button>
            </div>
            <div className="cms-modal-title">Delete Icon</div>
            <p className="cms-modal-body">
              Remove <strong>{deleteTarget.label}</strong> from the icon library. Users will no longer see it in the editor Icons panel.
            </p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={() => deleteIcon(deleteTarget)}>Delete icon</button>
            </div>
          </div>
        </div>)}

      {presetDeleteTarget && (<div className="cms-modal-bg" onClick={e => e.target === e.currentTarget && setPresetDeleteTarget(null)}>
          <div className="cms-modal cms-modal-sm cms-icon-delete-modal">
            <div className="cms-icon-delete-header">
              <div className="cms-icon-delete-preview">
                <img src={presetDeleteTarget.url} alt={presetDeleteTarget.label}/>
              </div>
              <button className="cms-modal-close material-symbol" type="button" onClick={() => setPresetDeleteTarget(null)} aria-label="Close delete built-in icon dialog">close</button>
            </div>
            <div className="cms-modal-title">Delete Built-in Icon</div>
            <p className="cms-modal-body">
              Remove <strong>{presetDeleteTarget.label}</strong> from the user Icons panel. This hides the built-in icon through an admin override.
            </p>
            <div className="cms-modal-footer">
              <button className="cms-btn" onClick={() => setPresetDeleteTarget(null)}>Cancel</button>
              <button className="cms-btn cms-btn-danger" onClick={() => deletePresetIcon(presetDeleteTarget)}>Delete icon</button>
            </div>
          </div>
        </div>)}
    </div>);
}
function AdminSettings() {
    const [s, setS] = useState<SiteSettings | null>(null);
    const [saved, setSaved] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => {
        adminGetSettings()
            .then(settings => setS({ ...DEFAULT_LEAFLET_CREATION_LIMITS, ...DEFAULT_CONCURRENT_LOGIN_LIMITS, ...DEFAULT_PLAN_PRICES, ...DEFAULT_AI_COVER_GENERATION_LIMITS, ...settings }))
            .catch(e => setErr(e.message));
    }, []);
    async function save() {
        if (!s)
            return;
        try {
            const settings = await adminSaveSettings(s);
            setS({ ...DEFAULT_LEAFLET_CREATION_LIMITS, ...DEFAULT_CONCURRENT_LOGIN_LIMITS, ...DEFAULT_PLAN_PRICES, ...DEFAULT_AI_COVER_GENERATION_LIMITS, ...settings });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        }
        catch (e: any) {
            setErr(e.message);
        }
    }
    if (!s)
        return <div className="cms-loading">Loading...</div>;
    return (<div className="cms-section">
      <h2 className="cms-section-title">Site Settings</h2>
      {err && <div className="cms-error">{err}</div>}
      <div className="cms-settings-grid">
        <div className="cms-card cms-settings-general">
          <div className="cms-settings-card-head">
            <div>
              <div className="cms-card-title"><span className="material-symbol" aria-hidden="true">tune</span> General</div>
              <p className="cms-section-sub">Manage global app details, billing keys, and AI cover image usage by subscription plan.</p>
            </div>
          </div>
          <div className="cms-settings-general-layout">
            <div className="cms-settings-group">
              <div className="cms-settings-group-title">Website</div>
              <div className="cms-form-row">
                <label>Site Name</label>
                <input value={s.site_name} onChange={e => setS({ ...s, site_name: e.target.value })}/>
              </div>
              <div className="cms-form-row">
                <label>Support Email</label>
                <input type="email" value={s.support_email} onChange={e => setS({ ...s, support_email: e.target.value })}/>
              </div>
              <div className="cms-form-row">
                <label>Announcement Banner</label>
                <input value={s.announcement_banner} placeholder="Leave blank to hide" onChange={e => setS({ ...s, announcement_banner: e.target.value })}/>
              </div>
            </div>
            <div className="cms-settings-group">
              <div className="cms-settings-group-title">Integrations</div>
              <div className="cms-form-row">
                <label>Stripe Checkout Link</label>
                <input type="url" value={s.stripe_checkout_url || ''} placeholder="https://buy.stripe.com/..." onChange={e => setS({ ...s, stripe_checkout_url: e.target.value })}/>
              </div>
              <div className="cms-form-row">
                <label>Stripe Secret Key</label>
                <input type="password" value={s.stripe_secret_key || ''} placeholder="sk_live_..." autoComplete="off" onChange={e => setS({ ...s, stripe_secret_key: e.target.value })}/>
              </div>
              <div className="cms-form-row">
                <label>OPENAI_API_KEY</label>
                <input type="password" value={s.openai_api_key || ''} placeholder="sk-..." autoComplete="off" onChange={e => setS({ ...s, openai_api_key: e.target.value })}/>
              </div>
            </div>
            <div className="cms-settings-group cms-plan-price-group">
              <div className="cms-settings-group-title">Plan Prices</div>
              <p className="cms-plan-price-note">Set the monthly price and the annual total shown on the admin pricing editor, pricing page, and checkout.</p>
              <div className="cms-plan-price-grid">
                {PLAN_PRICE_FIELDS.map(field => (
                  <div className="cms-plan-price-card" key={field.plan}>
                    <div className="cms-plan-price-head">
                      <span className="material-symbol" aria-hidden="true">{field.icon}</span>
                      <strong>{field.label}</strong>
                    </div>
                    <label>
                      <span>Monthly</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={s[field.monthlyKey] ?? ''}
                        onChange={e => setS({ ...s, [field.monthlyKey]: e.target.value })}
                        aria-label={`${field.label} monthly price`}
                      />
                    </label>
                    <label>
                      <span>Annual Total</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={s[field.annualKey] ?? ''}
                        onChange={e => setS({ ...s, [field.annualKey]: e.target.value })}
                        aria-label={`${field.label} annual total price`}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <div className="cms-settings-group cms-plan-limit-group">
              <div className="cms-settings-group-title">Exported Leaflets</div>
              <p className="cms-plan-limit-note">Set how many leaflets each plan can count after first successful export.</p>
              <div className="cms-plan-limit-grid">
                {LEAFLET_CREATION_LIMIT_FIELDS.map(field => (
                  <label className="cms-plan-limit-card" key={field.key}>
                    <span className="material-symbol" aria-hidden="true">{field.icon}</span>
                    <strong>{field.label}</strong>
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={s[field.key] ?? ''}
                      onChange={e => setS({ ...s, [field.key]: e.target.value })}
                      aria-label={`${field.label} exported leaflets limit`}
                    />
                    <small>exported leaflets</small>
                  </label>
                ))}
              </div>
            </div>
            <div className="cms-settings-group cms-device-limit-group">
              <div className="cms-settings-group-title">Concurrent Devices</div>
              <p className="cms-device-limit-note">Set how many active logged-in devices each plan can use at the same time.</p>
              <div className="cms-device-limit-grid">
                {CONCURRENT_LOGIN_LIMIT_FIELDS.map(field => (
                  <label className="cms-device-limit-card" key={field.key}>
                    <span className="material-symbol" aria-hidden="true">{field.icon}</span>
                    <strong>{field.label}</strong>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={s[field.key] ?? ''}
                      onChange={e => setS({ ...s, [field.key]: e.target.value })}
                      aria-label={`${field.label} concurrent device limit`}
                    />
                    <small>devices total</small>
                  </label>
                ))}
              </div>
            </div>
            <div className="cms-settings-group cms-ai-limit-group">
              <div className="cms-settings-group-title">AI Image Generator</div>
              <p className="cms-ai-limit-note">Set how many AI cover images each plan can generate for one leaflet.</p>
              <div className="cms-ai-limit-grid">
                {AI_COVER_GENERATION_LIMIT_FIELDS.map(field => (
                  <label className="cms-ai-limit-card" key={field.key}>
                    <span className="material-symbol" aria-hidden="true">{field.icon}</span>
                    <strong>{field.label}</strong>
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={s[field.key] ?? ''}
                      onChange={e => setS({ ...s, [field.key]: e.target.value })}
                      aria-label={`${field.label} AI cover generations per leaflet`}
                    />
                    <small>images per leaflet</small>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="cms-card">
          <div className="cms-card-title">Access Control</div>
          <div className="cms-form-row cms-toggle-row">
            <label>Maintenance Mode</label>
            <label className="cms-toggle">
              <input type="checkbox" checked={s.maintenance_mode === '1'} onChange={e => setS({ ...s, maintenance_mode: e.target.checked ? '1' : '0' })}/>
              <span className="cms-toggle-track"/>
            </label>
          </div>
          <div className="cms-form-row cms-toggle-row">
            <label>Allow New Sign-ups</label>
            <label className="cms-toggle">
              <input type="checkbox" checked={s.allow_signups === '1'} onChange={e => setS({ ...s, allow_signups: e.target.checked ? '1' : '0' })}/>
              <span className="cms-toggle-track"/>
            </label>
          </div>
          <div className="cms-form-row">
            <label>PDF Exports (Free plan)</label>
            <input type="number" min="0" max="10000" value={s.free_pdf_export_limit ?? '1'} onChange={e => setS({ ...s, free_pdf_export_limit: e.target.value })} className={cssClass({ width: 80 })}/>
          </div>
        </div>

        <div className="cms-card cms-settings-videos">
          <div className="cms-card-title"><span className="material-symbol" aria-hidden="true">video_library</span> Website Videos</div>
          <p className="cms-section-sub">Add or replace the YouTube links used across the public website.</p>
          {[
            ['home_demo_video_url', 'Home page demo'],
            ['help_video_1_url', 'Help: Getting Started in 5 Minutes'],
            ['help_video_2_url', 'Help: Import Products from Excel'],
            ['help_video_3_url', 'Help: Customize Your Card Layout'],
            ['help_video_4_url', 'Help: Export a Flipbook'],
            ['help_video_5_url', 'Help: Add Cover & Back Pages'],
            ['help_video_6_url', 'Help: Typography & Font Settings'],
          ].map(([key, label]) => (
            <div className="cms-form-row" key={key}>
              <label>{label}</label>
              <input
                type="url"
                value={s[key as keyof SiteSettings] || ''}
                placeholder="https://www.youtube.com/watch?v=..."
                onChange={e => setS({ ...s, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      <button className="cms-btn cms-btn-primary cms-save-btn" onClick={save}>
        {saved ? <><span className="material-symbol" aria-hidden="true">check</span> Saved!</> : 'Save Settings'}
      </button>
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SETUP SCREEN â€” shown when no admin exists yet
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminSetup() {
    const navigate = useNavigate();
    return (<div className="cms-splash-center">
      <div className="cms-setup-box">
        <div className="cms-setup-icon">shield</div>
        <h2 className="cms-setup-title">Page Not Available</h2>
        <p className="cms-setup-desc">
          This page is not available for your account.
        </p>
        <button className="cms-btn cms-btn-primary cms-setup-btn" onClick={() => navigate('/')}>
          Back to App
        </button>
      </div>
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   NOT-AUTHORISED SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminForbidden() {
    const navigate = useNavigate();
    const { openAuthModal } = useAuth();
    return (<div className="cms-splash-center">
      <div className="cms-setup-box">
        <div className="cms-setup-icon">block</div>
        <h2 className="cms-setup-title">Page Not Available</h2>
        <p className="cms-setup-desc">
          This page is available only for the admin account.
        </p>
        <div className="cms-setup-actions">
          <button className="cms-btn cms-btn-primary" onClick={() => openAuthModal('login')}>
            Login as Admin
          </button>
          <button className="cms-btn" onClick={() => navigate('/')}>
            Back to App
          </button>
        </div>
      </div>
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   NOT-LOGGED-IN SCREEN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function AdminLogin() {
    const { openAuthModal } = useAuth();
    return (<div className="cms-splash-center">
      <div className="cms-setup-box">
        <div className="cms-setup-icon">encrypted</div>
        <h2 className="cms-setup-title">Login Required</h2>
        <p className="cms-setup-desc">
          Sign in with ziad.jarbou@gmail.com to access the admin panel.
        </p>
        <button className="cms-btn cms-btn-primary cms-setup-btn" onClick={() => openAuthModal('login')}>
          Login
        </button>
      </div>
    </div>);
}
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ROOT â€” AdminPage
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
type BootState = 'checking' | 'allowed' | 'setup' | 'forbidden' | 'no-session';
export default function AdminPage() {
    const location = useLocation();
    const { user, loading: authLoading } = useAuth();
    const [boot, setBoot] = useState<BootState>('checking');
    const checkAccess = useCallback(async () => {
        setBoot('checking');
        try {
            await adminGetMe();
            setBoot('allowed');
        }
        catch (e) {
            const status = (e as AdminApiError).status;
            if (status === 401) {
                setBoot('no-session');
                return;
            }
            try {
                const { hasAdmin } = await adminCheck();
                setBoot(hasAdmin ? 'forbidden' : 'setup');
            }
            catch {
                setBoot('forbidden');
            }
        }
    }, []);
    useEffect(() => {
        if (authLoading)
            return;
        if (!user) {
            setBoot('no-session');
            return;
        }
        checkAccess();
    }, [authLoading, user, checkAccess]);
    const active = location.pathname.split('/')[2] ?? 'dashboard';
    if (authLoading || boot === 'checking')
        return <div className="cms-splash">Checking permissions...</div>;
    if (boot === 'no-session')
        return <AdminLogin />;
    if (boot === 'forbidden')
        return <AdminForbidden />;
    if (boot === 'setup')
        return <AdminSetup />;
    return (<div className="cms-root">
      <Sidebar active={active}/>
      <main className="cms-main">
        <Routes>
          <Route index element={<AdminDashboard />}/>
          <Route path="dashboard" element={<AdminDashboard />}/>
          <Route path="users" element={<AdminUsers />}/>
          <Route path="leaflets" element={<AdminLeaflets />}/>
          <Route path="cover-pages" element={<AdminCoverPages />}/>
          <Route path="cover-pages/:id" element={<AdminCoverPageEditor />}/>
          <Route path="cover-templates" element={<AdminCoverTemplates />}/>
          <Route path="uploads" element={<AdminUploads />}/>
          <Route path="icons" element={<AdminIcons />}/>
          <Route path="seo" element={<AdminSEO />}/>
          <Route path="pages" element={<AdminPages />}/>
          <Route path="card-templates" element={<AdminCardTemplates />}/>
          <Route path="help-center" element={<AdminHelpCenter />}/>
          <Route path="backup" element={<AdminBackup />}/>
          <Route path="settings" element={<AdminSettings />}/>
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />}/>
        </Routes>
      </main>
    </div>);
}


