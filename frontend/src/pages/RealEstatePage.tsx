import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { realEstateApi } from '../services/api';
import Navbar from '../components/Navbar';
import ModuleTabs from '../components/ModuleTabs';
import { FormInput, FormSelect, FormTextarea, FormFile } from '../components/FormInput';

// ── Constants at MODULE level ────────────────────────────────────
const PROPERTY_TYPES: [string,string][] = [
  ['agricultural_land','Agricultural Land'],['residential_plot','Residential Plot'],
  ['residential_house','Residential House'],['apartment','Apartment / Flat'],
  ['commercial_land','Commercial Land'],['commercial_building','Commercial Building'],
  ['industrial','Industrial Property'],['other','Other'],
];
const AREA_UNITS: [string,string][] = [
  ['sqft','Sq. Ft.'],['sqm','Sq. Metre'],['cents','Cents'],
  ['acres','Acres'],['grounds','Grounds'],['guntas','Guntas'],
  ['perches','Perches'],['hectares','Hectares'],
];
const TITLE_STATUS: [string,string][] = [
  ['clear','Clear Title'],['encumbered','Encumbered'],
  ['disputed','Disputed'],['under_verification','Under Verification'],['mortgaged','Mortgaged'],
];
const OCCUPANCY: [string,string][] = [
  ['own_use','Own Use'],['rented','Rented Out'],
  ['vacant','Vacant'],['under_construction','Under Construction'],
];
const TITLE_COLORS: Record<string,string> = {
  clear:'bg-emerald-100 text-emerald-700 border-emerald-300',
  encumbered:'bg-amber-100 text-amber-700 border-amber-300',
  disputed:'bg-red-100 text-red-700 border-red-300',
  under_verification:'bg-blue-100 text-blue-700 border-blue-300',
  mortgaged:'bg-orange-100 text-orange-700 border-orange-300',
};
const PT_ICONS: Record<string,string> = {
  agricultural_land:'🌾',residential_plot:'🏗️',residential_house:'🏠',
  apartment:'🏢',commercial_land:'🏭',commercial_building:'🏛️',industrial:'⚙️',other:'📍',
};
const GRADIENTS = [
  'from-amber-700 to-amber-500','from-orange-700 to-orange-500',
  'from-yellow-700 to-yellow-600','from-lime-700 to-lime-500',
  'from-teal-700 to-teal-500','from-stone-700 to-stone-500',
];
const MODAL_TABS = [
  {id:'basic',label:'📍 Location'},
  {id:'survey',label:'📋 Survey & Legal'},
  {id:'financial',label:'💰 Financial'},
  {id:'gps',label:'🗺️ GPS & Docs'},
];

