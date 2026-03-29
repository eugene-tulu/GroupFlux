import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as currency with appropriate suffix (K, M, B, T)
 * Examples:
 *   500 -> KES 500
 *   1500 -> KES 1.5K
 *   2500000 -> KES 2.5M
 *   1000000000 -> KES 1B
 */
export function formatCurrency(value: number, currency = 'KES'): string {
  if (value >= 1_000_000_000) {
    return `${currency} ${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`
  }
  if (value >= 1_000_000) {
    return `${currency} ${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (value >= 1_000) {
    return `${currency} ${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  }
  return `${currency} ${value.toLocaleString()}`
}
