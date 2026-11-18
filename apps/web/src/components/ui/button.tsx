import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // active:scale is on every variant (not just default) — a quick,
  // uniform "press" on every button in the app, the actual button
  // animation brainstormed during the Bloom rebuild (see button's own
  // hover-lift below, from that same pass) but never followed up with a
  // press state. Kept small (2%) and on translate/scale/shadow/colors only
  // (not `transition-all`'s everything) so it reads as tactile rather
  // than bouncy, and costs nothing extra to composite. Tailwind v4 lifts
  // and presses with the separate `translate` and `scale` properties, not
  // `transform`, so those are what must be listed here to ease at all.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[translate,scale,box-shadow,background-color,color,border-color] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // The primary action on a screen looks like the stamp (#332): a
        // darker strip under it, as if lifted off the page, and pressing
        // pushes it down onto that strip. It replaces the old hover lift and
        // light sweep, so only this variant has it and nothing else
        // competes as *the* button to press. The press is a translate, not
        // the shared active:scale, so the button lands on its edge.
        default:
          "bg-primary text-primary-foreground shadow-[0_3px_0_0_var(--primary-edge)] hover:bg-primary/90 active:scale-100 active:translate-y-[3px] active:shadow-[0_0_0_0_var(--primary-edge)] disabled:shadow-none",
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
        icon: "size-9 shrink-0",
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
