// frontend/src/pages/PolicyDashboard.tsx
// Router: <Route path="/policy-dashboard" element={<PolicyDashboard />} />

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import ModuleTabs from "../components/ModuleTabs";
import { policyAnalysisApi } from "../services/api";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface InsuredItem {
  name: string; type: string; relation: string; age: number;
  idNumber: string; baseCoverage: number; baseSumInsured?: number; bonus: number; totalCoverage: number;
}
interface Nominee { name: string; relation: string; share: string; }
interface Premium { base: number; addons: number; discounts: number; final: number; }
interface ProjectionRow { year: string; amount: number; }
interface Benefit { text: string; covered: boolean; }
interface WaitingPeriod { label: string; duration: string; }
interface DonutSegment { label: string; value: number; color: string; }

interface VehicleDetails {
  make: string; model: string; year: number;
  registrationNumber: string; engineNumber: string; chassisNumber: string;
  fuelType: string; idv: number; cubicCapacity: string;
}
interface PropertyDetails {
  address: string; propertyType: string; builtUpArea: string;
  constructionType: string; sumInsuredBuilding: number; sumInsuredContents: number;
}
interface LifeDetails {
  sumAssured: number; maturityAge: number; policyTerm: string;
  paymentTerm: string; surrenderValue: number; deathBenefit: number; maturityBenefit: number;
}
interface TravelDetails {
  destination: string; tripType: string; emergencyLimit: number;
  medicalLimit: number; tripDuration: string;
}
interface PolicySpecificDetails {
  vehicleDetails?: VehicleDetails | null;
  propertyDetails?: PropertyDetails | null;
  lifeDetails?: LifeDetails | null;
  travelDetails?: TravelDetails | null;
}

interface PolicyData {
  id: number; fileName: string;
  policyHolder: string; policyNumber: string; planName: string;
  policyType: string; policyPeriod: string; zone: string;
  preExistingConditions: string; insurer: string;
  insuredItems: InsuredItem[];
  insuredMembers: InsuredItem[]; // legacy fallback
  nominee: Nominee; premium: Premium;
  taxBenefit: number; totalEffectiveCoverage: number;
  bonusAccumulated: number; bonusType: string;
  coverageProjection: ProjectionRow[]; keyBenefits: Benefit[];
  waitingPeriods: WaitingPeriod[]; zoneRule: string;
  addons: string[]; premiumWaiver: string;
  claimProcess: string; networkHospitals: string;
  ncbDiscount: string; thirdPartyLiability: number; ownDamageLimit: number;
  policySpecificDetails: PolicySpecificDetails;
  expiresAt: string; createdAt: string;
}

// ─────────────────────────────────────────────
// Policy type helpers
// ─────────────────────────────────────────────
const isMotor = (t: string) => t?.toLowerCase().includes("motor") || t?.toLowerCase().includes("car") || t?.toLowerCase().includes("bike");
const isHealth = (t: string) => t?.toLowerCase().includes("health");
const isHome = (t: string) => t?.toLowerCase().includes("home");
const isLife = (t: string) => t?.toLowerCase().includes("life");
const isTravel = (t: string) => t?.toLowerCase().includes("travel");