const fmt = (n:number) => `₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const fmtDate = (d:string|null) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const fmtArea = (n:number, unit:string) =>
  `${Number(n).toLocaleString('en-IN',{maximumFractionDigits:4})} ${AREA_UNITS.find(u=>u[0]===unit)?.[1]||unit}`;

const EMPTY: Record<string,string> = {
  propertyName:'',propertyType:'residential_plot',doorFlatNumber:'',streetAddress:'',
  villageLocality:'',taluk:'',district:'',state:'Tamil Nadu',pincode:'',
  surveyNumber:'',subDivision:'',pattaNumber:'',khataNumber:'',wardBlock:'',
  totalArea:'',areaUnit:'sqft',udsArea:'',builtUpArea:'',
  registrationNumber:'',registeredDate:'',registrationOffice:'',documentNumber:'',
  purchasePrice:'',currentMarketValue:'',guidelineValue:'',stampDutyPaid:'',
  loanOutstanding:'',lenderName:'',titleStatus:'clear',ecUpdatedDate:'',taxPaidUpto:'',
  occupancyStatus:'own_use',monthlyRental:'',coOwners:'',nomineeName:'',
  gpsLat:'',gpsLng:'',gpsAddress:'',notes:'',
};

interface Property {
  id:string;property_name:string;property_type:string;door_flat_number:string|null;
  street_address:string|null;village_locality:string|null;taluk:string|null;
  district:string;state:string;pincode:string|null;survey_number:string|null;
  sub_division:string|null;patta_number:string|null;khata_number:string|null;
  ward_block:string|null;total_area:number;area_unit:string;area_in_sqft:number|null;
  uds_area:number|null;built_up_area:number|null;registration_number:string|null;
  registered_date:string|null;registration_office:string|null;document_number:string|null;
  purchase_price:number|null;current_market_value:number|null;guideline_value:number|null;
  stamp_duty_paid:number|null;loan_outstanding:number;lender_name:string|null;
  title_status:string;ec_updated_date:string|null;tax_paid_upto:string|null;
  occupancy_status:string|null;monthly_rental:number|null;co_owners:string|null;
  nominee_name:string|null;notes:string|null;gps_lat:number|null;gps_lng:number|null;
  gps_address:string|null;gps_image_url:string|null;document_url:string|null;document_name:string|null;
}

// ── Component ─────────────────────────────────────────────────────
const RealEstatePage: React.FC = () => {
  const [props, setProps]         = useState<Property[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm]           = useState<Record<string,string>>({...EMPTY});
  const [formError, setFormError] = useState('');
  const [toast, setToast]         = useState<{type:'success'|'error';msg:string}|null>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [modalTab, setModalTab]   = useState('basic');
  const [docFile, setDocFile]     = useState<File|null>(null);
  const [gpsFile, setGpsFile]     = useState<File|null>(null);

  const toast$ = (type:'success'|'error', msg:string) => {
    setToast({type,msg}); setTimeout(()=>setToast(null),3500);
  };
  const set = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f=>({...f,[k]:e.target.value}));

  const load = useCallback(async()=>{
    setLoading(true);
    try{ const r = await realEstateApi.getAll(); setProps(r.data.data.properties); }
    catch{ toast$('error','Failed to load.'); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  const totalValue = props.reduce((s,p)=>s+Number(p.current_market_value||0),0);
  const totalLoans = props.reduce((s,p)=>s+Number(p.loan_outstanding||0),0);

  const openAdd = () => {
    setForm({...EMPTY}); setEditingId(null); setFormError('');
    setDocFile(null); setGpsFile(null); setModalTab('basic'); setShowModal(true);
  };
  const openEdit = (p:Property) => {
    setForm({
      propertyName:p.property_name, propertyType:p.property_type,
      doorFlatNumber:p.door_flat_number||'', streetAddress:p.street_address||'',
      villageLocality:p.village_locality||'', taluk:p.taluk||'',
      district:p.district, state:p.state, pincode:p.pincode||'',
      surveyNumber:p.survey_number||'', subDivision:p.sub_division||'',
      pattaNumber:p.patta_number||'', khataNumber:p.khata_number||'',
      wardBlock:p.ward_block||'', totalArea:String(p.total_area),
      areaUnit:p.area_unit, udsArea:p.uds_area!=null?String(p.uds_area):'',
      builtUpArea:p.built_up_area!=null?String(p.built_up_area):'',
      registrationNumber:p.registration_number||'',
      registeredDate:p.registered_date?p.registered_date.split('T')[0]:'',
      registrationOffice:p.registration_office||'',
      documentNumber:p.document_number||'',
      purchasePrice:p.purchase_price!=null?String(p.purchase_price):'',
      currentMarketValue:p.current_market_value!=null?String(p.current_market_value):'',
      guidelineValue:p.guideline_value!=null?String(p.guideline_value):'',
      stampDutyPaid:p.stamp_duty_paid!=null?String(p.stamp_duty_paid):'',
      loanOutstanding:String(p.loan_outstanding||0),
      lenderName:p.lender_name||'', titleStatus:p.title_status,
      ecUpdatedDate:p.ec_updated_date?p.ec_updated_date.split('T')[0]:'',
      taxPaidUpto:p.tax_paid_upto?p.tax_paid_upto.split('T')[0]:'',
      occupancyStatus:p.occupancy_status||'own_use',
      monthlyRental:p.monthly_rental!=null?String(p.monthly_rental):'',
      coOwners:p.co_owners||'', nomineeName:p.nominee_name||'',
      gpsLat:p.gps_lat!=null?String(p.gps_lat):'',
      gpsLng:p.gps_lng!=null?String(p.gps_lng):'',
      gpsAddress:p.gps_address||'', notes:p.notes||'',
    });
    setEditingId(p.id); setFormError(''); setDocFile(null); setGpsFile(null);
    setModalTab('basic'); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.propertyName.trim()) { setFormError('Property name is required.'); return; }
    if (!form.district.trim())     { setFormError('District is required.'); return; }
    if (!form.totalArea)           { setFormError('Total area is required.'); return; }
    setSaving(true); setFormError('');
    try {
      // In real implementation, upload files to S3 first, get URLs
      // For now, use filename as placeholder document_name
      const payload: any = {};
      Object.entries(form).forEach(([k,v]) => { if(v!=='') payload[k]=v; });
      if (docFile) { payload.documentName = docFile.name; payload.documentUrl = `uploads/${docFile.name}`; }
      if (gpsFile) { payload.gpsImageUrl = `uploads/${gpsFile.name}`; }
      if (editingId) { await realEstateApi.update(editingId, payload); toast$('success','Property updated.'); }
      else           { await realEstateApi.add(payload); toast$('success','Property added.'); }
      setShowModal(false); await load();
    } catch(e:any) { setFormError(e.response?.data?.message||'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id:string) => {
    if (!confirm('Remove this property?')) return;
    try { await realEstateApi.remove(id); toast$('success','Removed.'); load(); }
    catch { toast$('error','Failed.'); }
  };

  const isFarmOrPlot = ['agricultural_land','residential_plot','commercial_land','industrial'].includes(form.propertyType);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg animate-fade-in
          ${toast.type==='success'?'bg-emerald-600':'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Module header */}
      <div className="bg-gradient-to-r from-amber-900 to-amber-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5 text-amber-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-amber-200">Home</Link><span>›</span>
                <Link to="/dashboard" className="hover:text-amber-200">Dashboard</Link><span>›</span>
                <span className="text-amber-200">Real Estate</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Real Estate & Properties</h1>
              <p className="text-amber-200/60 text-sm mt-0.5">
                {props.length>0 ? `${props.length} propert${props.length>1?'ies':'y'} · Market Value ${fmt(totalValue)} · Net Equity ${fmt(totalValue-totalLoans)}` : 'Track all your land and property assets'}
              </p>
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-amber-900 font-bold text-sm hover:bg-amber-50 transition-colors shadow-sm flex-shrink-0">
              + Add Property
            </button>
          </div>
          <ModuleTabs />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Summary */}
        {props.length>0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {label:'Total Properties',  value:String(props.length),         icon:'🏠', sub:'All types'},
              {label:'Market Value',      value:fmt(totalValue),              icon:'💎', sub:'Current estimate'},
              {label:'Loans Outstanding', value:fmt(totalLoans),              icon:'🏦', sub:'Total mortgages'},
              {label:'Net Equity',        value:fmt(totalValue-totalLoans),   icon:'✅', sub:'Value - Loans',
               color:(totalValue-totalLoans)>=0?'text-emerald-700':'text-red-600'},
            ].map(s=>(
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <div className={`font-display text-xl font-bold ${(s as any).color||'text-slate-800'}`}>{s.value}</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Cards */}
        {loading ? (
          <div className="grid md:grid-cols-2 gap-4">{[1,2].map(i=><div key={i} className="h-56 rounded-2xl bg-slate-200 animate-pulse"/>)}</div>
        ) : props.length===0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-14 text-center">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="font-semibold text-slate-700 text-xl mb-2">No properties added yet</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">
              Add your land, house, apartment or commercial property. Track survey numbers, patta details, GPS location, area and loan status.
            </p>
            <button onClick={openAdd} className="px-8 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors">
              + Add First Property
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            {props.map((p,i)=>{
              const isExp = expandedId===p.id;
              const tc = TITLE_COLORS[p.title_status]||TITLE_COLORS.clear;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className={`bg-gradient-to-r ${GRADIENTS[i%GRADIENTS.length]} p-5 text-white relative overflow-hidden`}>
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10"/>
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl">{PT_ICONS[p.property_type]||'🏠'}</span>
                          <div>
                            <div className="font-bold text-lg leading-tight">{p.property_name}</div>
                            <div className="text-white/60 text-xs">{PROPERTY_TYPES.find(t=>t[0]===p.property_type)?.[1]}</div>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>openEdit(p)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs flex items-center justify-center">✏️</button>
                          <button onClick={()=>handleDelete(p.id)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-red-400/60 text-white text-xs flex items-center justify-center">🗑️</button>
                        </div>
                      </div>
                      <div className="text-white/70 text-xs">
                        📍 {[p.village_locality,p.taluk,p.district].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">Area</div>
                        <div className="font-display font-bold text-slate-800 text-sm">{fmtArea(p.total_area,p.area_unit)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">Market Value</div>
                        <div className="font-display font-bold text-slate-800 text-sm">{p.current_market_value?fmt(p.current_market_value):'—'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-0.5">Title</div>
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${tc}`}>
                          {TITLE_STATUS.find(t=>t[0]===p.title_status)?.[1]||p.title_status}
                        </span>
                      </div>
                    </div>

                    {/* Survey row */}
                    {(p.survey_number||p.patta_number) && (
                      <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
                        <div className="flex flex-wrap gap-4">
                          {p.survey_number && <div><span className="text-[10px] text-amber-600 font-semibold uppercase">Survey No.</span><div className="text-slate-800 text-sm font-mono font-semibold">{p.survey_number}{p.sub_division?'/'+p.sub_division:''}</div></div>}
                          {p.patta_number && <div><span className="text-[10px] text-amber-600 font-semibold uppercase">Patta No.</span><div className="text-slate-800 text-sm font-mono font-semibold">{p.patta_number}</div></div>}
                          {p.registration_number && <div><span className="text-[10px] text-amber-600 font-semibold uppercase">Reg. No.</span><div className="text-slate-800 text-sm font-mono font-semibold">{p.registration_number}</div></div>}
                        </div>
                      </div>
                    )}

                    {/* GPS row */}
                    {(p.gps_lat||p.gps_address) && (
                      <div className="bg-blue-50 rounded-xl px-3 py-2 border border-blue-100">
                        <div className="flex items-center gap-2 text-xs text-blue-700">
                          <span>🗺️</span>
                          {p.gps_lat && p.gps_lng && <span className="font-mono">{Number(p.gps_lat).toFixed(5)}, {Number(p.gps_lng).toFixed(5)}</span>}
                          {p.gps_address && <span className="text-blue-500">{p.gps_address}</span>}
                          {p.gps_lat && p.gps_lng && (
                            <a href={`https://maps.google.com/?q=${p.gps_lat},${p.gps_lng}`} target="_blank" rel="noreferrer"
                              className="ml-auto text-blue-600 hover:text-blue-800 font-semibold">View Map →</a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Document badge */}
                    {p.document_name && (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>📎</span><span className="truncate">{p.document_name}</span>
                      </div>
                    )}

                    {Number(p.loan_outstanding)>0 && (
                      <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
                        <span>🏦</span>
                        <div>
                          <div className="text-xs text-orange-700 font-semibold">Loan: {fmt(p.loan_outstanding)}</div>
                          {p.lender_name&&<div className="text-xs text-orange-500">{p.lender_name}</div>}
                        </div>
                      </div>
                    )}

                    {isExp && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-100 animate-fade-in">
                        {p.purchase_price&&<div className="flex justify-between text-xs"><span className="text-slate-400">Purchase Price</span><span className="font-semibold">{fmt(p.purchase_price)}</span></div>}
                        {p.guideline_value&&<div className="flex justify-between text-xs"><span className="text-slate-400">Guideline Value</span><span className="font-semibold">{fmt(p.guideline_value)}</span></div>}
                        {p.registered_date&&<div className="flex justify-between text-xs"><span className="text-slate-400">Registered</span><span className="font-semibold">{fmtDate(p.registered_date)}</span></div>}
                        {p.ec_updated_date&&<div className="flex justify-between text-xs"><span className="text-slate-400">EC Updated</span><span className="font-semibold">{fmtDate(p.ec_updated_date)}</span></div>}
                        {p.tax_paid_upto&&<div className="flex justify-between text-xs"><span className="text-slate-400">Tax Paid Upto</span><span className="font-semibold">{fmtDate(p.tax_paid_upto)}</span></div>}
                        {p.occupancy_status&&<div className="flex justify-between text-xs"><span className="text-slate-400">Occupancy</span><span className="font-semibold capitalize">{p.occupancy_status.replace(/_/g,' ')}</span></div>}
                        {p.monthly_rental&&<div className="flex justify-between text-xs"><span className="text-slate-400">Monthly Rental</span><span className="font-semibold text-emerald-700">{fmt(p.monthly_rental)}</span></div>}
                        {p.co_owners&&<div className="text-xs"><span className="text-slate-400 block">Co-owners</span><span>{p.co_owners}</span></div>}
                        {p.nominee_name&&<div className="flex justify-between text-xs"><span className="text-slate-400">Nominee</span><span className="font-semibold">{p.nominee_name}</span></div>}
                        {p.notes&&<div className="text-xs text-slate-400 italic">"{p.notes}"</div>}
                      </div>
                    )}

                    <button onClick={()=>setExpandedId(isExp?null:p.id)}
                      className="text-xs text-amber-700 hover:text-amber-900 font-medium w-full text-left">
                      {isExp?'▲ Less details':'▼ More details'}
                    </button>
                  </div>
                </div>
              );
            })}

            <button onClick={openAdd}
              className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-amber-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-amber-600 transition-all min-h-[220px] bg-white">
              <span className="text-3xl">+</span><span className="text-sm font-medium">Add Property</span>
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-amber-900 to-amber-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-white font-semibold">🏠 {editingId?'Edit':'Add'} Property</div>
                <div className="text-amber-200/70 text-xs">Complete property details</div>
              </div>
              <button onClick={()=>setShowModal(false)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white">✕</button>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
              {MODAL_TABS.map(t=>(
                <button key={t.id} onClick={()=>setModalTab(t.id)}
                  className={`flex-1 py-2.5 text-xs font-semibold transition-all
                    ${modalTab===t.id?'text-amber-700 border-b-2 border-amber-600 bg-white':'text-slate-500 hover:text-slate-700'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {formError && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">⚠️ {formError}</div>}

              <div className="grid grid-cols-2 gap-3">
                {/* LOCATION TAB */}
                {modalTab==='basic' && <>
                  <FormInput label="Property Name *" value={form.propertyName} onChange={set('propertyName')} placeholder="e.g. Anna Nagar House" col={2} required accentColor="amber"/>
                  <FormSelect label="Property Type *" value={form.propertyType} onChange={set('propertyType')} options={PROPERTY_TYPES} accentColor="amber"/>
                  <FormSelect label="Occupancy Status" value={form.occupancyStatus} onChange={set('occupancyStatus')} options={OCCUPANCY} accentColor="amber"/>
                  <FormInput label="Door / Flat No." value={form.doorFlatNumber} onChange={set('doorFlatNumber')} placeholder="e.g. B-704, Plot No. 24" accentColor="amber"/>
                  <FormInput label="Street / Road" value={form.streetAddress} onChange={set('streetAddress')} placeholder="e.g. 5th Cross Street" accentColor="amber"/>
                  <FormInput label="Village / Locality" value={form.villageLocality} onChange={set('villageLocality')} placeholder="e.g. Anna Nagar West" accentColor="amber"/>
                  <FormInput label="Taluk" value={form.taluk} onChange={set('taluk')} placeholder="e.g. Alandur" accentColor="amber"/>
                  <FormInput label="District *" value={form.district} onChange={set('district')} placeholder="e.g. Chennai" required accentColor="amber"/>
                  <FormInput label="State" value={form.state} onChange={set('state')} placeholder="Tamil Nadu" accentColor="amber"/>
                  <FormInput label="Pincode" value={form.pincode} onChange={set('pincode')} placeholder="600040" maxLength={6} accentColor="amber"/>
                </>}

                {/* SURVEY / LEGAL TAB */}
                {modalTab==='survey' && <>
                  <FormInput label="Total Area *" value={form.totalArea} onChange={set('totalArea')} type="number" placeholder="e.g. 2400" required accentColor="amber"/>
                  <FormSelect label="Area Unit *" value={form.areaUnit} onChange={set('areaUnit')} options={AREA_UNITS} accentColor="amber"/>
                  {!isFarmOrPlot && <>
                    <FormInput label="UDS Area (Sq.Ft.)" value={form.udsArea} onChange={set('udsArea')} type="number" placeholder="Undivided share area" accentColor="amber"/>
                    <FormInput label="Built-up Area (Sq.Ft.)" value={form.builtUpArea} onChange={set('builtUpArea')} type="number" placeholder="Constructed area" accentColor="amber"/>
                  </>}
                  <FormInput label="Survey Number" value={form.surveyNumber} onChange={set('surveyNumber')} placeholder="e.g. 124/2A" accentColor="amber"/>
                  {isFarmOrPlot
                    ? <FormInput label="Sub-division" value={form.subDivision} onChange={set('subDivision')} placeholder="e.g. B" accentColor="amber"/>
                    : <FormInput label="Sub-division" value={form.subDivision} onChange={set('subDivision')} placeholder="e.g. B" accentColor="amber"/>
                  }
                  <FormInput label="Patta Number" value={form.pattaNumber} onChange={set('pattaNumber')} placeholder="e.g. 4821" accentColor="amber"/>
                  <FormInput label="Khata Number" value={form.khataNumber} onChange={set('khataNumber')} placeholder="e.g. 1234/A" accentColor="amber"/>
                  <FormInput label="Ward / Block" value={form.wardBlock} onChange={set('wardBlock')} placeholder="e.g. Ward 14" accentColor="amber"/>
                  <FormInput label="Registration Number" value={form.registrationNumber} onChange={set('registrationNumber')} placeholder="e.g. TN/CH/2024/12345" accentColor="amber"/>
                  <FormInput label="Registered Date" value={form.registeredDate} onChange={set('registeredDate')} type="date" accentColor="amber"/>
                  <FormInput label="Registration Office" value={form.registrationOffice} onChange={set('registrationOffice')} placeholder="e.g. Sub-Registrar, Egmore" col={2} accentColor="amber"/>
                  <FormInput label="Document / Deed Number" value={form.documentNumber} onChange={set('documentNumber')} placeholder="e.g. Doc No. 456/2024" col={2} accentColor="amber"/>
                  <FormSelect label="Title Status" value={form.titleStatus} onChange={set('titleStatus')} options={TITLE_STATUS} accentColor="amber"/>
                  <FormInput label="EC Updated Date" value={form.ecUpdatedDate} onChange={set('ecUpdatedDate')} type="date" accentColor="amber"/>
                  <FormInput label="Tax Paid Upto" value={form.taxPaidUpto} onChange={set('taxPaidUpto')} type="date" accentColor="amber"/>
                </>}

                {/* FINANCIAL TAB */}
                {modalTab==='financial' && <>
                  <FormInput label="Purchase Price (₹)" value={form.purchasePrice} onChange={set('purchasePrice')} type="number" placeholder="e.g. 5000000" accentColor="amber"/>
                  <FormInput label="Current Market Value (₹)" value={form.currentMarketValue} onChange={set('currentMarketValue')} type="number" placeholder="e.g. 8500000" accentColor="amber"/>
                  <FormInput label="Guideline Value (₹)" value={form.guidelineValue} onChange={set('guidelineValue')} type="number" placeholder="Govt guideline value" accentColor="amber"/>
                  <FormInput label="Stamp Duty Paid (₹)" value={form.stampDutyPaid} onChange={set('stampDutyPaid')} type="number" placeholder="e.g. 420000" accentColor="amber"/>
                  <FormInput label="Loan Outstanding (₹)" value={form.loanOutstanding} onChange={set('loanOutstanding')} type="number" placeholder="0 if no loan" accentColor="amber"/>
                  <FormInput label="Lender / Bank Name" value={form.lenderName} onChange={set('lenderName')} placeholder="e.g. SBI Home Loans" accentColor="amber"/>
                  {form.occupancyStatus==='rented' && (
                    <FormInput label="Monthly Rental (₹)" value={form.monthlyRental} onChange={set('monthlyRental')} type="number" placeholder="e.g. 25000" col={2} accentColor="amber"/>
                  )}
                  <FormInput label="Co-owners" value={form.coOwners} onChange={set('coOwners')} placeholder="e.g. Priya Krishnamurthy" col={2} accentColor="amber"/>
                  <FormInput label="Nominee Name" value={form.nomineeName} onChange={set('nomineeName')} placeholder="Who inherits this property" col={2} accentColor="amber"/>
                </>}

                {/* GPS & DOCS TAB */}
                {modalTab==='gps' && <>
                  <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                    💡 Enter GPS coordinates to enable Google Maps link on the property card.
                  </div>
                  <FormInput label="GPS Latitude" value={form.gpsLat} onChange={set('gpsLat')} type="number" placeholder="e.g. 13.0827" accentColor="amber" hint="Decimal degrees (e.g. 13.082756)"/>
                  <FormInput label="GPS Longitude" value={form.gpsLng} onChange={set('gpsLng')} type="number" placeholder="e.g. 80.2707" accentColor="amber" hint="Decimal degrees (e.g. 80.270718)"/>
                  <FormInput label="GPS Address / Landmark" value={form.gpsAddress} onChange={set('gpsAddress')} placeholder="e.g. Near Anna Arch, Chennai" col={2} accentColor="amber"/>
                  <FormFile label="GPS / Location Image" col={2} accept=".jpg,.jpeg,.png"
                    fileName={gpsFile?.name} onChange={setGpsFile}
                    hint="Upload a screenshot of the map or satellite image"/>
                  <FormFile label="Property Document (Sale Deed / EC / Patta)" col={2}
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    fileName={docFile?.name} onChange={setDocFile}
                    hint="Upload sale deed, encumbrance certificate, or patta copy"/>
                  <FormTextarea label="Notes" value={form.notes} onChange={set('notes') as any}
                    placeholder="Any additional notes about this property" col={2} accentColor="amber" rows={3}/>
                </>}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0 bg-white">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving?'Saving...':editingId?'Update Property':'Add Property'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealEstatePage;
