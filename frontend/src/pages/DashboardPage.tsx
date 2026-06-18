import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { vaultApi, policiesApi, realEstateApi, liabilitiesApi, commoditiesApi } from '../services/api';
import Navbar from '../components/Navbar';
import ModuleTabs from '../components/ModuleTabs';
import ProfilePage from './ProfilePage';

// ── Types ──────────────────────────────────────────────────────────
interface Summary {
  total_bank_balance:number; bank_account_count:number;
  total_investment_value:number; investment_count:number;
  total_commodity_value:number; commodity_count:number;
  total_property_value:number; property_count:number;
  total_borrowed:number; total_lent:number;
  total_wealth:number; nominee_count:number; document_count:number;
}

// ── Pure SVG Donut Chart ──────────────────────────────────────────
const DonutChart: React.FC<{
  segments:{label:string;value:number;color:string}[];
  total:number; center:string; sub:string;
}> = ({segments,total,center,sub}) => {
  const r=68, cx=90, cy=90, sw=20, circ=2*Math.PI*r;
  let cum=0;
  const arcs = segments.filter(s=>s.value>0).map(s=>{
    const pct=s.value/(total||1);
    const dash=pct*circ; const gap=circ-dash;
    const offset=circ-cum*circ; cum+=pct;
    return {...s,dash,gap,offset};
  });
  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw}/>
      {arcs.map((a,i)=>(
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={sw}
          strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={a.offset} strokeLinecap="butt"
          style={{transform:`rotate(-90deg)`,transformOrigin:`${cx}px ${cy}px`,transition:'0.6s ease'}}/>
      ))}
      <text x={cx} y={cy-8} textAnchor="middle" style={{fontSize:'12px',fontWeight:700,fill:'#1e293b',fontFamily:'Sora,system-ui'}}>{center}</text>
      <text x={cx} y={cy+10} textAnchor="middle" style={{fontSize:'9px',fill:'#94a3b8',fontFamily:'system-ui'}}>{sub}</text>
    </svg>
  );
};

// ── Mini horizontal bar ───────────────────────────────────────────
const MiniBar: React.FC<{value:number;max:number;color:string}> = ({value,max,color}) => (
  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-1">
    <div className={`h-full rounded-full transition-all duration-700 ${color}`}
         style={{width:`${max>0?Math.min((value/max)*100,100):0}%`}}/>
  </div>
);

