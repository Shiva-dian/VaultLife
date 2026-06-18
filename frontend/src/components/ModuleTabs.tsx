import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export const MODULE_TABS = [
  { path:'/dashboard',    icon:'📊', label:'Dashboard'     },
  { path:'/bank-accounts',icon:'🏦', label:'Bank Accounts' },
  { path:'/stocks',       icon:'📈', label:'Investments'   },
  { path:'/real-estate',  icon:'🏠', label:'Real Estate'   },
  { path:'/liabilities',  icon:'⚖️', label:'Liabilities'   },
  { path:'/policies',     icon:'🛡️', label:'Policies'      },
  { path:'/policy-dashboard', icon:'✨', label:'AI Analysis'  },
];

const ModuleTabs: React.FC<{ activePath?: string }> = ({ activePath }) => {
  const { pathname } = useLocation();
  const current = activePath || pathname;
  return (
    <div className="flex gap-1 mt-5 border-t border-white/10 pt-4 overflow-x-auto">
      {MODULE_TABS.map(tab => (
        <Link key={tab.path} to={tab.path}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0
            ${current===tab.path?'bg-white text-blue-900 shadow-sm':'text-white/60 hover:text-white hover:bg-white/10'}`}>
          <span>{tab.icon}</span>{tab.label}
        </Link>
      ))}
    </div>
  );
};
export default ModuleTabs;
