import { useModalDialog } from "../../hooks/modal-dialog-hook";
import "./SideDrawer.css";

/**
 * The small-screen menu: a modal <dialog> sliding in from the left, with
 * its own heading and Close button. Escape, a backdrop click, Close or
 * choosing a link closes it (the parent unmounts it).
 */
const SideDrawer = ({ id, onClose, children }) => {
  const ref = useModalDialog(onClose);
  return (
    <dialog ref={ref} id={id} className="side-drawer" aria-labelledby={`${id}-heading`}>
      <div className="side-drawer__header">
        <h2 id={`${id}-heading`}>Menu</h2>
        <button
          type="button"
          className="side-drawer__close"
          aria-label="Close menu"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {children}
    </dialog>
  );
};

export default SideDrawer;
