import React from "react";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  required?: boolean;
  error?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, required, error, ...props }) => {
  return (
    <div className="field">
      <label className="label">
        {label} {required && <span style={{ color: "red" }}>*</span>}
      </label>
      <input className={`input ${error ? "error" : ""}`} {...props} />
      {error && <div className="error-text">{error}</div>}
    </div>
  );
};
