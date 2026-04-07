import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: ReactNode;
}

export function Input({ label, error, leftIcon, className, type, id, ...rest }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const resolvedType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="input-group">
      {label && (
        <label className="input-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="input-wrap">
        {leftIcon && <span className="input-icon">{leftIcon}</span>}
        <input
          id={id}
          type={resolvedType}
          className={clsx(
            'input',
            leftIcon && 'input--has-icon',
            (isPassword) && 'input--has-action',
            error && 'input--error',
            className
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="input-action"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && (
        <span className="input__error-msg" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
