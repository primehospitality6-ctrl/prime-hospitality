import { clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Custom sizes from tailwind.config.js, otherwise twMerge reads them as colours and drops them next to text-prime-*
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['display-2xl', 'display-xl', 'display-lg', 'display-md'] }] } },
});

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDateLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
