/**
 * Core UI utility candidate extracted for OSS split PoC.
 * NOTE: dependency-free implementation for cross-package compile stability.
 */
export type ClassValue = string | number | null | undefined | false;

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ');
}
