import Link from "next/link";
import { FileText, AlertTriangle } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="sticky top-0 z-50 h-16 bg-white border-b border-[var(--ss-i-200)] shadow-[var(--ss-shadow)] flex items-center px-6 gap-6">
      <Link href="/ptm" className="flex items-center gap-2 font-display font-bold text-[var(--ss-i-900)]">
        <span className="w-8 h-8 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center text-white font-bold text-sm">S</span>
        <span className="hidden sm:inline">PTM Agent</span>
      </Link>

      <div className="flex items-center gap-1 ml-auto">
        <Link
          href="/ptm"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-[var(--ss-i-700)] hover:bg-[var(--ss-i-100)] transition-colors"
        >
          <FileText size={15} />
          Reports
        </Link>
        <Link
          href="/ptm/escalated"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-[var(--ss-i-700)] hover:bg-[var(--ss-i-100)] transition-colors"
        >
          <AlertTriangle size={15} />
          Escalated
        </Link>
      </div>
    </nav>
  );
}
