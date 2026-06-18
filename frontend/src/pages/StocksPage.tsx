import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { vaultApi, commoditiesApi } from '../services/api';
import Navbar from '../components/Navbar';
import ModuleTabs from '../components/ModuleTabs';
import { FormInput, FormSelect, FormTextarea, FormFile } from '../components/FormInput';

// ── Constants at MODULE LEVEL ─────────────────────────────────────
const INV_TYPES: [string,string][] = [
  ['stocks','Stocks'],['mutual_fund','Mutual Fund'],['etf','ETF'],
  ['bonds','Bonds'],['crypto','Crypto'],['other','Other'],
];
const IT_LABELS = Object.fromEntries(INV_TYPES);
const IT_ICONS: Record<string,string> = {
  stocks:'📈',mutual_fund:'🏛️',etf:'⚡',bonds:'📜',crypto:'₿',other:'💹',
};
const INV_GRADIENTS = [
  'from-emerald-700 to-emerald-500','from-teal-700 to-teal-500',
  'from-cyan-700 to-cyan-500','from-green-700 to-green-500',
  'from-lime-700 to-lime-500','from-blue-700 to-blue-500',
];
const COM_TYPES: [string,string][] = [
  ['gold_coins','Gold Coins'],['gold_bars','Gold Bars'],['gold_jewellery','Gold Jewellery'],
  ['silver_coins','Silver Coins'],['silver_bars','Silver Bars'],['silver_jewellery','Silver Jewellery'],
  ['platinum','Platinum'],['diamond','Diamond'],['gemstones','Gemstones'],
  ['physical_bonds','Physical Bonds'],['savings_certificate','Savings Certificate'],
  ['nsc','NSC'],['kisan_vikas_patra','Kisan Vikas Patra'],['other','Other'],
];
const COM_LABELS = Object.fromEntries(COM_TYPES);
const COM_ICONS: Record<string,string> = {
  gold_coins:'🪙',gold_bars:'🏅',gold_jewellery:'💍',silver_coins:'🪙',
  silver_bars:'🏅',silver_jewellery:'💎',platinum:'✨',diamond:'💎',
  gemstones:'💎',physical_bonds:'📜',savings_certificate:'📋',
  nsc:'📋',kisan_vikas_patra:'📋',other:'📦',
};
const WEIGHT_UNITS: [string,string][] = [
  ['grams','Grams'],['kilograms','Kilograms'],['tolas','Tolas'],
  ['ounces','Ounces'],['milligrams','Milligrams'],
];
const COM_GRADIENTS = [
  'from-yellow-700 to-yellow-500','from-amber-700 to-amber-500',
  'from-orange-700 to-orange-500','from-rose-700 to-rose-500',
  'from-pink-700 to-pink-500','from-purple-700 to-purple-500',
];

