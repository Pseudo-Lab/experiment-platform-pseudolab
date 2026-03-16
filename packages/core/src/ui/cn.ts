import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Core UI utility candidate extracted for OSS split PoC.
 * NOTE: Not wired yet. Kept in parallel to avoid behavior change.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
