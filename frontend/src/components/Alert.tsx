import React from 'react';

type AlertType = 'error' | 'success' | 'info' | 'warning';

interface AlertProps {
  type: AlertType;
  message: string;
  onClose?: () => void;
}

const configs: Record<AlertType, { bg: string; border: string; icon: string; text: string }> = {
  error:   { bg: 'bg-red-50',    border: 'border-red-300',    icon: '⚠️', text: 'text-red-700' },
  success: { bg: 'bg-green-50',  border: 'border-green-300',  icon: '✅', text: 'text-green-700' },
  info:    { bg: 'bg-blue-50',   border: 'border-blue-300',   icon: 'ℹ️', text: 'text-blue-700' },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-300', icon: '⚠️', text: 'text-yellow-700' },
};

const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const c = configs[type];
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border ${c.bg} ${c.border} animate-fade-in`}>
      <span className="text-base flex-shrink-0 mt-0.5">{c.icon}</span>
      <p className={`text-xs leading-relaxed flex-1 font-medium ${c.text}`}>{message}</p>
      {onClose && (
        <button onClick={onClose} className={`${c.text} opacity-60 hover:opacity-100 text-base`}>×</button>
      )}
    </div>
  );
};

export default Alert;