const fmt = (n:number) => `₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const EMPTY_INV: Record<string,string> = {
  platform_name:'',investment_type:'stocks',account_id_masked:'',
  instrument_name:'',current_value:'',invested_amount:'',units:'',avg_buy_price:'',notes:'',
};
const EMPTY_COM: Record<string,string> = {
  commodityType:'gold_jewellery',name:'',description:'',weight:'',weightUnit:'grams',
  purity:'',quantity:'',purchasePrice:'',currentValue:'',purchaseDate:'',
  storageLocation:'',insurancePolicyNo:'',certificateNumber:'',
  maturityDate:'',faceValue:'',interestRate:'',notes:'',
};

interface Investment {
  id:string;platform_name:string;investment_type:string;account_id_masked:string|null;
  instrument_name:string|null;current_value:number;invested_amount:number|null;
  units:number|null;avg_buy_price:number|null;currency:string;notes:string|null;
  document_name:string|null;
}
interface Commodity {
  id:string;commodity_type:string;name:string;description:string|null;
  weight:number|null;weight_unit:string|null;purity:string|null;quantity:number|null;
  purchase_price:number|null;current_value:number;purchase_date:string|null;
  storage_location:string|null;insurance_policy_no:string|null;
  certificate_number:string|null;maturity_date:string|null;
  face_value:number|null;interest_rate:number|null;
  document_url:string|null;document_name:string|null;notes:string|null;
}

type PageTab = 'investments'|'commodities';
type ModalType = 'inv'|'com'|null;

// ── Component ────────────────────────────────────────────────────
const StocksPage: React.FC = () => {
  const [pageTab, setPageTab]     = useState<PageTab>('investments');
  const [invs, setInvs]           = useState<Investment[]>([]);
  const [coms, setComs]           = useState<Commodity[]>([]);
  const [invFilter, setInvFilter] = useState('all');
  const [comFilter, setComFilter] = useState('all');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [modal, setModal]         = useState<ModalType>(null);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [invForm, setInvForm]     = useState<Record<string,string>>({...EMPTY_INV});
  const [comForm, setComForm]     = useState<Record<string,string>>({...EMPTY_COM});
  const [formError, setFormError] = useState('');
  const [toast, setToast]         = useState<{type:'success'|'error';msg:string}|null>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [docFile, setDocFile]     = useState<File|null>(null);

  const toast$ = (type:'success'|'error', msg:string) => {
    setToast({type,msg}); setTimeout(()=>setToast(null),3000);
  };
  const setI = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setInvForm(f=>({...f,[k]:e.target.value}));
  const setC = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setComForm(f=>({...f,[k]:e.target.value}));

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [ir,cr] = await Promise.all([vaultApi.getInvestments(), commoditiesApi.getAll()]);
      setInvs(ir.data.data.investments);
      setComs(cr.data.data.commodities);
    } catch { toast$('error','Failed to load.'); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  // ── Investment stats ──────────────────────────────────────────
  const filteredInvs  = invFilter==='all' ? invs : invs.filter(i=>i.investment_type===invFilter);
  const totalValue    = invs.reduce((s,i)=>s+Number(i.current_value),0);
  const totalInvested = invs.reduce((s,i)=>s+Number(i.invested_amount||i.current_value),0);
  const pnl     = totalValue - totalInvested;
  const pnlPct  = totalInvested>0 ? ((pnl/totalInvested)*100).toFixed(1) : '0.0';

  // ── Commodity stats ───────────────────────────────────────────
  const filteredComs = comFilter==='all' ? coms : coms.filter(c=>c.commodity_type===comFilter);
  const totalComValue = coms.reduce((s,c)=>s+Number(c.current_value),0);
  const isPhysical = (t:string) => ['gold_coins','gold_bars','gold_jewellery','silver_coins','silver_bars','silver_jewellery','platinum','diamond','gemstones'].includes(t);
  const isBond     = (t:string) => ['physical_bonds','savings_certificate','nsc','kisan_vikas_patra'].includes(t);

  // ── Investment modal ──────────────────────────────────────────
  const openAddInv = () => {
    setInvForm({...EMPTY_INV}); setEditingId(null); setFormError(''); setDocFile(null); setModal('inv');
  };
  const openEditInv = (inv:Investment) => {
    setInvForm({
      platform_name:inv.platform_name, investment_type:inv.investment_type,
      account_id_masked:inv.account_id_masked||'', instrument_name:inv.instrument_name||'',
      current_value:String(inv.current_value),
      invested_amount:inv.invested_amount!=null?String(inv.invested_amount):'',
      units:inv.units!=null?String(inv.units):'',
      avg_buy_price:inv.avg_buy_price!=null?String(inv.avg_buy_price):'',
      notes:inv.notes||'',
    });
    setEditingId(inv.id); setFormError(''); setDocFile(null); setModal('inv');
  };
  const handleSaveInv = async () => {
    if (!invForm.platform_name.trim()) { setFormError('Platform name is required.'); return; }
    if (!invForm.current_value)        { setFormError('Current value is required.'); return; }
    setSaving(true); setFormError('');
    try {
      const p: any = {
        platformName:invForm.platform_name.trim(), investmentType:invForm.investment_type,
        accountIdMasked:invForm.account_id_masked||undefined,
        instrumentName:invForm.instrument_name||undefined,
        currentValue:parseFloat(invForm.current_value),
        investedAmount:invForm.invested_amount?parseFloat(invForm.invested_amount):undefined,
        units:invForm.units?parseFloat(invForm.units):undefined,
        avgBuyPrice:invForm.avg_buy_price?parseFloat(invForm.avg_buy_price):undefined,
        notes:invForm.notes||undefined,
      };
      if(docFile){ p.documentName=docFile.name; p.documentUrl=`uploads/${docFile.name}`; }
      if(editingId){ await vaultApi.updateInvestment(editingId,p); toast$('success','Updated.'); }
      else         { await vaultApi.addInvestment(p); toast$('success','Investment added.'); }
      setModal(null); await load();
    } catch(e:any){ setFormError(e.response?.data?.message||'Failed.'); }
    finally{ setSaving(false); }
  };

  // ── Commodity modal ───────────────────────────────────────────
  const openAddCom = () => {
    setComForm({...EMPTY_COM}); setEditingId(null); setFormError(''); setDocFile(null); setModal('com');
  };
  const openEditCom = (c:Commodity) => {
    setComForm({
      commodityType:c.commodity_type, name:c.name, description:c.description||'',
      weight:c.weight!=null?String(c.weight):'', weightUnit:c.weight_unit||'grams',
      purity:c.purity||'', quantity:c.quantity!=null?String(c.quantity):'',
      purchasePrice:c.purchase_price!=null?String(c.purchase_price):'',
      currentValue:String(c.current_value),
      purchaseDate:c.purchase_date?c.purchase_date.split('T')[0]:'',
      storageLocation:c.storage_location||'', insurancePolicyNo:c.insurance_policy_no||'',
      certificateNumber:c.certificate_number||'',
      maturityDate:c.maturity_date?c.maturity_date.split('T')[0]:'',
      faceValue:c.face_value!=null?String(c.face_value):'',
      interestRate:c.interest_rate!=null?String(c.interest_rate):'',
      notes:c.notes||'',
    });
    setEditingId(c.id); setFormError(''); setDocFile(null); setModal('com');
  };
  const handleSaveCom = async () => {
    if (!comForm.name.trim())        { setFormError('Name is required.'); return; }
    if (!comForm.currentValue)       { setFormError('Current value is required.'); return; }
    setSaving(true); setFormError('');
    try {
      const p: any = {
        commodityType:comForm.commodityType, name:comForm.name.trim(),
        description:comForm.description||undefined, weight:comForm.weight?parseFloat(comForm.weight):undefined,
        weightUnit:comForm.weightUnit||undefined, purity:comForm.purity||undefined,
        quantity:comForm.quantity?parseInt(comForm.quantity):undefined,
        purchasePrice:comForm.purchasePrice?parseFloat(comForm.purchasePrice):undefined,
        currentValue:parseFloat(comForm.currentValue),
        purchaseDate:comForm.purchaseDate||undefined,
        storageLocation:comForm.storageLocation||undefined,
        insurancePolicyNo:comForm.insurancePolicyNo||undefined,
        certificateNumber:comForm.certificateNumber||undefined,
        maturityDate:comForm.maturityDate||undefined,
        faceValue:comForm.faceValue?parseFloat(comForm.faceValue):undefined,
        interestRate:comForm.interestRate?parseFloat(comForm.interestRate):undefined,
        notes:comForm.notes||undefined,
      };
      if(docFile){ p.documentName=docFile.name; p.documentUrl=`uploads/${docFile.name}`; }
      if(editingId){ await commoditiesApi.update(editingId,p); toast$('success','Updated.'); }
      else         { await commoditiesApi.add(p); toast$('success','Commodity added.'); }
      setModal(null); await load();
    } catch(e:any){ setFormError(e.response?.data?.message||'Failed.'); }
    finally{ setSaving(false); }
  };

  const handleDeleteInv = async (id:string) => {
    if (!confirm('Remove?')) return;
    try{ await vaultApi.deleteInvestment(id); toast$('success','Removed.'); load(); }
    catch{ toast$('error','Failed.'); }
  };
  const handleDeleteCom = async (id:string) => {
    if (!confirm('Remove?')) return;
    try{ await commoditiesApi.remove(id); toast$('success','Removed.'); load(); }
    catch{ toast$('error','Failed.'); }
  };

  const isMF  = invForm.investment_type==='mutual_fund';
  const isPhysCom = isPhysical(comForm.commodityType);
  const isBondCom = isBond(comForm.commodityType);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast&&(
        <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg animate-fade-in
          ${toast.type==='success'?'bg-emerald-600':'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Module header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5 text-emerald-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-emerald-200">Home</Link><span>›</span>
                <Link to="/dashboard" className="hover:text-emerald-200">Dashboard</Link><span>›</span>
                <span className="text-emerald-200">Investments & Commodities</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Stocks, Investments & Commodities</h1>
              <p className="text-emerald-200/60 text-sm mt-0.5">
                {(invs.length+coms.length)>0
                  ? `${invs.length} platform${invs.length!==1?'s':''} · ${coms.length} commodit${coms.length!==1?'ies':'y'} · Total ${fmt(totalValue+totalComValue)}`
                  : 'Track your investments, gold and physical assets'}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={openAddInv}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white text-emerald-900 font-bold text-sm hover:bg-emerald-50 transition-colors shadow-sm">
                + Investment
              </button>
              <button onClick={openAddCom}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-400 text-yellow-900 font-bold text-sm hover:bg-yellow-300 transition-colors shadow-sm">
                + Commodity
              </button>
            </div>
          </div>
          <ModuleTabs />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {label:'Investment Value',  value:fmt(totalValue),    icon:'📈', sub:`${invs.length} platforms`,     color:'text-emerald-700'},
            {label:'Invested Amount',   value:fmt(totalInvested), icon:'💳', sub:'Cost basis',                   color:'text-slate-800'},
            {label:'Investment P&L',    value:`${pnl>=0?'+':''}${fmt(pnl)}`, icon:pnl>=0?'📊':'📉',
             sub:`${pnl>=0?'+':''}${pnlPct}%`,                                                                    color:pnl>=0?'text-emerald-700':'text-red-600'},
            {label:'Commodities Value', value:fmt(totalComValue), icon:'🥇', sub:`${coms.length} item${coms.length!==1?'s':''}`, color:'text-amber-700'},
          ].map(s=>(
            <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <div className={`font-display text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Page tab switcher */}
        <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm w-fit">
          <div className="flex gap-1">
            {[
              {id:'investments' as PageTab, label:'📈 Investments', count:invs.length},
              {id:'commodities' as PageTab, label:'🥇 Commodities', count:coms.length},
            ].map(t=>(
              <button key={t.id} onClick={()=>setPageTab(t.id)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2
                  ${pageTab===t.id?'bg-emerald-600 text-white':'text-slate-500 hover:bg-slate-100'}`}>
                {t.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${pageTab===t.id?'bg-white/20':'bg-slate-100 text-slate-400'}`}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── INVESTMENTS TAB ── */}
        {pageTab==='investments' && (
          <>
            {/* Type filter */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
              <div className="flex gap-1 overflow-x-auto">
                {[['all','All'],...INV_TYPES].map(([id,label])=>(
                  <button key={id} onClick={()=>setInvFilter(id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5
                      ${invFilter===id?'bg-emerald-600 text-white':'text-slate-500 hover:bg-slate-100'}`}>
                    {id!=='all'&&<span>{IT_ICONS[id]}</span>}
                    {label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${invFilter===id?'bg-white/20':'bg-slate-100 text-slate-400'}`}>
                      {id==='all'?invs.length:invs.filter(i=>i.investment_type===id).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="h-44 rounded-2xl bg-slate-200 animate-pulse"/>)}</div>
            ) : filteredInvs.length===0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">📈</div>
                <h3 className="font-semibold text-slate-700 text-lg mb-2">{invFilter==='all'?'No investments yet':`No ${IT_LABELS[invFilter]} investments`}</h3>
                <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto">Add Zerodha, Groww, mutual funds, ETFs and other platforms.</p>
                <button onClick={openAddInv} className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">+ Add Investment</button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredInvs.map((inv,i)=>{
                  const invested=inv.invested_amount||inv.current_value;
                  const g=inv.current_value-invested;
                  const gp=invested>0?((g/invested)*100).toFixed(1):'0.0';
                  const isExp=expandedId===inv.id;
                  return (
                    <div key={inv.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                      <div className={`bg-gradient-to-r ${INV_GRADIENTS[i%INV_GRADIENTS.length]} p-5 text-white relative overflow-hidden`}>
                        <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10"/>
                        <div className="relative z-10 flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1"><span className="text-lg">{IT_ICONS[inv.investment_type]}</span><span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">{IT_LABELS[inv.investment_type]}</span></div>
                            <div className="font-bold text-base">{inv.platform_name}</div>
                            {inv.instrument_name&&<div className="text-white/60 text-xs">{inv.instrument_name}</div>}
                            {inv.account_id_masked&&<div className="text-white/40 text-xs font-mono">{inv.account_id_masked}</div>}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>openEditInv(inv)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs">✏️</button>
                            <button onClick={()=>handleDeleteInv(inv.id)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-red-400/60 flex items-center justify-center text-xs">🗑️</button>
                          </div>
                        </div>
                        <div className="font-display text-2xl font-black mt-3">{fmt(inv.current_value)}</div>
                        {inv.invested_amount!=null&&<div className={`text-xs mt-1 font-semibold ${g>=0?'text-green-200':'text-red-200'}`}>{g>=0?'▲':'▼'} {fmt(Math.abs(g))} ({gp}%)</div>}
                      </div>
                      <div className="px-4 py-3">
                        {isExp&&(
                          <div className="space-y-1.5 mb-3 animate-fade-in">
                            {inv.invested_amount&&<div className="flex justify-between text-xs"><span className="text-slate-400">Invested</span><span className="font-medium">{fmt(inv.invested_amount)}</span></div>}
                            {inv.units&&<div className="flex justify-between text-xs"><span className="text-slate-400">Units</span><span className="font-mono font-medium">{Number(inv.units).toFixed(4)}</span></div>}
                            {inv.avg_buy_price&&<div className="flex justify-between text-xs"><span className="text-slate-400">Avg Price</span><span className="font-mono">₹{Number(inv.avg_buy_price).toFixed(2)}</span></div>}
                            {inv.document_name&&<div className="flex items-center gap-1 text-xs text-slate-400"><span>📎</span><span>{inv.document_name}</span></div>}
                            {inv.notes&&<div className="text-xs text-slate-400 italic">"{inv.notes}"</div>}
                          </div>
                        )}
                        <button onClick={()=>setExpandedId(isExp?null:inv.id)} className="text-xs text-emerald-600 hover:text-emerald-800 font-medium w-full text-left">
                          {isExp?'▲ Less':'▼ More details'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button onClick={openAddInv} className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-emerald-500 transition-all min-h-[180px] bg-white">
                  <span className="text-3xl">+</span><span className="text-sm font-medium">Add Investment</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ── COMMODITIES TAB ── */}
        {pageTab==='commodities' && (
          <>
            {/* Category filter */}
            <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
              <div className="flex gap-1 overflow-x-auto">
                {[['all','All',...COM_TYPES.slice(0,6).map(t=>t[0])].slice(0,1).concat([]).concat([]),...[['all','All'],...COM_TYPES]].slice(0,1).map(()=>null)}
                {[{id:'all',label:'All'},{id:'gold',label:'Gold'},{id:'silver',label:'Silver'},{id:'gems',label:'Gems'},{id:'bonds',label:'Bonds'}].map(f=>(
                  <button key={f.id} onClick={()=>setComFilter(f.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0
                      ${comFilter===f.id?'bg-yellow-500 text-white':'text-slate-500 hover:bg-slate-100'}`}>
                    {f.id==='all'?'🥇':f.id==='gold'?'💍':f.id==='silver'?'🪙':f.id==='gems'?'💎':'📜'} {f.label}
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${comFilter===f.id?'bg-white/20':'bg-slate-100 text-slate-400'}`}>
                      {f.id==='all'?coms.length
                        :f.id==='gold'?coms.filter(c=>c.commodity_type.startsWith('gold')).length
                        :f.id==='silver'?coms.filter(c=>c.commodity_type.startsWith('silver')).length
                        :f.id==='gems'?coms.filter(c=>['platinum','diamond','gemstones'].includes(c.commodity_type)).length
                        :coms.filter(c=>['physical_bonds','savings_certificate','nsc','kisan_vikas_patra'].includes(c.commodity_type)).length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2].map(i=><div key={i} className="h-44 rounded-2xl bg-slate-200 animate-pulse"/>)}</div>
            ) : filteredComs.length===0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
                <div className="text-5xl mb-4">🥇</div>
                <h3 className="font-semibold text-slate-700 text-lg mb-2">No commodities added yet</h3>
                <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto leading-relaxed">
                  Add your gold jewellery, silver bars, physical bonds, NSC certificates and other physical assets.
                </p>
                <button onClick={openAddCom} className="px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold">+ Add Commodity</button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredComs.filter(c=>{
                  if (comFilter==='all') return true;
                  if (comFilter==='gold') return c.commodity_type.startsWith('gold');
                  if (comFilter==='silver') return c.commodity_type.startsWith('silver');
                  if (comFilter==='gems') return ['platinum','diamond','gemstones'].includes(c.commodity_type);
                  if (comFilter==='bonds') return ['physical_bonds','savings_certificate','nsc','kisan_vikas_patra'].includes(c.commodity_type);
                  return true;
                }).map((c,i)=>{
                  const isExp=expandedId===c.id;
                  const gain = c.purchase_price ? c.current_value-c.purchase_price : 0;
                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                      <div className={`bg-gradient-to-r ${COM_GRADIENTS[i%COM_GRADIENTS.length]} p-5 text-white relative overflow-hidden`}>
                        <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10"/>
                        <div className="relative z-10 flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1"><span className="text-lg">{COM_ICONS[c.commodity_type]||'📦'}</span><span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">{COM_LABELS[c.commodity_type]||c.commodity_type}</span></div>
                            <div className="font-bold text-base leading-tight">{c.name}</div>
                            {c.purity&&<div className="text-white/60 text-xs">Purity: {c.purity}</div>}
                            {c.weight&&c.weight_unit&&<div className="text-white/60 text-xs">{c.weight} {WEIGHT_UNITS.find(u=>u[0]===c.weight_unit)?.[1]||c.weight_unit}{c.quantity?` · ${c.quantity} pcs`:''}</div>}
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={()=>openEditCom(c)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs">✏️</button>
                            <button onClick={()=>handleDeleteCom(c.id)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-red-400/60 flex items-center justify-center text-xs">🗑️</button>
                          </div>
                        </div>
                        <div className="font-display text-2xl font-black mt-3">{fmt(c.current_value)}</div>
                        {c.purchase_price!=null&&<div className={`text-xs mt-1 font-semibold ${gain>=0?'text-green-200':'text-red-200'}`}>{gain>=0?'▲':'▼'} {fmt(Math.abs(gain))}</div>}
                      </div>
                      <div className="px-4 py-3">
                        {isExp&&(
                          <div className="space-y-1.5 mb-3 animate-fade-in">
                            {c.storage_location&&<div className="flex justify-between text-xs"><span className="text-slate-400">Storage</span><span className="font-medium">{c.storage_location}</span></div>}
                            {c.purchase_date&&<div className="flex justify-between text-xs"><span className="text-slate-400">Purchased</span><span className="font-medium">{new Date(c.purchase_date).toLocaleDateString('en-IN')}</span></div>}
                            {c.certificate_number&&<div className="flex justify-between text-xs"><span className="text-slate-400">Cert. No.</span><span className="font-mono font-medium">{c.certificate_number}</span></div>}
                            {c.maturity_date&&<div className="flex justify-between text-xs"><span className="text-slate-400">Matures</span><span className="font-medium">{new Date(c.maturity_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span></div>}
                            {c.face_value&&<div className="flex justify-between text-xs"><span className="text-slate-400">Face Value</span><span className="font-medium">{fmt(c.face_value)}</span></div>}
                            {c.document_name&&<div className="flex items-center gap-1 text-xs text-slate-400"><span>📎</span><span>{c.document_name}</span></div>}
                            {c.notes&&<div className="text-xs text-slate-400 italic">"{c.notes}"</div>}
                          </div>
                        )}
                        <button onClick={()=>setExpandedId(isExp?null:c.id)} className="text-xs text-amber-600 hover:text-amber-800 font-medium w-full text-left">
                          {isExp?'▲ Less':'▼ More details'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button onClick={openAddCom} className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-yellow-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-yellow-600 transition-all min-h-[180px] bg-white">
                  <span className="text-3xl">+</span><span className="text-sm font-medium">Add Commodity</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── INVESTMENT MODAL ── */}
      {modal==='inv' && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div><div className="text-white font-semibold">📈 {editingId?'Edit':'Add'} Investment</div><div className="text-emerald-200/70 text-xs">Fields * required</div></div>
              <button onClick={()=>setModal(null)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {formError&&<div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">⚠️ {formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Platform Name *" value={invForm.platform_name} onChange={setI('platform_name')} placeholder="e.g. Zerodha, Groww" col={2} required accentColor="emerald"/>
                <FormSelect label="Investment Type" value={invForm.investment_type} onChange={setI('investment_type')} options={INV_TYPES} accentColor="emerald"/>
                <FormInput label="Current Value (₹) *" value={invForm.current_value} onChange={setI('current_value')} type="number" placeholder="e.g. 150000" required accentColor="emerald"/>
                <FormInput label="Invested Amount (₹)" value={invForm.invested_amount} onChange={setI('invested_amount')} type="number" placeholder="Original amount" accentColor="emerald"/>
                <FormInput label="Account / Folio No." value={invForm.account_id_masked} onChange={setI('account_id_masked')} placeholder="e.g. DP••••1234" accentColor="emerald"/>
                <FormInput label="Instrument / Fund Name" value={invForm.instrument_name} onChange={setI('instrument_name')} placeholder="e.g. Nifty 50 ETF" accentColor="emerald"/>
                {isMF&&<>
                  <FormInput label="Units" value={invForm.units} onChange={setI('units')} type="number" placeholder="e.g. 250.456" accentColor="emerald"/>
                  <FormInput label="Avg Buy Price (NAV)" value={invForm.avg_buy_price} onChange={setI('avg_buy_price')} type="number" placeholder="e.g. 45.25" accentColor="emerald"/>
                </>}
                <FormFile label="Document (Statement / Certificate)" col={2} fileName={docFile?.name} onChange={setDocFile} hint="Upload account statement, holdings certificate"/>
                <FormTextarea label="Notes" value={invForm.notes} onChange={setI('notes') as any} placeholder="Optional notes" col={2} accentColor="emerald" rows={2}/>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0 bg-white">
              <button onClick={()=>setModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveInv} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving?'Saving...':editingId?'Update':'Add Investment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMODITY MODAL ── */}
      {modal==='com' && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-yellow-800 to-yellow-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div><div className="text-white font-semibold">🥇 {editingId?'Edit':'Add'} Commodity</div><div className="text-yellow-200/70 text-xs">Gold, jewels, physical bonds & more</div></div>
              <button onClick={()=>setModal(null)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {formError&&<div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">⚠️ {formError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Commodity Type" value={comForm.commodityType} onChange={setC('commodityType')} options={COM_TYPES} col={2} accentColor="amber"/>
                <FormInput label="Name / Description *" value={comForm.name} onChange={setC('name')} placeholder="e.g. 22K Gold Bangles – 4 pcs" col={2} required accentColor="amber"/>
                <FormInput label="Current Value (₹) *" value={comForm.currentValue} onChange={setC('currentValue')} type="number" placeholder="Market value today" required accentColor="amber"/>
                <FormInput label="Purchase Price (₹)" value={comForm.purchasePrice} onChange={setC('purchasePrice')} type="number" placeholder="Amount paid" accentColor="amber"/>

                {isPhysCom && <>
                  <FormInput label="Weight" value={comForm.weight} onChange={setC('weight')} type="number" placeholder="e.g. 50" accentColor="amber"/>
                  <FormSelect label="Weight Unit" value={comForm.weightUnit} onChange={setC('weightUnit')} options={WEIGHT_UNITS} accentColor="amber"/>
                  <FormInput label="Purity" value={comForm.purity} onChange={setC('purity')} placeholder="e.g. 22K, 916, 999" accentColor="amber"/>
                  <FormInput label="Quantity (Pieces)" value={comForm.quantity} onChange={setC('quantity')} type="number" placeholder="e.g. 4" accentColor="amber"/>
                </>}

                {isBondCom && <>
                  <FormInput label="Certificate Number" value={comForm.certificateNumber} onChange={setC('certificateNumber')} placeholder="e.g. NSC123456" accentColor="amber"/>
                  <FormInput label="Face Value (₹)" value={comForm.faceValue} onChange={setC('faceValue')} type="number" placeholder="e.g. 10000" accentColor="amber"/>
                  <FormInput label="Interest Rate (% p.a.)" value={comForm.interestRate} onChange={setC('interestRate')} type="number" placeholder="e.g. 7.7" accentColor="amber"/>
                  <FormInput label="Maturity Date" value={comForm.maturityDate} onChange={setC('maturityDate')} type="date" accentColor="amber"/>
                </>}

                <FormInput label="Purchase Date" value={comForm.purchaseDate} onChange={setC('purchaseDate')} type="date" accentColor="amber"/>
                <FormInput label="Storage Location" value={comForm.storageLocation} onChange={setC('storageLocation')} placeholder="e.g. SBI Locker #42" accentColor="amber"/>
                <FormInput label="Insurance Policy No." value={comForm.insurancePolicyNo} onChange={setC('insurancePolicyNo')} placeholder="If insured" accentColor="amber" col={2}/>

                <FormFile label="Document (Invoice / Certificate)" col={2} fileName={docFile?.name} onChange={setDocFile} hint="Upload purchase invoice, valuation certificate"/>
                <FormTextarea label="Notes" value={comForm.notes} onChange={setC('notes') as any} placeholder="Optional notes" col={2} accentColor="amber" rows={2}/>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0 bg-white">
              <button onClick={()=>setModal(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveCom} disabled={saving} className="flex-1 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold disabled:opacity-50">
                {saving?'Saving...':editingId?'Update':'Add Commodity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StocksPage;
