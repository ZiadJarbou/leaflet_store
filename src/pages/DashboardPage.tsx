import { cssClass, cx } from '../utils/styleClass';
import { useEffect, useRef, useState } from 'react';
import SEOHelmet from '../components/SEOHelmet';
import Footer from '../components/Footer';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserStats, createPortalSession, createCheckoutSession, getUserInsights, getLeaflets, type UserStats, type UserInsights } from '../services/api';
import { getStoredToken } from '../services/authService';
import './DashboardPage.css';
/* ── Leaflet multi-select dropdown ── */
interface LeafletItem {
    id: number;
    title: string;
    created_at: string;
}
interface LeafletDropdownProps {
    leaflets: LeafletItem[];
    selected: Set<number>;
    onChange: (next: Set<number>) => void;
}
function LeafletDropdown({ leaflets, selected, onChange }: LeafletDropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    const allSelected = selected.size === 0 || selected.size === leaflets.length;
    function toggle(id: number) {
        const next = new Set(selected);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        /* empty set = "all" */
        if (next.size === leaflets.length)
            next.clear();
        onChange(next);
    }
    function selectAll() { onChange(new Set()); }
    function clearAll() { onChange(new Set(leaflets.map(l => l.id))); }
    const label = allSelected
        ? 'All Leaflets'
        : `${selected.size} leaflet${selected.size !== 1 ? 's' : ''} selected`;
    return (<div className="db-ld-wrap" ref={ref}>
      <button className={`db-ld-trigger${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)} type="button">
        <span className="db-ld-icon">folder</span>
        <span className="db-ld-label">{label}</span>
        <span className="db-ld-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (<div className="db-ld-panel">
          <div className="db-ld-toolbar">
            <button className="db-ld-tb-btn" onClick={selectAll}>Select all</button>
            <button className="db-ld-tb-btn" onClick={clearAll}>Clear</button>
          </div>
          <div className="db-ld-list">
            {leaflets.length === 0 && (<div className="db-ld-empty">No leaflets yet</div>)}
            {leaflets.map(l => {
                const checked = selected.size === 0 || selected.has(l.id);
                return (<label key={l.id} className="db-ld-item">
                  <input type="checkbox" className="db-ld-checkbox" checked={checked} onChange={() => toggle(l.id)}/>
                  <span className="db-ld-item-name">{l.title || `Leaflet #${l.id}`}</span>
                  <span className="db-ld-item-date">
                    {new Date(l.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                  </span>
                </label>);
            })}
          </div>
        </div>)}
    </div>);
}
const PLAN_COLOR: Record<string, string> = {
    free: '#64748b', starter: '#38bdf8', pro: '#49f2b6', business: '#7c5cff', agency: '#f59e0b', admin: '#f59e0b',
};
function planBadge(plan: string) {
    return (<span className={cx("db-plan-badge", cssClass({ background: `${PLAN_COLOR[plan] ?? '#64748b'}22`, color: PLAN_COLOR[plan] ?? '#64748b', borderColor: `${PLAN_COLOR[plan] ?? '#64748b'}44` }))}>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>);
}
function fmt(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtMaybe(iso: string | null | undefined) {
    if (!iso)
        return 'Not available';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return 'Not available';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
function timeSince(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    if (mins < 60)
        return `${mins}m ago`;
    if (hours < 24)
        return `${hours}h ago`;
    if (days < 7)
        return `${days}d ago`;
    if (weeks < 5)
        return `${weeks}w ago`;
    if (months < 12)
        return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}
export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState<UserStats | null>(null);
    const [insights, setInsights] = useState<UserInsights | null>(null);
    const [leafletList, setLeafletList] = useState<LeafletItem[]>([]);
    const [selectedLeaflets, setSelectedLeaflets] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [insLoading, setInsLoading] = useState(true);
    const [portalLoading, setPortalLoading] = useState(false);
    const [upgradeLoading, setUpgradeLoading] = useState(false);
    useEffect(() => {
        if (!user) {
            navigate('/');
            return;
        }
        getUserStats()
            .then(setStats)
            .finally(() => setLoading(false));
        getUserInsights()
            .then(setInsights)
            .finally(() => setInsLoading(false));
        getLeaflets()
            .then(r => setLeafletList(r.leaflets.map(l => ({ id: l.id, title: l.title, created_at: l.created_at }))));
    }, [user]);
    async function handlePortal() {
        setPortalLoading(true);
        try {
            const url = await createPortalSession();
            window.location.href = url;
        }
        catch {
            setPortalLoading(false);
        }
    }
    async function handleUpgrade() {
        if (!getStoredToken()) {
            navigate('/pricing');
            return;
        }
        setUpgradeLoading(true);
        try {
            const url = await createCheckoutSession('pro', 'monthly');
            window.location.href = url;
        }
        catch {
            setUpgradeLoading(false);
        }
    }
    if (!user)
        return null;
    const initial = user.name.charAt(0).toUpperCase();
    const insightCards = [
        {
            icon: 'calendar_month',
            color: '#49f2b6',
            label: 'Avg Leaflets / Week',
            value: insLoading ? '—' : `${insights?.avg_leaflets_per_week ?? 0}`,
            sub: 'leaflets per week on average',
        },
        {
            icon: 'inventory_2',
            color: '#7c5cff',
            label: 'Avg Products / Leaflet',
            value: insLoading ? '—' : `${insights?.avg_products_per_leaflet ?? 0}`,
            sub: 'products per leaflet on average',
        },
        {
            icon: 'star',
            color: '#f59e0b',
            label: 'Most Productive Day',
            value: insLoading ? '—' : (insights?.most_productive_day ?? '—'),
            sub: 'day you create the most leaflets',
        },
        {
            icon: 'schedule',
            color: '#38bdf8',
            label: 'Last Leaflet Created',
            value: insLoading ? '—' : (insights?.last_leaflet_created_at ? timeSince(insights.last_leaflet_created_at) : '—'),
            sub: insights?.last_leaflet_created_at ? fmt(insights.last_leaflet_created_at) : 'No leaflets yet',
        },
        {
            icon: 'ads_click',
            color: '#f472b6',
            label: 'Total Product Clicks',
            value: insLoading ? '—' : String(insights?.total_clicks ?? 0),
            sub: 'clicks tracked across all products',
        },
    ];
    const allClicks = insights?.top_clicked_products ?? [];
    const filteredClicks = selectedLeaflets.size === 0
        ? allClicks
        : allClicks.filter(p => selectedLeaflets.has(p.leaflet_id));
    const maxClicks = Math.max(1, ...filteredClicks.map(p => p.clicks));
    const activeMetricLabels = new Set([
        'Total Leaflets',
        'Total Products',
        'Member Since',
        'Avg Leaflets / Week',
        'Avg Products / Leaflet',
        'Most Productive Day',
        'Last Leaflet Created',
        'Total Product Clicks',
    ]);
    return (<>
    <SEOHelmet pageKey="dashboard"/>
    <div className="db-page container">
      <div className="db-header">
        <div className="db-header-left">
          <div className="db-avatar">{initial}</div>
          <div>
            <h1 className="db-welcome">Welcome back, <span>{user.name}</span></h1>
            <p className="db-email">{user.email}</p>
          </div>
        </div>
        <div className="db-header-actions">
          <Link className="btn primary" to="/create-leaflet">+ New leaflet</Link>
          <button className="btn ghost" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="db-stats">
        {[
            { label: 'Total Leaflets', value: loading ? '—' : String(stats?.leaflets_count ?? 0), icon: 'description', color: '#49f2b6' },
            { label: 'Exported leaflets', value: loading ? '—' : `${stats?.exported_leaflets_used ?? 0} / ${stats?.exported_leaflets_limit ?? '∞'} used`, icon: 'file_upload', color: '#38bdf8' },
            { label: 'Total Products', value: loading ? '—' : String(stats?.products_count ?? 0), icon: 'inventory_2', color: '#7c5cff' },
            { label: 'Current Plan', value: loading ? '—' : (stats?.subscription_plan ?? 'free'), icon: 'star', color: PLAN_COLOR[stats?.subscription_plan ?? 'free'] ?? '#64748b', isPlan: true },
            { label: 'Member Since', value: loading ? '—' : (stats?.member_since ? fmt(stats.member_since) : '—'), icon: 'calendar_month', color: '#f59e0b' },
        ].map(s => (<div key={s.label} className={`db-stat-card${activeMetricLabels.has(s.label) ? ' db-card-active' : ''}`}>
            <div className={cx("db-stat-icon", cssClass({ background: `${s.color}18`, color: s.color }))}>{s.icon}</div>
            <div>
              <div className="db-stat-label">{s.label}</div>
              {s.isPlan
                ? <div className="db-stat-value">{planBadge(s.value)}</div>
                : <div className="db-stat-value">{s.value}</div>}
            </div>
          </div>))}
      </div>

      {/* ── Insights strip ── */}
      <section className="db-section db-insights-strip">
        <div className="db-section-head">
          <h2>Activity Insights</h2>
        </div>
        <div className="db-insights-row">
          {insightCards.map(c => (<div key={c.label} className={`db-insight-card${activeMetricLabels.has(c.label) ? ' db-card-active' : ''}`}>
              <div className={cx("db-insight-icon", cssClass({ background: `${c.color}18`, color: c.color }))}>{c.icon}</div>
              <div className="db-insight-body">
                <div className="db-insight-label">{c.label}</div>
                <div className={cx("db-insight-value", cssClass({ color: c.color }))}>{c.value}</div>
                <div className="db-insight-sub">{c.sub}</div>
              </div>
            </div>))}
        </div>
      </section>

      <div className="db-grid">

        {/* ── Recent leaflets ── */}
        <section className="db-section db-section--wide">
          <div className="db-section-head">
            <h2>Recent Leaflets</h2>
            <Link className="db-see-all" to="/my-leaflets">See all →</Link>
          </div>
          {loading ? (<div className="db-loading">Loading…</div>) : !stats?.recent_leaflets.length ? (<div className="db-empty">
              <span className="db-empty-icon">description</span>
              <p>You haven't created any leaflets yet.</p>
              <Link className="btn primary" to="/create-leaflet">Create your first leaflet</Link>
            </div>) : (<div className="db-leaflet-grid">
              {stats.recent_leaflets.map(l => (<Link key={l.id} className="db-leaflet-card" to={`/app/leaflet/${l.id}`}>
                  <div className="db-leaflet-thumb">
                    {l.thumbnail_url
                    ? <img src={l.thumbnail_url} alt={l.name}/>
                    : <span className="db-leaflet-ph">description</span>}
                  </div>
                  <div className="db-leaflet-info">
                    <div className="db-leaflet-name">{l.name}</div>
                    <div className="db-leaflet-date">{fmt(l.created_at)}</div>
                  </div>
                </Link>))}
            </div>)}
        </section>

        {/* ── Right column ── */}
        <div className="db-sidebar-col">

          {/* Subscription card */}
          <section className="db-section">
            <h2>Subscription</h2>
            {loading ? <div className="db-loading">Loading…</div> : (<div className="db-sub-card">
                <div className="db-sub-row">
                  <span className="db-sub-key">Plan</span>
                  {planBadge(stats?.subscription_plan ?? 'free')}
                </div>
                {stats?.subscription_plan !== 'free' && (<>
                    <div className="db-sub-row">
                      <span className="db-sub-key">Billing</span>
                      <span className="db-sub-val">{stats?.subscription_period === 'annual' ? 'Annual' : 'Monthly'}</span>
                    </div>
                    <div className="db-sub-row">
                      <span className="db-sub-key">Status</span>
                      <span className={`db-sub-status db-sub-status--${stats?.subscription_status}`}>
                        {stats?.subscription_status}
                      </span>
                    </div>
                    <div className="db-sub-row">
                      <span className="db-sub-key">Expiry date</span>
                      <span className="db-sub-val">{fmtMaybe(stats?.subscription_end)}</span>
                    </div>
                  </>)}
                <div className="db-sub-actions">
                  {stats?.subscription_plan === 'free' ? (<button className="btn primary db-sub-btn" onClick={handleUpgrade} disabled={upgradeLoading}>
                      {upgradeLoading ? 'Redirecting…' : 'Upgrade plan →'}
                    </button>) : (<button className="btn ghost db-sub-btn" onClick={handlePortal} disabled={portalLoading}>
                      {portalLoading ? 'Opening…' : 'Manage billing →'}
                    </button>)}
                  <Link className="db-sub-link" to="/pricing">View all plans</Link>
                </div>
              </div>)}
          </section>

        </div>
      </div>

      {/* ── Second row: Product Click Tracking (wide) + Quick Actions (sidebar) ── */}
      <div className="db-grid db-grid--bottom">

        {/* Product click tracking */}
        <section className="db-section db-section--wide db-clicks-section">
          <div className="db-section-head">
            <h2>Product Click Tracking</h2>
            <div className="db-clicks-head-right">
              <span className="db-clicks-total">{insLoading ? '—' : insights?.total_clicks ?? 0} total clicks</span>
              <LeafletDropdown leaflets={leafletList} selected={selectedLeaflets} onChange={setSelectedLeaflets}/>
            </div>
          </div>
          {insLoading ? (<div className="db-loading">Loading…</div>) : !filteredClicks.length ? (<div className="db-empty">
              <span className="db-empty-icon">ads_click</span>
              <p>{allClicks.length === 0 ? 'No product clicks recorded yet. Clicks are tracked when visitors tap product links.' : 'No clicks for the selected leaflets.'}</p>
            </div>) : (<div className="db-clicks-list">
              {filteredClicks.map((p, i) => (<div key={p.id} className="db-click-row">
                  <span className="db-click-rank">#{i + 1}</span>
                  <div className="db-click-info">
                    <span className="db-click-name">{p.name || '(unnamed product)'}</span>
                    <Link className="db-click-leaflet" to={`/app/leaflet/${p.leaflet_id}`}>Leaflet #{p.leaflet_id}</Link>
                  </div>
                  <div className="db-click-bar-wrap">
                    <div className={cx("db-click-bar", cssClass({ width: `${Math.round((p.clicks / maxClicks) * 100)}%` }))}/>
                  </div>
                  <span className="db-click-count">{p.clicks}</span>
                </div>))}
            </div>)}
        </section>

        {/* Quick actions */}
        <div className="db-sidebar-col">
          <section className="db-section">
            <h2>Quick Actions</h2>
            <div className="db-actions">
              {[
            { icon: 'edit', label: 'Create leaflet', to: '/create-leaflet' },
            { icon: 'folder', label: 'My leaflets', to: '/my-leaflets' },
            { icon: 'settings', label: 'Account settings', to: '/settings' },
            { icon: 'credit_card', label: 'Billing & plans', to: '/pricing' },
        ].map(a => (<Link key={a.label} className="db-action-item" to={a.to}>
                  <span className="db-action-icon">{a.icon}</span>
                  <span className="db-action-label">{a.label}</span>
                  <span className="db-action-arrow">→</span>
                </Link>))}
            </div>
          </section>
        </div>

      </div>

    </div>
    <Footer />
    </>);
}
