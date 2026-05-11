"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, BookOpen, Calendar, Users, AlertCircle, RefreshCw, Search, Loader2 } from "lucide-react";

import Navbar from "@/app/components/Navbar";
import { api, type StudentSummary } from "@/app/lib/api";
import { getAuth } from "@/app/lib/auth";

function lastSessionLabel(iso?: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

export default function GeneratePage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<string[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (auth?.role === "teacher" && auth.teacher_name) {
      // Skip the dropdown step entirely — go straight to this teacher's students
      setSelectedTeacher(auth.teacher_name);
      setLoadingTeachers(false);
      return;
    }
    setIsAdminUser(true);
    api.teachers.list()
      .then((data) => setTeachers(data.map((t) => t.teacher_name).filter(Boolean).sort()))
      .catch(() => {})
      .finally(() => setLoadingTeachers(false));
  }, []);

  useEffect(() => {
    if (!selectedTeacher) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    setError(null);
    api.students.list({ teacher_name: selectedTeacher })
      .then(setStudents)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load students"))
      .finally(() => setLoadingStudents(false));
  }, [selectedTeacher]);

  const filtered = students.filter((s) =>
    !search || s.student_name.toLowerCase().includes(search.toLowerCase()) ||
    s.subject.toLowerCase().includes(search.toLowerCase())
  );

  function handleStudentClick(s: StudentSummary) {
    const qs = new URLSearchParams({
      teacher_name: selectedTeacher,
      student_name: s.student_name,
      subject: s.subject,
    });
    router.push(`/ptm/students/${encodeURIComponent(s.student_id)}?${qs}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ss-bg)" }}>
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-6 md:px-8 md:py-8">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1
            className="text-2xl md:text-3xl font-extrabold text-[var(--ss-i-900)]"
            style={{ fontFamily: "var(--font-jakarta)" }}
          >
            Generate Report
          </h1>
          <p className="mt-1 text-sm text-[var(--ss-i-400)]">
            Select a teacher to see all their students, then pick sessions to generate a report.
          </p>
        </div>

        {/* Controls — admin can pick any teacher; teachers are auto-scoped */}
        {isAdminUser ? (
          <div className="mb-6 md:mb-8">
            <div className="w-full sm:max-w-xs">
              <label className="block text-xs font-semibold text-[var(--ss-i-500)] uppercase tracking-wide mb-1.5">
                Teacher
              </label>
              <div className="relative">
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  disabled={loadingTeachers}
                  className="w-full appearance-none bg-white border border-[var(--ss-i-200)] rounded-2xl px-4 py-3 pr-10 text-sm font-semibold text-[var(--ss-i-900)] shadow-[var(--ss-shadow)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition-all disabled:opacity-60"
                  style={{ fontFamily: "var(--font-jakarta)" }}
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ss-i-400)] pointer-events-none" />
              </div>
            </div>
          </div>
        ) : selectedTeacher ? (
          <div className="mb-8 inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-[var(--ss-o-50)] border border-[var(--ss-o-200)]">
            <span className="w-7 h-7 rounded-full bg-[var(--ss-o-500)] flex items-center justify-center shadow-[var(--ss-shadow-brand)]">
              <span className="text-white font-bold text-[10px]" style={{ fontFamily: "var(--font-jakarta)" }}>
                {selectedTeacher.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--ss-o-600)]">Your students</p>
              <p className="text-sm font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
                {selectedTeacher}
              </p>
            </div>
          </div>
        ) : null}

        {/* No teacher selected — only meaningful for admin */}
        {!selectedTeacher && !loadingTeachers && isAdminUser && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--ss-o-50)] flex items-center justify-center mb-4">
              <Users size={28} className="text-[var(--ss-o-400)]" />
            </div>
            <h2 className="text-lg font-semibold text-[var(--ss-i-700)]" style={{ fontFamily: "var(--font-jakarta)" }}>
              Select a teacher to begin
            </h2>
            <p className="text-sm text-[var(--ss-i-400)] mt-1 max-w-xs">
              Choose a teacher from the dropdown to see all their students and past sessions.
            </p>
          </div>
        )}

        {/* Student grid */}
        {selectedTeacher && (
          <>
            {/* Search */}
            {!loadingStudents && students.length > 0 && (
              <div className="relative mb-5 w-full sm:max-w-sm">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ss-i-300)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students or subjects…"
                  className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-[var(--ss-i-200)] bg-white text-sm text-[var(--ss-i-900)] placeholder-[var(--ss-i-300)] shadow-[var(--ss-shadow)] focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)] focus:border-[var(--ss-o-400)] transition-all"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-6 bg-white rounded-2xl border-l-4 border-l-[var(--ss-error)] border border-[var(--ss-i-200)] p-5 shadow-[var(--ss-shadow)] flex items-start gap-4">
                <AlertCircle size={18} className="text-[var(--ss-error)] mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[var(--ss-i-900)]">Failed to load students</p>
                  <p className="text-xs text-[var(--ss-i-400)] mt-0.5">{error}</p>
                </div>
                <button
                  onClick={() => setSelectedTeacher(selectedTeacher)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[var(--ss-i-200)] text-[var(--ss-i-600)] hover:bg-[var(--ss-i-100)] transition-colors"
                >
                  <RefreshCw size={11} />
                  Retry
                </button>
              </div>
            )}

            {/* Skeletons */}
            {loadingStudents && (
              <>
                <FetchingBanner teacher={selectedTeacher} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-[var(--ss-i-200)] p-5 shadow-[var(--ss-shadow)] animate-pulse">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-[var(--ss-i-100)]" />
                        <div className="flex-1">
                          <div className="h-4 w-28 rounded bg-[var(--ss-i-100)] mb-1.5" />
                          <div className="h-3 w-16 rounded bg-[var(--ss-i-100)]" />
                        </div>
                      </div>
                      <div className="h-3 w-20 rounded bg-[var(--ss-i-100)] mb-2" />
                      <div className="h-8 w-full rounded-full bg-[var(--ss-i-100)] mt-4" />
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Cards */}
            {!loadingStudents && !error && (
              filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-[var(--ss-i-200)]">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--ss-o-50)] flex items-center justify-center mb-4">
                    <Users size={24} className="text-[var(--ss-o-500)]" />
                  </div>
                  <h2 className="text-lg font-semibold text-[var(--ss-i-900)]" style={{ fontFamily: "var(--font-jakarta)" }}>
                    {search ? "No students match your search" : "No students found"}
                  </h2>
                  <p className="text-sm text-[var(--ss-i-400)] mt-1 max-w-xs">
                    {search ? "Try a different name or subject." : "This teacher has no recorded sessions in the database."}
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-medium text-[var(--ss-i-400)] mb-4">
                    {filtered.length} student{filtered.length !== 1 ? "s" : ""} · {selectedTeacher}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((s) => (
                      <StudentCard key={s.student_id} student={s} onClick={() => handleStudentClick(s)} />
                    ))}
                  </div>
                </>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}

function FetchingBanner({ teacher }: { teacher: string }) {
  const messages = [
    `Fetching ${teacher}'s students…`,
    "Loading class details…",
    "Pulling recent sessions…",
    "Almost there…",
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % messages.length), 1500);
    return () => clearInterval(id);
  }, [messages.length]);

  return (
    <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--ss-o-50)] border border-[var(--ss-o-200)] shadow-[var(--ss-shadow)]">
      <Loader2 size={16} className="text-[var(--ss-o-500)] animate-spin shrink-0" />
      <p
        key={idx}
        className="text-sm font-semibold text-[var(--ss-o-700)] animate-[fadeIn_400ms_ease-out]"
        style={{ fontFamily: "var(--font-jakarta)" }}
      >
        {messages[idx]}
      </p>
      <span className="ml-auto flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)] animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)] animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ss-o-400)] animate-bounce" style={{ animationDelay: "300ms" }} />
      </span>
    </div>
  );
}

