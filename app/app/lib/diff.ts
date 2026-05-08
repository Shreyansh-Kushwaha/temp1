/**
 * Word-level diff. Returns ordered ops: equal | add | remove.
 * O(N*M) longest-common-subsequence — fine for paragraphs.
 */

export type DiffOp = { type: "equal" | "add" | "remove"; tokens: string[] };

function tokenize(text: string): string[] {
  // Keep punctuation attached so re-rendering reads naturally.
  return text.split(/(\s+)/).filter(Boolean);
}

export function diffWords(before: string, after: string): DiffOp[] {
  const a = tokenize(before);
  const b = tokenize(after);
  const n = a.length;
  const m = b.length;

  // LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const ops: DiffOp[] = [];
  let i = n;
  let j = m;
  const push = (type: DiffOp["type"], token: string) => {
    const last = ops[0];
    if (last && last.type === type) last.tokens.unshift(token);
    else ops.unshift({ type, tokens: [token] });
  };

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      push("equal", a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      push("remove", a[i - 1]);
      i--;
    } else {
      push("add", b[j - 1]);
      j--;
    }
  }
  while (i > 0) {
    push("remove", a[i - 1]);
    i--;
  }
  while (j > 0) {
    push("add", b[j - 1]);
    j--;
  }
  return ops;
}

/**
 * Compare two report drafts field-by-field. Returns one entry per text-bearing field.
 * Fields without text in either version are skipped.
 */
export interface FieldDiff {
  field: string;
  label: string;
  ops: DiffOp[];
  changed: boolean;
}

const FIELD_MAP: { key: string; label: string; pick: (d: Record<string, unknown>) => string }[] = [
  { key: "student_performance.narrative", label: "Overall Performance", pick: (d) => str(get(d, "student_performance.narrative")) },
  { key: "confidence_trend.observations", label: "Confidence Trend", pick: (d) => str(get(d, "confidence_trend.observations")) },
  { key: "homework_and_effort.narrative", label: "Homework & Effort", pick: (d) => str(get(d, "homework_and_effort.narrative")) },
  { key: "milestone_of_month.description", label: "Milestone", pick: (d) => str(get(d, "milestone_of_month.description")) },
  { key: "encouragement_message", label: "Encouragement Message", pick: (d) => str(get(d, "encouragement_message")) },
  { key: "learning_coverage.topics", label: "Learning Coverage", pick: (d) => arr(get(d, "learning_coverage.topics")) },
  { key: "strengths.items", label: "Key Strengths", pick: (d) => arr(get(d, "strengths.items")) },
  { key: "growth_areas.items", label: "Areas to Grow", pick: (d) => arr(get(d, "growth_areas.items")) },
  { key: "parent_action_items.items", label: "What You Can Do at Home", pick: (d) => arr(get(d, "parent_action_items.items")) },
  { key: "next_steps.topics", label: "Next Steps", pick: (d) => arr(get(d, "next_steps.topics")) },
  { key: "recommended_resources.items", label: "Recommended Resources", pick: (d) => arr(get(d, "recommended_resources.items")) },
  { key: "audio_script", label: "Audio Summary Script", pick: (d) => str(get(d, "audio_script")) },
];

function get(o: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, o);
}
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function arr(v: unknown): string {
  if (!Array.isArray(v)) return "";
  return v.filter((x) => typeof x === "string").join("\n");
}

export function diffDrafts(before: unknown, after: unknown): FieldDiff[] {
  const a = (before ?? {}) as Record<string, unknown>;
  const b = (after ?? {}) as Record<string, unknown>;
  return FIELD_MAP.map(({ key, label, pick }) => {
    const av = pick(a);
    const bv = pick(b);
    const ops = diffWords(av, bv);
    const changed = ops.some((op) => op.type !== "equal");
    return { field: key, label, ops, changed };
  });
}
