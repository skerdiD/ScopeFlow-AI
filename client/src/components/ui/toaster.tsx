import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: "rounded-2xl border shadow-lg",
          title: "text-sm font-semibold",
          description: "text-sm"
        }
      }}
    />
  );
}
