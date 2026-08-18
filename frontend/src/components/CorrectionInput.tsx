import { useEffect, useRef, useState, type ChangeEvent } from "react";

interface CorrectionInputProps {
  value: number;
  onChange: (value: number) => void;
}

function formatSigned(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

export function CorrectionInput({ value, onChange }: CorrectionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState(5);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    setAmount(Number(event.target.value) || 0);
  }

  function handleAdd() {
    onChange(value + amount);
  }

  function handleSubtract() {
    onChange(value - amount);
  }

  return (
    <div className="correction-col" ref={containerRef}>
      <button
        type="button"
        className={`correction-btn${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Manual correction"
        title="Manual correction"
      >
        <span className="correction-btn-icon" aria-hidden="true">
          &plusmn;
        </span>
        <span className="correction-btn-label">Corr</span>
        <span className="correction-btn-value">{formatSigned(value)}m</span>
      </button>

      {isOpen && (
        <div className="correction-popover" role="menu">
          <div className="correction-popover-heading">Adjust correction</div>
          <div className="correction-popover-row">
            <button type="button" className="correction-popover-btn" onClick={handleSubtract} aria-label="Subtract minutes">
              &minus;
            </button>
            <div className="correction-popover-input-wrap">
              <input
                type="number"
                className="correction-popover-input"
                value={amount}
                min={0}
                step={5}
                aria-label="Correction amount (minutes)"
                onChange={handleAmountChange}
              />
              <span className="correction-popover-unit">min</span>
            </div>
            <button type="button" className="correction-popover-btn" onClick={handleAdd} aria-label="Add minutes">
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
