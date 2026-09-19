import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // active:scale is on every variant (not just default) — a quick,
  // uniform "press" on every button in the app, the actual button
  // animation brainstormed during the Bloom rebuild (see button's own
  // hover-lift below, from that same pass) but never followed up with a
  // press state. Kept small (2%) and on transform/shadow/colors only
  // (not `transition-all`'s everything) so it reads as tactile rather
  // than bouncy, and costs nothing extra to composite.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[transform,box-shadow,background-color,color,border-color] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // The lift + tinted shadow is reserved for the primary action on
        // a screen — applying it to every button variant would make
        // nothing stand out as *the* button to press.
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_hsl(var(--shadow-tint)/0.3),0_4px_14px_-4px_hsl(var(--shadow-tint)/0.4)] hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_hsl(var(--shadow-tint)/0.35),0_10px_24px_-6px_hsl(var(--shadow-tint)/0.5)] active:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