function policyIcon(type: string): string {
  if (isMotor(type)) return "🚗";
  if (isHealth(type)) return "🏥";
  if (isHome(type)) return "🏠";
  if (isLife(type)) return "🧬";
  if (isTravel(type)) return "✈️";
  return "🛡️";
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmtINR = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

const fmtL = (n: number) =>
  n >= 10_000_000 ? `₹${(n / 10_000_000).toFixed(2)} Cr`
    : n >= 100_000 ? `₹${(n / 100_000).toFixed(1)} L`
      : `₹${(n / 1_000).toFixed(0)} K`;

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
interface MiniBarProps { value: number; max: number; colorClass?: string; }
const MiniBar: React.FC<MiniBarProps> = ({ value, max, colorClass = "bg-blue-500" }) => (
  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex-1">
    <div className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
      style={{ width: `${max > 0 ? Math.min((value / max) * 100, 100) : 0}%` }} />
  </div>
);

interface CovBarProps { label: string; value: number; total: number; colorClass: string; }
const CovBar: React.FC<CovBarProps> = ({ label, value, total, colorClass }) => (
  <div className="mb-2">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700">{fmtL(value)}</span>
    </div>
    <MiniBar value={value} max={total} colorClass={colorClass} />
  </div>
);

interface BenefitPillProps { text: string; covered: boolean; }
const BenefitPill: React.FC<BenefitPillProps> = ({ text, covered }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border
    ${covered ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
    <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold
      ${covered ? "bg-emerald-200 text-emerald-700" : "bg-red-200 text-red-600"}`}>
      {covered ? "✓" : "✗"}
    </span>
    <span className="text-slate-700 leading-tight">{text}</span>
  </div>
);

interface SectionTitleProps { icon: string; title: string; action?: React.ReactNode; }
const SectionTitle: React.FC<SectionTitleProps> = ({ icon, title, action }) => (
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
      <span>{icon}</span> {title}
    </h3>
    {action}
  </div>
);

interface KpiCardProps {
  icon: string; label: string; value: string; sub: string;
  bgClass: string; textClass: string; borderClass: string;
}
const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, sub, bgClass, textClass, borderClass }) => (
  <div className={`bg-white rounded-2xl border p-4 shadow-sm ${bgClass} ${borderClass}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-slate-500 leading-tight">{label}</span>
      <span className="text-xl">{icon}</span>
    </div>
    <div className={`font-display text-lg font-bold leading-tight ${textClass}`}>{value}</div>
    <div className="text-slate-400 text-xs mt-1 truncate">{sub}</div>
  </div>
);

interface InfoRowProps { label: string; value: string | number | null | undefined; }
const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-700 text-right max-w-[60%]">{String(value)}</span>
    </div>
  );
};

interface WaitingTimelineProps { periods: WaitingPeriod[]; }
const WaitingTimeline: React.FC<WaitingTimelineProps> = ({ periods }) => (
  <div className="relative pl-5">
    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-400 to-blue-200 rounded-full" />
    {periods.map((p, i) => (
      <div key={i} className="relative flex items-start gap-3 mb-4 last:mb-0">
        <div className="absolute -left-[14px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
        <div>
          <p className="text-sm font-semibold text-slate-700 leading-tight">{p.label}</p>
          <p className="text-xs text-amber-600 font-medium mt-0.5">{p.duration}</p>
        </div>
      </div>
    ))}
  </div>
);

interface DonutChartProps { segments: DonutSegment[]; total: number; center: string; sub: string; }
const DonutChart: React.FC<DonutChartProps> = ({ segments, total, center, sub }) => {
  const r = 68, cx = 90, cy = 90, sw = 20, circ = 2 * Math.PI * r;
  let cum = 0;
  const arcs = segments.filter((s) => s.value > 0).map((s) => {
    const pct = s.value / (total || 1);
    const dash = pct * circ, gap = circ - dash, offset = circ - cum * circ;
    cum += pct;
    return { ...s, dash, gap, offset };
  });
  return (
    <svg width="180" height="180" viewBox="0 0 180 180">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
      {arcs.map((a, i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={sw}
          strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={a.offset}
          style={{ transform: "rotate(-90deg)", transformOrigin: `${cx}px ${cy}px`, transition: "0.6s ease" }} />
      ))}
      <text x={cx} y={cy - 8} textAnchor="middle"
        style={{ fontSize: "12px", fontWeight: 700, fill: "#1e293b", fontFamily: "system-ui" }}>{center}</text>
      <text x={cx} y={cy + 10} textAnchor="middle"
        style={{ fontSize: "9px", fill: "#94a3b8", fontFamily: "system-ui" }}>{sub}</text>
    </svg>
  );
};

