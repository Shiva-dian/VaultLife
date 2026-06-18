import React, { useRef, useEffect, KeyboardEvent, ClipboardEvent } from 'react';

interface OTPInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  hasError?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}

const OTPInput: React.FC<OTPInputProps> = ({
  value, onChange, length = 6, hasError = false, autoFocus = false, disabled = false
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
  }, [autoFocus]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return;
    const newVal = digits.map((d, i) => (i === index ? char.slice(-1) : d)).join('');
    onChange(newVal);
    if (char && index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputsRef.current[index - 1]?.focus();
        const newVal = digits.map((d, i) => (i === index - 1 ? '' : d)).join('');
        onChange(newVal);
      } else {
        const newVal = digits.map((d, i) => (i === index ? '' : d)).join('');
        onChange(newVal);
      }
    }
    if (e.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, '').slice(0, length));
    const nextEmpty = pasted.length < length ? pasted.length : length - 1;
    inputsRef.current[nextEmpty]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" role="group" aria-label="OTP input">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputsRef.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={`otp-digit ${digit ? 'filled' : ''} ${hasError ? 'error' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  );
};

export default OTPInput;
