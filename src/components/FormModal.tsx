import React from "react";

interface FormModalProps {
  title: string
  children: React.ReactNode
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
  submitText?: string
}

const FormModal: React.FC<FormModalProps> = ({
  title,
  children,
  onClose,
  onSubmit,
  submitText = "Lưu"
}) => {

  return (

    <div className="modal-overlay">

      <div className="modal">

        <div className="modal-head">

          <h2>{title}</h2>

          <button
            className="modal-close"
            type="button"
            onClick={onClose}
          >
            ✕
          </button>

        </div>

        <form className="modal-form" onSubmit={onSubmit}>

          <div className="modal-body">

            {children}

          </div>

          <div className="form-actions">

            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
            >
              Huỷ
            </button>

            <button
              type="submit"
              className="btn-save"
            >
              {submitText}
            </button>

          </div>

        </form>

      </div>

    </div>

  )

}

export default FormModal