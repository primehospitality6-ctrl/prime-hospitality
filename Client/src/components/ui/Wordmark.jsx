import { subBrand } from '../../theme/brand';
import { cn } from '../../utils/cn';

/** Words the guidelines don't split break every four letters; a lone last letter joins the line above */
function syllablesOf(word) {
  const known = subBrand(word);
  if (known) return known.syllables;
  const letters = String(word || '').toUpperCase().replace(/\s+/g, '');
  if (letters.length <= 5) return [letters];
  const parts = [];
  for (let i = 0; i < letters.length; i += 4) parts.push(letters.slice(i, i + 4));
  if (parts.length > 1 && parts.at(-1).length < 2) parts[parts.length - 2] += parts.pop();
  return parts;
}

/**
 * The brand's watermark: a word stacked in syllables (HOSP / ITAL / ITY), Montserrat Medium.
 * Decorative — always aria-hidden; size and colour come from className.
 */
export default function Wordmark({ word = 'Hospitality', syllables, className, style }) {
  const lines = syllables || syllablesOf(word);
  return (
    <span aria-hidden className={cn('prime-wordmark', className)} style={style} dir="ltr">
      {lines.map((line, i) => (
        <span key={`${line}-${i}`}>{line}</span>
      ))}
    </span>
  );
}
