import { useEffect, useRef, type ReactNode } from "react";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** Tailwind max-width class for the card. */
  maxWidth?: string;
  label?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

/** Shared modal shell: closes on Escape and on overlay (backdrop) click; traps
 * focus while open and restores focus to the trigger on close (a11y). The
 * `.modal-overlay` / `.modal-card` classes drive the print stylesheet. */
export function Modal({ onClose, children, maxWidth = "max-w-2xl", label }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    // Move focus into the dialog.
    const first = card?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? card)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
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
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`modal-card w-full ${maxWidth} rounded-lg bg-white shadow-xl outline-none`}
      >
        {children}
      </div>
    </div>
  );
}
