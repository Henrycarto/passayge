import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** The shadcn `cn` helper wardkit's components import from `@/lib/utils`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
