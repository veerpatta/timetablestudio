import { useEffect, type ReactNode } from "react";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class for the card. */
  maxWidth?: string;
  label?: string;
}

/** Shared modal shell: closes on Escape and on overlay (backdrop) click.
 * The `.modal-overlay` / `.modal-card` classes drive the print stylesheet. */
export function Modal({ onClose, children, maxWidth = "max-w-2xl", label }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay fixed inset-0 z-20 flex items-start justify-center overflow-auto bg-black/40 p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal-card w-full ${maxWidth} rounded-lg bg-white shadow-xl`}>{children}</div>
    </div>
  );
}