// ── Sparkline ────────────────────────────────────────────────────
const Sparkline: React.FC<{values:number[];color:string}> = ({values,color}) => {
  if(values.length<2) return null;
  const w=100,h=36, min=Math.min(...values), max=Math.max(...values), range=max-min||1;
  const pts=values.map((v,i)=>`${(i/(values.length-1))*w},${h-((v-min)/range)*(h-4)-2}`).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const fmt = (n:number|string) => `₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const fmtL = (n:number) => n>=10000000?`₹${(n/10000000).toFixed(1)}Cr`:n>=100000?`₹${(n/100000).toFixed(1)}L`:`₹${(n/1000).toFixed(0)}K`;

// ── Component ─────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary]     = useState<Summary|null>(null);
  const [banks, setBanks]         = useState<any[]>([]);
  const [invs, setInvs]           = useState<any[]>([]);
  const [coms, setComs]           = useState<any[]>([]);
  const [props, setProps]         = useState<any[]>([]);
  const [liabs, setLiabs]         = useState<any[]>([]);
  const [policies, setPolicies]   = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [toast, setToast]         = useState<string|null>(null);

  const toast$ = (msg:string) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [s,b,i,c,re,lb,pol,notif] = await Promise.all([
        vaultApi.getDashboard(),
        vaultApi.getBankAccounts(),
        vaultApi.getInvestments(),
        commoditiesApi.getAll(),
        realEstateApi.getAll(),
        liabilitiesApi.getAll(),
        policiesApi.getAll(),
        policiesApi.getNotifications().catch(()=>({data:{data:{notifications:[]}}})),
      ]);
      setSummary(s.data.data.summary);
      setBanks(b.data.data.accounts);
      setInvs(i.data.data.investments);
      setComs(c.data.data.commodities);
      setProps(re.data.data.properties);
      setLiabs(lb.data.data.liabilities);
      setPolicies(pol.data.data.policies);
      setNotifications(notif.data.data.notifications||[]);
    } catch { toast$('Failed to load some data.'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  // ── Derived numbers ───────────────────────────────────────────
  const totalWealth  = summary ? Number(summary.total_wealth) : 0;
  const totalBanks   = summary ? Number(summary.total_bank_balance) : 0;
  const totalInvVal  = summary ? Number(summary.total_investment_value) : 0;
  const totalComVal  = summary ? Number(summary.total_commodity_value) : 0;
  const totalPropVal = summary ? Number(summary.total_property_value) : 0;
  const totalBorrowed= summary ? Number(summary.total_borrowed) : 0;
  const totalLent    = summary ? Number(summary.total_lent) : 0;

  const totalInvested = invs.reduce((s,i)=>s+Number(i.invested_amount||i.current_value),0);
  const invPnl   = totalInvVal - totalInvested;
  const invPnlPct= totalInvested>0?((invPnl/totalInvested)*100).toFixed(1):'0.0';

  const activeLoans  = liabs.filter(l=>l.direction==='borrowed'&&!l.is_settled);
  const activeLent   = liabs.filter(l=>l.direction==='lent'&&!l.is_settled);
  const expiringSoon = notifications.length;
  const activePolicies = policies.filter(p=>p.computed_status==='active').length;

  const hour = new Date().getHours();
  const greeting = hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';

  // Donut segments — all asset classes
  const donutSegments = [
    {label:'Bank Savings',  value:totalBanks,    color:'#2563eb'},
    {label:'Investments',   value:totalInvVal,   color:'#10b981'},
    {label:'Commodities',   value:totalComVal,   color:'#f59e0b'},
    {label:'Real Estate',   value:totalPropVal,  color:'#8b5cf6'},
  ].filter(s=>s.value>0);

  const maxAsset = Math.max(totalBanks,totalInvVal,totalComVal,totalPropVal,1);
  const sparkData = [0.65,0.68,0.72,0.70,0.78,0.80,0.82,0.85,0.88,0.92,0.96,1.0].map(p=>p*totalWealth);

  const MODULE_CARDS = [
    { icon:'🏦', label:'Bank Accounts',  value:fmt(totalBanks),    sub:`${banks.length} accounts`, color:'text-blue-700',   bg:'bg-blue-50 border-blue-200',   path:'/bank-accounts' },
    { icon:'📈', label:'Investments',    value:fmt(totalInvVal),   sub:`${invPnl>=0?'+':''}${fmt(invPnl)} P&L`, color:invPnl>=0?'text-emerald-700':'text-red-600', bg:'bg-emerald-50 border-emerald-200', path:'/stocks' },
    { icon:'🥇', label:'Commodities',   value:fmt(totalComVal),   sub:`${coms.length} items`, color:'text-amber-700',  bg:'bg-amber-50 border-amber-200',   path:'/stocks' },
    { icon:'🏠', label:'Real Estate',   value:fmt(totalPropVal),  sub:`${props.length} propert${props.length!==1?'ies':'y'}`, color:'text-violet-700', bg:'bg-violet-50 border-violet-200', path:'/real-estate' },
    { icon:'⚖️', label:'Liabilities',   value:fmt(totalBorrowed), sub:`${activeLoans.length} active loans`, color:'text-red-700', bg:'bg-red-50 border-red-200', path:'/liabilities' },
    { icon:'🛡️', label:'Policies',      value:String(activePolicies), sub:`${expiringSoon} expiring soon`, color:'text-slate-700', bg:'bg-slate-50 border-slate-200', path:'/policies' },
  ];

  const isEmpty = totalWealth===0 && banks.length===0 && invs.length===0 && props.length===0 && policies.length===0;

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />

      {toast && (
        <div className="fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg bg-slate-800 text-white animate-fade-in">{toast}</div>
      )}

      {/* Module header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5 text-blue-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-blue-200">Home</Link><span>›</span>
                <span className="text-blue-200">Dashboard</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                {greeting}, {user?.name?.split(' ')[0]} 👋
              </h1>
              <p className="text-blue-200/60 text-sm mt-0.5">Your complete financial overview</p>
            </div>
            <button onClick={()=>setShowProfile(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-all flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-blue-500/50 flex items-center justify-center font-bold text-xs">{user?.name?.charAt(0).toUpperCase()}</div>
              My Profile
            </button>
          </div>
          <ModuleTabs />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Policy expiry banner */}
        {notifications.length>0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">⏰</span>
              <div>
                <div className="font-semibold text-amber-800 text-sm mb-1">
                  {notifications.length} polic{notifications.length>1?'ies':'y'} expiring soon
                </div>
                <div className="flex flex-wrap gap-2">
                  {notifications.map((n:any)=>(
                    <Link key={n.id} to="/policies"
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
                        ${n.daysToExpiry<=0?'bg-red-100 text-red-700 border-red-300':'bg-amber-100 text-amber-700 border-amber-300'}`}>
                      {n.policyName} · {n.daysToExpiry<=0?'Expired':`${n.daysToExpiry}d left`}
                    </Link>
                  ))}
                </div>
              </div>
              <Link to="/policies" className="ml-auto text-xs text-amber-700 font-semibold hover:underline whitespace-nowrap flex-shrink-0">View all →</Link>
            </div>
          </div>
        )}

        {/* ── Net worth banner ── */}
        {loading ? (
          <div className="bg-white rounded-2xl h-28 animate-pulse border border-slate-200"/>
        ) : (
          <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-5 shadow-lg">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-blue-300/60 text-xs font-medium tracking-widest uppercase mb-1">Total Net Worth</div>
                <div className="font-display text-4xl sm:text-5xl font-bold text-white">{fmt(totalWealth)}</div>
                <div className="text-blue-200/50 text-xs mt-1">Banks + Investments + Commodities + Real Estate − Liabilities</div>
              </div>
              <div className="flex flex-wrap gap-5">
                {[
                  {label:'Assets',     value:fmt(totalBanks+totalInvVal+totalComVal+totalPropVal), color:'text-emerald-300'},
                  {label:'Liabilities',value:fmt(totalBorrowed),                                  color:'text-red-300'},
                  {label:'Net',        value:fmt(totalWealth),                                    color:'text-white font-bold'},
                ].map(s=>(
                  <div key={s.label} className="text-right">
                    <div className="text-blue-200/50 text-xs mb-0.5">{s.label}</div>
                    <div className={`font-display text-base font-semibold ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 6 Module KPI cards ── */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {MODULE_CARDS.map(card=>(
              <Link key={card.label} to={card.path}
                className={`bg-white rounded-2xl border p-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer ${card.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-500 leading-tight">{card.label}</span>
                  <span className="text-xl">{card.icon}</span>
                </div>
                <div className={`font-display text-lg font-bold ${card.color} leading-tight`}>{card.value}</div>
                <div className="text-slate-400 text-xs mt-1 truncate">{card.sub}</div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Charts row ── */}
        {!loading && totalWealth>0 && (
          <div className="grid lg:grid-cols-3 gap-5">

            {/* Donut — wealth allocation */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>🎯</span> Wealth Allocation</h3>
              <div className="flex items-center gap-3">
                <DonutChart segments={donutSegments} total={totalWealth}
                  center={fmtL(totalWealth)} sub="Net Worth"/>
                <div className="space-y-2.5 flex-1">
                  {donutSegments.map(s=>(
                    <div key={s.label}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:s.color}}/>
                        <span className="text-xs text-slate-600">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MiniBar value={s.value} max={totalWealth} color="" />
                        <span className="text-xs font-bold text-slate-700 w-10 text-right">{totalWealth>0?((s.value/totalWealth)*100).toFixed(0):0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Asset vs Liability bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>⚖️</span> Assets vs Liabilities</h3>
              <div className="space-y-3">
                {[
                  {label:'Banks',        value:totalBanks,    color:'bg-blue-500',   max:maxAsset},
                  {label:'Investments',  value:totalInvVal,   color:'bg-emerald-500',max:maxAsset},
                  {label:'Commodities',  value:totalComVal,   color:'bg-amber-500',  max:maxAsset},
                  {label:'Real Estate',  value:totalPropVal,  color:'bg-violet-500', max:maxAsset},
                  {label:'Borrowed',     value:totalBorrowed, color:'bg-red-400',    max:maxAsset},
                  {label:'Lent Out',     value:totalLent,     color:'bg-teal-400',   max:maxAsset},
                ].filter(b=>b.value>0).map(bar=>(
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">{bar.label}</span>
                      <span className="font-semibold text-slate-700">{fmtL(bar.value)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${bar.color}`}
                           style={{width:`${Math.min((bar.value/bar.max)*100,100)}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wealth trend sparkline */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-1 flex items-center gap-2"><span>📊</span> Wealth Trend</h3>
              <p className="text-slate-400 text-xs mb-4">Projected 12-month growth</p>
              <div className="flex items-end gap-4 mb-4">
                <div>
                  <div className="text-xs text-slate-400 mb-0.5">Current</div>
                  <div className="font-display text-xl font-bold text-slate-800">{fmt(totalWealth)}</div>
                  <div className="text-emerald-600 text-xs font-semibold">↑ Growing</div>
                </div>
                <div className="flex-1">
                  <Sparkline values={sparkData} color="#3b82f6"/>
                </div>
              </div>
              {/* Module breakdown */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                {[
                  {label:'Investment P&L', value:`${invPnl>=0?'+':''}${fmt(invPnl)}`, color:invPnl>=0?'text-emerald-600':'text-red-500'},
                  {label:'Lent out (owed to you)', value:fmt(totalLent), color:'text-teal-600'},
                  {label:'Net equity (RE − loans)', value:fmt(totalPropVal-totalBorrowed), color:totalPropVal>totalBorrowed?'text-violet-600':'text-red-500'},
                ].map(r=>(
                  <div key={r.label} className="flex justify-between">
                    <span className="text-xs text-slate-400">{r.label}</span>
                    <span className={`text-xs font-bold ${r.color}`}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Top holdings across all modules ── */}
        {!loading && totalWealth>0 && (
          <div className="grid lg:grid-cols-2 gap-5">

            {/* Top 6 holdings */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>🏆</span> Top Holdings</h3>
              <div className="space-y-2">
                {[
                  ...banks.map(a=>({name:a.bank_name, type:'Bank', value:Number(a.balance), icon:'🏦', path:'/bank-accounts', color:'text-blue-600'})),
                  ...invs.map(i=>({name:i.platform_name, type:'Investment', value:Number(i.current_value), icon:'📈', path:'/stocks', color:'text-emerald-600'})),
                  ...coms.map(c=>({name:c.name, type:'Commodity', value:Number(c.current_value), icon:'🥇', path:'/stocks', color:'text-amber-600'})),
                  ...props.map(p=>({name:p.property_name, type:'Property', value:Number(p.current_market_value||0), icon:'🏠', path:'/real-estate', color:'text-violet-600'})),
                ].sort((a,b)=>b.value-a.value).slice(0,6).map((item,i)=>(
                  <Link key={i} to={item.path}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-base flex-shrink-0">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 text-sm truncate">{item.name}</div>
                      <div className="text-slate-400 text-xs">{item.type}</div>
                    </div>
                    <div className={`font-display font-bold text-sm ${item.color}`}>{fmt(item.value)}</div>
                  </Link>
                ))}
                {banks.length===0&&invs.length===0&&props.length===0&&(
                  <div className="text-center py-6 text-slate-400 text-sm">Add assets to see your top holdings</div>
                )}
              </div>
            </div>

            {/* Liabilities + Policies summary */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>📋</span> Liabilities & Policies</h3>
              <div className="space-y-3">
                {/* Active loans */}
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Active Loans</div>
                  {activeLoans.length===0 ? (
                    <div className="text-xs text-slate-400 py-2">No active loans · <Link to="/liabilities" className="text-blue-600 hover:underline">Add →</Link></div>
                  ) : activeLoans.slice(0,3).map((l:any,i:number)=>(
                    <Link key={l.id} to="/liabilities"
                      className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-1 rounded transition-colors">
                      <div>
                        <div className="text-sm font-semibold text-slate-800 truncate max-w-[180px]">{l.label}</div>
                        <div className="text-xs text-slate-400">{l.counterparty_name}</div>
                      </div>
                      <div className="font-display font-bold text-red-600 text-sm">{fmt(l.outstanding_amount)}</div>
                    </Link>
                  ))}
                  {activeLoans.length>3&&<Link to="/liabilities" className="text-xs text-blue-600 hover:underline">+{activeLoans.length-3} more →</Link>}
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Insurance Policies</div>
                  {policies.length===0 ? (
                    <div className="text-xs text-slate-400 py-2">No policies · <Link to="/policies" className="text-blue-600 hover:underline">Add →</Link></div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {label:'Active',       count:policies.filter((p:any)=>p.computed_status==='active').length, color:'text-emerald-600', bg:'bg-emerald-50'},
                        {label:'Expiring',     count:policies.filter((p:any)=>p.computed_status==='expiring_soon').length, color:'text-amber-600', bg:'bg-amber-50'},
                        {label:'Expired',      count:policies.filter((p:any)=>p.computed_status==='expired').length, color:'text-red-600', bg:'bg-red-50'},
                      ].map(s=>(
                        <Link key={s.label} to="/policies"
                          className={`${s.bg} rounded-xl p-2.5 text-center hover:opacity-80 transition-opacity`}>
                          <div className={`font-display text-xl font-bold ${s.color}`}>{s.count}</div>
                          <div className="text-slate-500 text-[10px] font-medium mt-0.5">{s.label}</div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Real estate row ── */}
        {!loading && props.length>0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2"><span>🏠</span> Real Estate Portfolio</h3>
              <Link to="/real-estate" className="text-xs text-violet-600 hover:underline font-medium">View all →</Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {props.slice(0,4).map((p:any,i:number)=>(
                <Link key={p.id} to="/real-estate"
                  className="p-3 rounded-xl bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors">
                  <div className="font-semibold text-slate-800 text-sm truncate">{p.property_name}</div>
                  <div className="text-violet-500 text-xs mt-0.5">{p.district}, {p.state}</div>
                  <div className="font-display font-bold text-violet-700 text-base mt-1">
                    {p.current_market_value ? fmt(Number(p.current_market_value)) : '—'}
                  </div>
                  {p.total_area && <div className="text-slate-400 text-xs">{p.total_area} {p.area_unit}</div>}
                </Link>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between">
              <span className="text-xs text-slate-400">{props.length} propert{props.length!==1?'ies':'y'}</span>
              <span className="font-display font-bold text-violet-700 text-sm">{fmt(totalPropVal)}</span>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && isEmpty && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="font-display text-2xl font-bold text-slate-800 mb-3">Your Vault is Empty</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto text-sm leading-relaxed">
              Start by adding your bank accounts, investments, policies or real estate. Your consolidated net worth, charts and analytics will appear here.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {[
                {icon:'🏦',label:'Bank Account',path:'/bank-accounts'},
                {icon:'📈',label:'Investment',path:'/stocks'},
                {icon:'🏠',label:'Property',path:'/real-estate'},
                {icon:'🛡️',label:'Policy',path:'/policies'},
                {icon:'⚖️',label:'Liability',path:'/liabilities'},
              ].map(item=>(
                <Link key={item.path} to={item.path}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                  <span>{item.icon}</span> Add {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        {!loading && !isEmpty && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><span>⚡</span> Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {icon:'🏦', label:'Add Bank A/C',    path:'/bank-accounts', color:'hover:bg-blue-100 border-blue-200 bg-blue-50'},
                {icon:'📈', label:'Add Investment',  path:'/stocks',        color:'hover:bg-emerald-100 border-emerald-200 bg-emerald-50'},
                {icon:'🥇', label:'Add Commodity',  path:'/stocks',        color:'hover:bg-amber-100 border-amber-200 bg-amber-50'},
                {icon:'🏠', label:'Add Property',   path:'/real-estate',   color:'hover:bg-violet-100 border-violet-200 bg-violet-50'},
                {icon:'⚖️', label:'Add Liability',  path:'/liabilities',   color:'hover:bg-indigo-100 border-indigo-200 bg-indigo-50'},
                {icon:'🛡️', label:'Add Policy',     path:'/policies',      color:'hover:bg-slate-100 border-slate-200 bg-slate-50'},
              ].map(a=>(
                <Link key={a.label} to={a.path}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${a.color}`}>
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-slate-700 text-xs font-semibold text-center leading-tight">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {showProfile && <ProfilePage onClose={()=>{ setShowProfile(false); load(); }}/>}
    </div>
  );
};

export default DashboardPage;
