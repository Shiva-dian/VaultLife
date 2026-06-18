import React from 'react';

interface Props { password: string }

const getStrength = (p: string): { score: number; label: string; color: string; bg: string } => {
  let score = 0;
  if (p.length >= 8)  score++;
  if (p.length >= 12) score++;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;

  if (score <= 1) return { score, label: 'Weak',      color: 'bg-red-500',    bg: 'text-red-500' };
  if (score <= 2) return { score, label: 'Fair',      color: 'bg-orange-400', bg: 'text-orange-500' };
  if (score <= 3) return { score, label: 'Good',      color: 'bg-yellow-400', bg: 'text-yellow-600' };
  if (score <= 4) return { score, label: 'Strong',    color: 'bg-blue-500',   bg: 'text-blue-600' };
  return               { score, label: 'Very Strong', color: 'bg-emerald-500', bg: 'text-emerald-600' };
};

const PasswordStrength: React.FC<Props> = ({ password }) => {
  if (!password) return null;
  const { score, label, color, bg } = getStrength(password);

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`strength-bar flex-1 ${i < score ? color : 'bg-slate-200'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${bg}`}>{label} password</p>
    </div>
  );
};

export default PasswordStrength;
