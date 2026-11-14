import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { X } from "lucide-react";

interface ToastAction {
  label: string;
  onClick: () => void | Promise<void>;
}

interface ToastItem {
  id: number;
  message: string;
  action?: ToastAction;
}

interface ToastValue {
  show: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, action?: ToastAction) => {
      const id = nextToastId++;
      setItems((current) => [...current, { id, message, action }]);
      window.setTimeout(
        () => dismiss(id),
        action ? 9000 : 4200,
      );
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-8"
        role="region"
        aria-live="polite"
        aria-label="Avisos"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-4 rounded-lg border border-line-strong bg-raised px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
          >
            <span className="text-sm leading-snug text-ink">{item.message}</span>
            <div className="flex shrink-0 items-center gap-1">
              {item.action ? (
                <button
                  onClick={() => {
                    void item.action?.onClick();
                    dismiss(item.id);
                  }}
                  className="rounded-md px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-ink underline decoration-line-strong underline-offset-4 hover:bg-panel"
                >
                  {item.action.label}
                </button>
              ) : null}
              <button
                onClick={() => dismiss(item.id)}
                aria-label="Cerrar aviso"
                className="flex h-7 w-7 items-center justify-center rounded-md text-dim hover:bg-panel hover:text-ink"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast debe usarse dentro de ToastProvider");
  return value;
}
