import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function MarketingNav() {
  return (
    <Link to="/admin/marketing" className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-prime-muted transition hover:text-prime-ink">
      <ArrowLeft size={13} className="rtl:rotate-180" /> Marketing
    </Link>
  );
}