function StudentCard({ student, onClick }: { student: StudentSummary; onClick: () => void }) {
  const initials = student.student_name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const lastLabel = lastSessionLabel(student.last_session);

  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-[var(--ss-i-200)] p-5 shadow-[var(--ss-shadow)] hover:border-[var(--ss-o-300)] hover:shadow-[var(--ss-shadow-brand)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--ss-o-300)]"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-[var(--ss-o-100)] flex items-center justify-center shrink-0">
          <span className="text-[var(--ss-o-700)] font-bold text-sm" style={{ fontFamily: "var(--font-jakarta)" }}>
            {initials}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--ss-i-900)] text-sm truncate" style={{ fontFamily: "var(--font-jakarta)" }}>
            {student.student_name}
          </p>
          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-[var(--ss-i-100)] text-[var(--ss-i-600)] text-xs font-medium">
            {student.subject}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-[var(--ss-i-400)]">
        <span className="flex items-center gap-1">
          <BookOpen size={11} className="shrink-0" />
          {student.session_count} session{student.session_count !== 1 ? "s" : ""}
        </span>
        {lastLabel && (
          <span className="flex items-center gap-1">
            <Calendar size={11} className="shrink-0" />
            {lastLabel}
          </span>
        )}
      </div>

      <div className="mt-4 w-full py-2 rounded-full bg-[var(--ss-o-50)] text-[var(--ss-o-600)] text-xs font-semibold text-center group-hover:bg-[var(--ss-o-500)] group-hover:text-white transition-colors">
        Select sessions & generate
      </div>
    </button>
  );
}
