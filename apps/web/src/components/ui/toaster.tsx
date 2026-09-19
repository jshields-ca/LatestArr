import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { DEFAULT_DURATION, useToast } from "@/components/ui/use-toast";

/**
 * Mounted once near the app root (see App.tsx). Every page calls the
 * `toast()` function from use-toast.ts directly — this component only
 * renders whatever's currently in that shared store.
 */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    // This is only Radix's fallback for a toast that didn't set its own
    // `duration` — every toast() call already does (see use-toast.ts's
    // DEFAULT_DURATION), so in practice this and that always agree.
    <ToastProvider duration={DEFAULT_DURATION}>
      {toasts.map(({ id, title, description, action, variant, ...props }) => (
        <Toast
          key={id}
          variant={variant}
          onOpenChange={(open) => {
            if (!open) dismiss(id);
          }}
          {...props}
        >
          {title ? <ToastTitle>{title}</ToastTitle> : null}
          {description ? <ToastDescription>{description}</ToastDescription> : null}
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
