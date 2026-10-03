import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const buttonStyles = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none',
    'transition-[transform,background-color,color,border-color] duration-150 ease-[var(--ease-out)]',
    'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        // Ink, not cobalt: cobalt means YES in this product.
        primary: 'bg-ink text-bg hover:bg-ink-2',
        yes: 'bg-yes text-on-yes hover:bg-yes-strong',
        no: 'bg-no text-on-no hover:bg-no-strong',
        secondary: 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        danger: 'border border-danger/40 bg-surface text-danger hover:bg-danger-soft',
      },
      size: {
        sm: 'h-7 rounded-md px-2.5 text-sm',
        md: 'h-9 rounded-md px-3.5 text-base',
        lg: 'h-11 rounded-md px-5 text-md',
        icon: 'size-8 rounded-md',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />
})