// ─────────────────────────────────────────────
// Empty / upload state
// ─────────────────────────────────────────────
interface EmptyStateProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  analyzing: boolean;
}
const EmptyState: React.FC<EmptyStateProps> = ({ onFileChange, fileRef, analyzing }) => (
  <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
    <div className="text-6xl mb-4">📄</div>
    <h2 className="font-display text-2xl font-bold text-slate-800 mb-3">
      No Policy Analysed Yet
    </h2>
    <p className="text-slate-400 mb-6 max-w-md mx-auto text-sm leading-relaxed">
      Upload any insurance policy PDF — health, car, bike, home, life, travel and more.
      Gemini AI will automatically extract all key details and display them in a graphical dashboard.
      Data is stored temporarily for 24 hours.
    </p>
    <div className="flex flex-wrap items-center justify-center gap-2 mb-8 text-xs text-slate-400">
      {["🏥 Health", "🚗 Motor", "🏠 Home", "🧬 Life", "✈️ Travel", "🛡️ All Policies"].map((t) => (
        <span key={t} className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 font-medium">{t}</span>
      ))}
    </div>
    <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={onFileChange} />
    <button
      onClick={() => !analyzing && fileRef.current?.click()}
      disabled={analyzing}
      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
    >
      {analyzing ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Analysing with Gemini AI…
        </>
      ) : <>📤 Upload Policy PDF</>}
    </button>
    <p className="text-slate-300 text-xs mt-4">Accepts PDF · Max 20 MB · Stored for 24 hours</p>
  </div>
);

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────
const DashboardSkeleton: React.FC = () => (
  <div className="space-y-5 animate-pulse">
    <div className="h-28 bg-slate-200 rounded-2xl" />
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-2xl" />)}
    </div>
    <div className="grid lg:grid-cols-3 gap-5">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 bg-slate-200 rounded-2xl" />)}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Type-specific sections
// ─────────────────────────────────────────────

/** Motor (Car / Bike) Details */
const MotorSection: React.FC<{ p: PolicyData }> = ({ p }) => {
  const v = p.policySpecificDetails?.vehicleDetails;
  if (!v) return null;
  const totalOD = p.ownDamageLimit || 0;
  const totalTP = p.thirdPartyLiability || 0;
  const donut: DonutSegment[] = [
    { label: "Own Damage", value: totalOD, color: "#2563eb" },
    { label: "Third Party", value: totalTP, color: "#10b981" },
  ].filter((s) => s.value > 0);
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      {/* Vehicle Info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="🚗" title="Vehicle Details" />
        <InfoRow label="Make & Model" value={[v.make, v.model].filter(Boolean).join(" ")} />
        <InfoRow label="Year" value={v.year} />
        <InfoRow label="Registration No." value={v.registrationNumber} />
        <InfoRow label="Engine No." value={v.engineNumber} />
        <InfoRow label="Chassis No." value={v.chassisNumber} />
        <InfoRow label="Fuel Type" value={v.fuelType} />
        <InfoRow label="Cubic Capacity" value={v.cubicCapacity} />
        {v.idv > 0 && (
          <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-600 font-semibold">Insured Declared Value (IDV)</p>
            <p className="font-display text-xl font-bold text-blue-700 mt-0.5">{fmtINR(v.idv)}</p>
          </div>
        )}
      </div>

      {/* Coverage split */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="🛡️" title="Coverage Breakdown" />
        {donut.length > 0 ? (
          <div className="flex items-center gap-3">
            <DonutChart segments={donut} total={totalOD + totalTP}
              center={fmtL(totalOD + totalTP)} sub="total cover" />
            <div className="space-y-2 flex-1">
              {donut.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-slate-600">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBar value={s.value} max={totalOD + totalTP} />
                    <span className="text-xs font-bold text-slate-700 w-16 text-right">{fmtL(s.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">Coverage data not found in PDF.</p>
        )}
        {p.ncbDiscount && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-xs text-emerald-600 font-semibold">🎯 No Claim Bonus (NCB)</p>
            <p className="text-sm font-bold text-emerald-700 mt-0.5">{p.ncbDiscount}</p>
          </div>
        )}
      </div>

      {/* Claim process */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="📋" title="Claim Process" />
        <p className="text-sm text-slate-600 leading-relaxed">
          {p.claimProcess || "Refer to your policy document for claim procedures."}
        </p>
      </div>
    </div>
  );
};

/** Home Insurance Details */
const HomeSection: React.FC<{ p: PolicyData }> = ({ p }) => {
  const prop = p.policySpecificDetails?.propertyDetails;
  if (!prop) return null;
  const donut: DonutSegment[] = [
    { label: "Building", value: prop.sumInsuredBuilding || 0, color: "#2563eb" },
    { label: "Contents", value: prop.sumInsuredContents || 0, color: "#10b981" },
  ].filter((s) => s.value > 0);
  const total = (prop.sumInsuredBuilding || 0) + (prop.sumInsuredContents || 0);
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="🏠" title="Property Details" />
        <InfoRow label="Address" value={prop.address} />
        <InfoRow label="Property Type" value={prop.propertyType} />
        <InfoRow label="Built-Up Area" value={prop.builtUpArea} />
        <InfoRow label="Construction Type" value={prop.constructionType} />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="🛡️" title="Sum Insured Breakdown" />
        {donut.length > 0 ? (
          <div className="flex items-center gap-3">
            <DonutChart segments={donut} total={total} center={fmtL(total)} sub="total" />
            <div className="space-y-2 flex-1">
              {donut.map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                    <span className="text-xs text-slate-600">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniBar value={s.value} max={total} />
                    <span className="text-xs font-bold text-slate-700 w-16 text-right">{fmtL(s.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No coverage data extracted.</p>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="📋" title="Claim Process" />
        <p className="text-sm text-slate-600 leading-relaxed">
          {p.claimProcess || "Refer to your policy document for claim procedures."}
        </p>
      </div>
    </div>
  );
};

/** Life Insurance Details */
const LifeSection: React.FC<{ p: PolicyData }> = ({ p }) => {
  const lf = p.policySpecificDetails?.lifeDetails;
  if (!lf) return null;
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="🧬" title="Policy Terms" />
        <InfoRow label="Sum Assured" value={lf.sumAssured ? fmtINR(lf.sumAssured) : null} />
        <InfoRow label="Policy Term" value={lf.policyTerm} />
        <InfoRow label="Payment Term" value={lf.paymentTerm} />
        <InfoRow label="Maturity Age" value={lf.maturityAge ? `${lf.maturityAge} years` : null} />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="💰" title="Benefits" />
        {lf.deathBenefit > 0 && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 mb-3">
            <p className="text-xs text-red-600 font-semibold">Death Benefit</p>
            <p className="font-display text-lg font-bold text-red-700">{fmtINR(lf.deathBenefit)}</p>
          </div>
        )}
        {lf.maturityBenefit > 0 && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 mb-3">
            <p className="text-xs text-emerald-600 font-semibold">Maturity Benefit</p>
            <p className="font-display text-lg font-bold text-emerald-700">{fmtINR(lf.maturityBenefit)}</p>
          </div>
        )}
        {lf.surrenderValue > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-600 font-semibold">Surrender Value</p>
            <p className="font-display text-lg font-bold text-amber-700">{fmtINR(lf.surrenderValue)}</p>
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="📋" title="Claim Process" />
        <p className="text-sm text-slate-600 leading-relaxed">
          {p.claimProcess || "Refer to your policy document for claim procedures."}
        </p>
      </div>
    </div>
  );
};

/** Travel Insurance Details */
const TravelSection: React.FC<{ p: PolicyData }> = ({ p }) => {
  const tr = p.policySpecificDetails?.travelDetails;
  if (!tr) return null;
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="✈️" title="Trip Details" />
        <InfoRow label="Destination" value={tr.destination} />
        <InfoRow label="Trip Type" value={tr.tripType} />
        <InfoRow label="Trip Duration" value={tr.tripDuration} />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="🛡️" title="Coverage Limits" />
        {tr.medicalLimit > 0 && (
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 mb-3">
            <p className="text-xs text-blue-600 font-semibold">Medical Coverage</p>
            <p className="font-display text-lg font-bold text-blue-700">{fmtINR(tr.medicalLimit)}</p>
          </div>
        )}
        {tr.emergencyLimit > 0 && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-xs text-red-600 font-semibold">Emergency Evacuation</p>
            <p className="font-display text-lg font-bold text-red-700">{fmtINR(tr.emergencyLimit)}</p>
          </div>
        )}
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <SectionTitle icon="📋" title="Claim Process" />
        <p className="text-sm text-slate-600 leading-relaxed">
          {p.claimProcess || "Refer to your policy document for claim procedures."}
        </p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
const PolicyDashboard: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await policyAnalysisApi.get();
      setPolicy(res.data.data.analysis ?? null);
    } catch {
      showToast("Failed to load analysis.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setAnalyzing(true);
    try {
      const res = await policyAnalysisApi.upload(file);
      setPolicy(res.data.data.analysis);
      showToast("Policy analysed and saved ✓");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? "Failed to analyse PDF.";
      showToast(msg, "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Remove this policy analysis?")) return;
    try {
      await policyAnalysisApi.delete();
      setPolicy(null);
      showToast("Analysis removed.");
    } catch {
      showToast("Failed to remove analysis.", "error");
    }
  };

  const p = policy;
  const items = p ? (p.insuredItems?.length ? p.insuredItems : p.insuredMembers ?? []) : [];
  const maxProjection = p
    ? Math.max(...(p.coverageProjection ?? []).map((c) => c.amount), 1)
    : 1;

  const donutSegments: DonutSegment[] = p
    ? [
      { label: "Base Cover", value: items[0]?.baseCoverage ?? items[0]?.baseSumInsured ?? 0, color: "#2563eb" },
      { label: "Accumulated Bonus", value: p.bonusAccumulated ?? 0, color: "#10b981" },
    ].filter((s) => s.value > 0)
    : [];

  // KPI cards — adapt by policy type
  const kpiCards = p ? (() => {
    const base = [
      { icon: "💰", label: "Final Premium", value: fmtINR(p.premium?.final), sub: "Annual payment", bgClass: "bg-blue-50", borderClass: "border-blue-200", textClass: "text-blue-700" },
      { icon: "🛡️", label: "Total Coverage", value: fmtL(p.totalEffectiveCoverage), sub: "Effective cover", bgClass: "bg-emerald-50", borderClass: "border-emerald-200", textClass: "text-emerald-700" },
      { icon: "⚡", label: "Add-Ons", value: String(p.addons?.length ?? 0), sub: "Active riders", bgClass: "bg-indigo-50", borderClass: "border-indigo-200", textClass: "text-indigo-700" },
    ];
    if (isHealth(p.policyType)) {
      return [
        ...base,
        { icon: "📈", label: "Bonus Accumulated", value: fmtL(p.bonusAccumulated), sub: p.bonusType || "Bonus", bgClass: "bg-amber-50", borderClass: "border-amber-200", textClass: "text-amber-700" },
        { icon: "🧾", label: "Tax Benefit", value: fmtINR(p.taxBenefit), sub: "Section 80D", bgClass: "bg-violet-50", borderClass: "border-violet-200", textClass: "text-violet-700" },
        { icon: "👥", label: "Insured Members", value: String(items.length), sub: "Covered persons", bgClass: "bg-slate-50", borderClass: "border-slate-200", textClass: "text-slate-700" },
      ];
    }
    if (isMotor(p.policyType)) {
      return [
        ...base,
        { icon: "🚗", label: "IDV", value: fmtINR(p.policySpecificDetails?.vehicleDetails?.idv ?? 0), sub: "Declared value", bgClass: "bg-amber-50", borderClass: "border-amber-200", textClass: "text-amber-700" },
        { icon: "🛡️", label: "Own Damage", value: fmtL(p.ownDamageLimit ?? 0), sub: "OD Cover", bgClass: "bg-violet-50", borderClass: "border-violet-200", textClass: "text-violet-700" },
        { icon: "⚖️", label: "Third Party", value: fmtL(p.thirdPartyLiability ?? 0), sub: "TP Liability", bgClass: "bg-rose-50", borderClass: "border-rose-200", textClass: "text-rose-700" },
      ];
    }
    if (isLife(p.policyType)) {
      const lf = p.policySpecificDetails?.lifeDetails;
      return [
        ...base,
        { icon: "🧬", label: "Sum Assured", value: fmtL(lf?.sumAssured ?? 0), sub: "Death benefit", bgClass: "bg-amber-50", borderClass: "border-amber-200", textClass: "text-amber-700" },
        { icon: "🎯", label: "Maturity Benefit", value: fmtL(lf?.maturityBenefit ?? 0), sub: `At age ${lf?.maturityAge ?? "–"}`, bgClass: "bg-violet-50", borderClass: "border-violet-200", textClass: "text-violet-700" },
        { icon: "🧾", label: "Tax Benefit", value: fmtINR(p.taxBenefit), sub: "Section 80C/D", bgClass: "bg-slate-50", borderClass: "border-slate-200", textClass: "text-slate-700" },
      ];
    }

    // Generic / Home / Travel / Other
    return [
      ...base,
      { icon: "🧾", label: "Tax Benefit", value: fmtINR(p.taxBenefit), sub: "Applicable deduction", bgClass: "bg-violet-50", borderClass: "border-violet-200", textClass: "text-violet-700" },
      { icon: "👥", label: "Insured Items", value: String(items.length), sub: "Items covered", bgClass: "bg-slate-50", borderClass: "border-slate-200", textClass: "text-slate-700" },
      { icon: "📈", label: "Bonus", value: fmtL(p.bonusAccumulated), sub: "Accumulated", bgClass: "bg-amber-50", borderClass: "border-amber-200", textClass: "text-amber-700" },
    ];
  })() : [];

  const icon = p ? policyIcon(p.policyType) : "🛡️";

  // Place these inside PolicyDashboard, before the return statement
const exportJPEG = async () => {
  const element = document.getElementById("policy-dashboard");
  if (!element) return;
  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const link = document.createElement("a");
  link.download = "policy-analysis.jpg";
  link.href = canvas.toDataURL("image/jpeg", 1.0);
  link.click();
};

const exportPDF = async () => {
  const element = document.getElementById("policy-dashboard");
  if (!element) return;
  const canvas = await html2canvas(element, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL("image/jpeg", 1.0);
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "px",
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, "JPEG", 0, 0, canvas.width, canvas.height);
  pdf.save("policy-analysis.pdf");
};

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />

      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg text-white
          ${toast.type === "error" ? "bg-red-600" : "bg-slate-800"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5 text-blue-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-blue-200">Home</Link>
                <span>›</span>
                <Link to="/policies" className="hover:text-blue-200">Policies</Link>
                <span>›</span>
                <span className="text-blue-200">Policy Intelligence</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                Policy Intelligence Dashboard {icon}
              </h1>
              <p className="text-blue-200/60 text-sm mt-0.5">
                {p ? `${p.policyType} · ${p.planName} · ${p.policyNumber}` : "Upload any insurance PDF to get started"}
              </p>
            </div>
            {/* <div className="flex items-center gap-2 flex-shrink-0">
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
              {p && (
                <button onClick={handleDelete}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-white text-sm font-semibold hover:bg-red-500/30 transition-all">
                  🗑 Remove
                </button>
              )}
              <button
                onClick={() => !analyzing && fileRef.current?.click()}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-all disabled:opacity-60">
                {analyzing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Analysing…
                  </>
                ) : <>📄 {p ? "Re-upload PDF" : "Upload Policy PDF"}</>}
              </button>
              
            </div> */}

            <div className="flex items-center gap-2 flex-shrink-0">
  <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />

  {p && (
    <>
      <button
        onClick={exportPDF}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-white text-sm font-semibold hover:bg-emerald-500/30 transition-all"
      >
        📄 Export PDF
      </button>

      <button
        onClick={exportJPEG}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-white text-sm font-semibold hover:bg-blue-500/30 transition-all"
      >
        🖼 Export JPEG
      </button>

      <button
        onClick={handleDelete}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/20 border border-red-400/30 text-white text-sm font-semibold hover:bg-red-500/30 transition-all"
      >
        🗑 Remove
      </button>
    </>
  )}

  <button
    onClick={() => !analyzing && fileRef.current?.click()}
    disabled={analyzing}
    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-white text-sm font-semibold hover:bg-white/25 transition-all disabled:opacity-60"
  >
    {analyzing ? "Analysing..." : "📄 Upload Policy PDF"}
  </button>
</div>

          </div>
          <ModuleTabs />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5" id="policy-dashboard">

        {loading && <DashboardSkeleton />}

        {!loading && !p && (
          <EmptyState onFileChange={handleFile} fileRef={fileRef} analyzing={analyzing} />
        )}

        {analyzing && (
          <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-2xl text-center max-w-sm mx-4">
              <svg className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="font-semibold text-slate-800 text-lg">Analysing with Gemini AI</p>
              <p className="text-slate-400 text-sm mt-1">Extracting all policy details from your PDF…</p>
              <p className="text-slate-300 text-xs mt-2">This may take up to 30 seconds</p>
            </div>
          </div>
        )}

        {!loading && p && (
          <>
            {/* TTL banner */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <span>⏱</span>
                <span>Analysis of <strong>{p.fileName}</strong> — {timeLeft(p.expiresAt)}</span>
              </div>
              <span className="text-xs text-amber-600 font-medium">
                Uploaded {new Date(p.createdAt).toLocaleString("en-IN")}
              </span>
            </div>

            {/* Policyholder banner */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 rounded-2xl p-5 shadow-lg">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="text-blue-300/60 text-xs font-medium tracking-widest uppercase mb-1">Policy Holder</div>
                  <div className="font-display text-3xl sm:text-4xl font-bold text-white">{p.policyHolder}</div>
                  <div className="text-blue-200/50 text-xs mt-1">{p.policyNumber} · {p.planName}</div>
                </div>
                <div className="flex flex-wrap gap-4">
                  {([
                    { label: "Type", value: p.policyType },
                    { label: "Insurer", value: p.insurer },
                    { label: "Period", value: p.policyPeriod },
                    { label: "Zone", value: p.zone },
                  ] as { label: string; value: string }[])
                    .filter((i) => i.value)
                    .map((item) => (
                      <div key={item.label} className="text-right">
                        <div className="text-blue-200/50 text-xs mb-0.5">{item.label}</div>
                        <div className="font-semibold text-white text-sm">{item.value}</div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {kpiCards.map((card) => (
                <KpiCard key={card.label} icon={card.icon} label={card.label} value={card.value}
                  sub={card.sub} bgClass={card.bgClass} borderClass={card.borderClass} textClass={card.textClass} />
              ))}
            </div>

            {/* ── Type-specific sections ── */}
            {isMotor(p.policyType) && <MotorSection p={p} />}
            {isHome(p.policyType) && <HomeSection p={p} />}
            {isLife(p.policyType) && <LifeSection p={p} />}
            {isTravel(p.policyType) && <TravelSection p={p} />}

            {/* ── Universal sections ── */}
            {/* Insured Items / Members */}
            {items.length > 0 && (
              <div className="grid lg:grid-cols-3 gap-5">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <SectionTitle icon={isMotor(p.policyType) ? "🚗" : isHealth(p.policyType) ? "👥" : "📋"} title="Insured Items" />
                  <div className="space-y-4">
                    {items.map((m, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{m.name}</p>
                            <p className="text-slate-400 text-xs">
                              {m.type && <span>{m.type} · </span>}
                              {m.relation && <span>{m.relation}</span>}
                              {m.age ? <span> · Age {m.age}</span> : null}
                              {m.idNumber && <span> · {m.idNumber}</span>}
                            </p>
                          </div>
                          {m.totalCoverage > 0 && (
                            <div className="text-right">
                              <p className="font-display font-bold text-emerald-600 text-base">{fmtL(m.totalCoverage)}</p>
                              <p className="text-slate-400 text-[10px]">total cover</p>
                            </div>
                          )}
                        </div>
                        {m.baseCoverage > 0 && (
                          <CovBar label="Base Coverage" value={m.baseCoverage} total={m.totalCoverage || m.baseCoverage} colorClass="bg-blue-500" />
                        )}
                        {m.bonus > 0 && (
                          <CovBar label="Bonus" value={m.bonus} total={m.totalCoverage || m.baseCoverage} colorClass="bg-amber-400" />
                        )}
                      </div>
                    ))}
                  </div>
                  {p.nominee?.name && (
                    <div className="mt-4 p-3 rounded-xl bg-violet-50 border border-violet-200">
                      <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">Nominee</p>
                      <p className="text-sm text-slate-700 font-medium">
                        {p.nominee.name}{" "}
                        <span className="text-slate-400 font-normal">({p.nominee.relation})</span>
                        <span className="ml-2 text-violet-700 font-bold">{p.nominee.share}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Premium breakdown */}
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <SectionTitle icon="💳" title="Premium Breakdown" />
                  <div className="space-y-3 mb-4">
                    {([
                      { label: "Base Premium", value: p.premium?.base, prefix: "", colorClass: "text-slate-700" },
                      { label: "Add-ons Premium", value: p.premium?.addons, prefix: "+ ", colorClass: "text-amber-600" },
                      { label: "Discounts", value: p.premium?.discounts, prefix: "– ", colorClass: "text-emerald-600" },
                    ] as { label: string; value: number; prefix: string; colorClass: string }[]).map((row) => (
                      <div key={row.label} className="flex justify-between items-center py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-500">{row.label}</span>
                        <span className={`text-sm font-semibold ${row.colorClass}`}>{row.prefix}{fmtINR(row.value)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="font-semibold text-slate-800">Final Premium</span>
                    <span className="font-display text-xl font-bold text-blue-700">{fmtINR(p.premium?.final)}</span>
                  </div>
                  {p.taxBenefit > 0 && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <p className="text-xs text-emerald-600 font-semibold">💡 Tax Benefit</p>
                      <p className="text-sm font-bold text-emerald-700 mt-0.5">Claim up to {fmtINR(p.taxBenefit)} deduction</p>
                    </div>
                  )}
                  {donutSegments.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Coverage Composition</p>
                      <div className="flex items-center gap-3">
                        <DonutChart segments={donutSegments} total={p.totalEffectiveCoverage}
                          center={fmtL(p.totalEffectiveCoverage)} sub="per person" />
                        <div className="space-y-2 flex-1">
                          {donutSegments.map((s) => (
                            <div key={s.label}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                                <span className="text-xs text-slate-600">{s.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MiniBar value={s.value} max={p.totalEffectiveCoverage} />
                                <span className="text-xs font-bold text-slate-700 w-8 text-right">
                                  {p.totalEffectiveCoverage > 0 ? ((s.value / p.totalEffectiveCoverage) * 100).toFixed(0) : 0}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Projection */}
                {p.coverageProjection?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <SectionTitle icon="📈" title="Coverage Projection" />
                    {p.bonusType && <p className="text-slate-400 text-xs mb-4 leading-relaxed">{p.bonusType}</p>}
                    <div className="space-y-3">
                      {p.coverageProjection.map((row, i) => (
                        <div key={i}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-500">{row.year}</span>
                            <span className="font-semibold text-slate-700">{fmtL(row.amount)}</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(row.amount / maxProjection) * 100}%`, background: `hsl(${210 + i * 18}, 75%, ${55 - i * 3}%)` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <p className="text-xs text-amber-600 font-semibold">🎯 Maximum Potential Coverage</p>
                      <p className="font-display text-xl font-bold text-amber-700 mt-0.5">
                        {fmtL(p.coverageProjection[p.coverageProjection.length - 1]?.amount ?? 0)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Key Benefits & Waiting Periods */}
            {(p.keyBenefits?.length > 0 || p.waitingPeriods?.length > 0) && (
              <div className="grid lg:grid-cols-3 gap-5">
                {p.keyBenefits?.length > 0 && (
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <SectionTitle icon="✅" title="Coverage & Exclusions" />
                    <div className="grid sm:grid-cols-2 gap-2">
                      {p.keyBenefits.map((b, i) => <BenefitPill key={i} text={b.text} covered={b.covered} />)}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-5">
                  {p.waitingPeriods?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex-1">
                      <SectionTitle icon="⏳" title="Waiting Periods" />
                      <WaitingTimeline periods={p.waitingPeriods} />
                    </div>
                  )}
                  {(p.zoneRule || p.networkHospitals) && (
                    <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5 shadow-sm">
                      <SectionTitle icon="🌏" title={p.networkHospitals ? "Network & Zone" : "Zone Rule"} />
                      {p.zoneRule && <p className="text-sm text-slate-700 leading-relaxed mb-2">{p.zoneRule}</p>}
                      {p.networkHospitals && (
                        <p className="text-sm text-blue-700 font-semibold">🏥 {p.networkHospitals} network hospitals</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Add-ons, Premium Waiver, Quick Actions */}
            <div className="grid lg:grid-cols-3 gap-5">
              {p.addons?.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <SectionTitle icon="⚡" title="Active Add-Ons & Riders" />
                  <div className="flex flex-wrap gap-2">
                    {p.addons.map((a, i) => (
                      <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
                        ✓ {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {p.premiumWaiver && (
                <div className="bg-emerald-50 rounded-2xl border border-emerald-200 p-5 shadow-sm">
                  <SectionTitle icon="🎁" title="Premium Waiver Benefit" />
                  <p className="text-sm text-slate-700 leading-relaxed">{p.premiumWaiver}</p>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <SectionTitle icon="🔗" title="Quick Actions" />
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { icon: "📋", label: "All Policies", path: "/policies", color: "hover:bg-blue-100 border-blue-200 bg-blue-50" },
                    { icon: "⚖️", label: "Liabilities", path: "/liabilities", color: "hover:bg-red-100 border-red-200 bg-red-50" },
                    { icon: "🏠", label: "Dashboard", path: "/", color: "hover:bg-violet-100 border-violet-200 bg-violet-50" },
                    { icon: "📈", label: "Investments", path: "/stocks", color: "hover:bg-emerald-100 border-emerald-200 bg-emerald-50" },
                  ] as { icon: string; label: string; path: string; color: string }[]).map((a) => (
                    <Link key={a.label} to={a.path}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${a.color}`}>
                      <span className="text-2xl">{a.icon}</span>
                      <span className="text-slate-700 text-xs font-semibold text-center leading-tight">{a.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-center text-xs text-slate-400 pb-2">
              AI-generated summary · Powered by Gemini AI · Always refer to your official policy document for exact terms & conditions.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default PolicyDashboard;
