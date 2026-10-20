import { useId } from "react";

import { useModalDialog } from "../../hooks/modal-dialog-hook";
import "./Modal.css";

const ModalDialog = ({ onCancel, header, footer, children, className, footerClass }) => {
  const ref = useModalDialog(() => onCancel && onCancel());
  const headingId = useId();
  return (
    <dialog ref={ref} className={`modal ${className || ""}`.trim()} aria-labelledby={headingId}>
      <div className="modal__header">
        <h2 id={headingId}>{header}</h2>
      </div>
      <div className="modal__content">{children}</div>
      {footer && <div className={`modal__footer ${footerClass || ""}`.trim()}>{footer}</div>}
    </dialog>
  );
};

/**
 * A modal dialog (native <dialog>): labelled by its heading, closed by
 * Escape, a backdrop click or a footer button (through onCancel), and
 * focus returns to the button that opened it. Renders nothing while
 * `show` is false.
 */
const Modal = ({ show, ...props }) => (show ? <ModalDialog {...props} /> : null);

export default Modal;
