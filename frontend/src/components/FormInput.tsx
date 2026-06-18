import React from 'react';

// ALL components defined at MODULE level — never inside another component.
// Defining helpers inside a component causes React to create a NEW component
// type every render → input unmounts/remounts → focus lost after every keystroke.

const ACCENT: Record<string, string> = {
  blue:    'focus:border-blue-500 focus:ring-blue-100',
  emerald: 'focus:border-emerald-500 focus:ring-emerald-100',
  amber:   'focus:border-amber-500 focus:ring-amber-100',
  indigo:  'focus:border-indigo-500 focus:ring-indigo-100',
  violet:  'focus:border-violet-500 focus:ring-violet-100',
  red:     'focus:border-red-500 focus:ring-red-100',
};
const BASE = `w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800
  text-sm outline-none focus:ring-2 transition-all placeholder-slate-400
  disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-50`;

type Accent = keyof typeof ACCENT;

interface FIProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string; col?: 1|2; accentColor?: Accent; hint?: string;
}
export const FormInput: React.FC<FIProps> = ({ label, col=1, accentColor='blue', hint, className='', ...rest }) => (
  <div className={col===2?'col-span-2':''}>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
      {label}{rest.required&&<span className="text-red-500 ml-0.5">*</span>}
    </label>
    <input className={`${BASE} ${ACCENT[accentColor]} ${className}`} {...rest}/>
    {hint&&<p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

interface FSProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string; options: [string,string][]; col?: 1|2; accentColor?: Accent;
}
export const FormSelect: React.FC<FSProps> = ({ label, options, col=1, accentColor='blue', className='', ...rest }) => (
  <div className={col===2?'col-span-2':''}>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
    <select className={`${BASE} ${ACCENT[accentColor]} ${className}`} {...rest}>
      {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
    </select>
  </div>
);

interface FTProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string; col?: 1|2; accentColor?: Accent;
}
export const FormTextarea: React.FC<FTProps> = ({ label, col=1, accentColor='blue', className='', ...rest }) => (
  <div className={col===2?'col-span-2':''}>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
    <textarea className={`${BASE} ${ACCENT[accentColor]} resize-none ${className}`} rows={rest.rows||3} {...rest}/>
  </div>
);

interface FFProps {
  label: string; col?: 1|2; accept?: string; hint?: string;
  fileName?: string; onChange: (f: File|null)=>void; accentColor?: Accent;
}
export const FormFile: React.FC<FFProps> = ({ label, col=1, accept='.pdf,.jpg,.jpeg,.png,.doc,.docx', hint, fileName, onChange }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  return (
    <div className={col===2?'col-span-2':''}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      <div onClick={()=>ref.current?.click()}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 border-dashed cursor-pointer transition-all text-sm
          ${fileName?'border-emerald-300 bg-emerald-50 text-emerald-700':'border-slate-200 bg-slate-50 text-slate-400 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600'}`}>
        <span className="text-lg flex-shrink-0">{fileName?'📎':'📤'}</span>
        <span className="truncate text-xs flex-1">{fileName||'Click to upload (PDF, JPG, PNG, DOC)'}</span>
        {fileName&&<button type="button" onClick={e=>{e.stopPropagation();onChange(null);if(ref.current)ref.current.value='';}}
          className="ml-auto text-red-400 hover:text-red-600 flex-shrink-0 text-base font-bold">×</button>}
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e=>onChange(e.target.files?.[0]??null)}/>
      {hint&&<p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
    </div>
  );
};

export default FormInput;
