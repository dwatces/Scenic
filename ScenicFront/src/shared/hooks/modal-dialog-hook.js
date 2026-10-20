import { useEffect, useEffectEvent, useRef } from "react";

/**
 * Open a native <dialog> as a modal while the component is mounted.
 *
 * showModal() puts it in the top layer (above the fixed header), makes the
 * rest of the page inert and moves focus into it. Escape and a click on
 * the backdrop call onClose; the parent then unmounts the dialog, and
 * focus goes back to whatever had it before (the button that opened it),
 * if that is still on the page.
 * @param {() => void} onClose
 * @returns {import("react").RefObject<HTMLDialogElement>}
 */
export function useModalDialog(onClose) {
  const ref = useRef(null);
  const close = useEffectEvent(() => onClose());

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    if (!dialog.open) dialog.showModal();

    // Escape fires "cancel": keep React in charge of closing.
    const onCancel = (event) => {
      event.preventDefault();
      close();
    };
    // The dialog box has no padding, so a click whose target is the
    // <dialog> itself landed on the backdrop.
    const onClick = (event) => {
      if (event.target === dialog) close();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("click", onClick);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("click", onClick);
      if (dialog.open) dialog.close();
      if (opener && opener !== document.body && opener.isConnected) opener.focus();
    };
  }, []);

  return ref;
}
