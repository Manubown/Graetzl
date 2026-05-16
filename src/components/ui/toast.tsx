"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast — transient feedback ("Pin gespeichert", "Eintrag gelöscht").
 *
 * Backed by Radix Toast: inherits `role="status"` + `aria-live="polite"`,
 * keyboard dismiss (Esc / F8 to focus the viewport), and swipe-to-dismiss
 * on touch devices.
 *
 * Mounting: `<Toaster />` is mounted once in `app/layout.tsx`. Anywhere
 * in the tree, call `useToast().toast({ title, description?, variant? })`.
 * The hook reads/writes a module-level store that `<Toaster />` subscribes
 * to — no React context, no provider wrapping required at call sites.
 */

// ---------------------------------------------------------------------------
// Radix-backed presentational primitives.
// ---------------------------------------------------------------------------

export const ToastProvider = ToastPrimitive.Provider;

export const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4",
      "sm:bottom-4 sm:right-4 sm:top-auto sm:flex-col sm:max-w-[420px]",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

const toastVariants = cva(
  cn(
    "group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 pr-8 shadow-lg",
    "duration-[var(--motion-default)] ease-[var(--motion-ease)]",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-right-full",
    "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
    "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
    "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=end]:animate-out",
  ),
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        destructive:
          "border-primary/50 bg-primary text-primary-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(toastVariants({ variant }), className)}
    {...props}
  />
));
Toast.displayName = ToastPrimitive.Root.displayName;

export const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitive.Title.displayName;

export const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitive.Description.displayName;

export const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    aria-label="Schließen"
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/60",
      "transition-colors duration-[var(--motion-fast)]",
      "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]",
      "group-[.destructive]:text-primary-foreground/80 group-[.destructive]:hover:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
));
ToastClose.displayName = ToastPrimitive.Close.displayName;

export const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-transparent px-3 text-sm font-medium",
      "transition-colors duration-[var(--motion-fast)]",
      "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "focus-visible:ring-[var(--accent)] dark:focus-visible:ring-[var(--primary)]",
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = ToastPrimitive.Action.displayName;

// ---------------------------------------------------------------------------
// Module-level toast store + useToast hook + <Toaster /> mount.
// ---------------------------------------------------------------------------

type ToastVariant = "default" | "destructive";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Override the default 5s auto-dismiss. */
  duration?: number;
}

interface InternalToast extends ToastOptions {
  id: string;
  open: boolean;
}

type Listener = (toasts: InternalToast[]) => void;

const TOAST_LIMIT = 3;
const TOAST_DEFAULT_DURATION_MS = 5000;

let toastCounter = 0;
let toastState: InternalToast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toastState);
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function addToast(opts: ToastOptions) {
  const id = `t${++toastCounter}`;
  const next: InternalToast = { ...opts, id, open: true };
  toastState = [next, ...toastState].slice(0, TOAST_LIMIT);
  emit();
  return id;
}

function dismissToast(id: string) {
  toastState = toastState.map((t) => (t.id === id ? { ...t, open: false } : t));
  emit();
}

function removeToast(id: string) {
  toastState = toastState.filter((t) => t.id !== id);
  emit();
}

/**
 * useToast — call `toast({ title, description?, variant? })` from any
 * client component. The `<Toaster />` mounted in `app/layout.tsx`
 * renders them.
 */
export function useToast() {
  const [toasts, setToasts] = React.useState<InternalToast[]>(toastState);
  React.useEffect(() => subscribe(setToasts), []);
  return {
    toasts,
    toast: React.useCallback(
      (opts: ToastOptions) => ({ id: addToast(opts), dismiss: (id: string) => dismissToast(id) }),
      [],
    ),
    dismiss: dismissToast,
  };
}

/**
 * <Toaster /> — mount once at the root of the app. Subscribes to the
 * module-level toast store and renders any active toasts inside a
 * Radix ToastProvider.
 */
export function Toaster() {
  const { toasts } = useToast();
  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, title, description, variant, duration, open }) => (
        <Toast
          key={id}
          variant={variant}
          open={open}
          duration={duration ?? TOAST_DEFAULT_DURATION_MS}
          onOpenChange={(o) => {
            if (!o) {
              dismissToast(id);
              // Match Radix's exit animation (~motion-default) before drop.
              setTimeout(() => removeToast(id), 250);
            }
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{title}</ToastTitle>
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
