/**
 * Curated bank of copilot prompts a teacher might want to ask about a
 * student. Grouped by intent so the UI can show a categorized browser.
 *
 * Quick chips (shown by default before any chat) come from QUICK_PROMPTS.
 * The full categorized list is in PROMPT_CATEGORIES.
 */

export interface PromptCategory {
  id: string;
  label: string;
  /** Short Lucide icon name — looked up in CopilotPanel via a small map. */
  icon:
    | "TrendingUp"
    | "Sparkles"
    | "Target"
    | "Users"
    | "AlertCircle"
    | "BookOpen"
    | "Award"
    | "MessageSquare"
    | "Calendar"
    | "BarChart3"
    | "Lightbulb"
    | "Heart";
  prompts: string[];
}

export const QUICK_PROMPTS: string[] = [
  "What changed this month?",
  "What are the weak areas?",
  "Top 3 strengths right now",
  "How should parents help at home?",
  "Any risk signals to flag?",
];

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: "performance",
    label: "Performance & Mastery",
    icon: "TrendingUp",
    prompts: [
      "How is the student performing overall?",
      "Which concepts has the student mastered?",
      "Which concepts is the student still struggling with?",
      "Compare this month's performance to last month",
      "Has the student's confidence improved over time?",
      "Are grades trending up or down?",
      "Where is the student in the curriculum vs expected pace?",
    ],
  },
  {
    id: "strengths",
    label: "Strengths & Standout Moments",
    icon: "Award",
    prompts: [
      "What are the student's top 3 strengths right now?",
      "Highlight a standout moment from this month",
      "What does this student do better than peers?",
      "What positive trends should I celebrate with parents?",
      "Which behaviors should I reinforce?",
    ],
  },
  {
    id: "weak_areas",
    label: "Weak Areas & Concerns",
    icon: "Target",
    prompts: [
      "What are the weak areas?",
      "Where does the student need more practice?",
      "Which topics should we re-teach?",
      "Are there any concept gaps from earlier grades?",
      "What's the single biggest blocker right now?",
    ],
  },
  {
    id: "engagement",
    label: "Engagement & Behavior",
    icon: "Sparkles",
    prompts: [
      "How engaged is the student in class?",
      "Did engagement change this month?",
      "Is the student asking questions and participating?",
      "Any attention or focus issues to mention?",
      "Does the student work well in groups?",
      "How does the student respond to feedback?",
    ],
  },
  {
    id: "homework",
    label: "Homework & Effort",
    icon: "BookOpen",
    prompts: [
      "How is the student doing on homework?",
      "Is homework being completed on time?",
      "What's the quality of homework submissions?",
      "Does the student attempt extra practice?",
      "How can we improve homework consistency?",
    ],
  },
  {
    id: "attendance",
    label: "Attendance & Trends",
    icon: "Calendar",
    prompts: [
      "What's the attendance pattern this month?",
      "Are there recurring no-show days?",
      "How has attendance changed over the last 3 months?",
      "Any attendance impact on learning we should flag?",
    ],
  },
  {
    id: "risk",
    label: "Risk Signals",
    icon: "AlertCircle",
    prompts: [
      "Are there any risk signals to flag?",
      "Is this student at risk of falling behind?",
      "Any sudden drops in performance or engagement?",
      "Should this student be escalated?",
      "Compare risk level to last month",
    ],
  },
  {
    id: "next_steps",
    label: "Next Steps & Action Plan",
    icon: "Lightbulb",
    prompts: [
      "What should we focus on next month?",
      "Suggest 3 concrete next steps",
      "What concepts should we revisit?",
      "Recommend at-home practice activities",
      "Which milestones are realistic for this student next month?",
    ],
  },
  {
    id: "parent_help",
    label: "Parent Communication",
    icon: "Users",
    prompts: [
      "How should parents help at home?",
      "Draft 3 questions parents should ask the student",
      "What's the most important thing for parents to know?",
      "Suggest a positive opener for the parent conversation",
      "How do I gently raise a concern with parents?",
      "Recommend resources parents can use this month",
    ],
  },
  {
    id: "summary",
    label: "Quick Summaries",
    icon: "MessageSquare",
    prompts: [
      "Summarize this month's report in 3 bullets",
      "Give me a 30-second verbal summary I can deliver to parents",
      "What's the one-liner takeaway from this report?",
      "Summarize progress over the last 3 months",
    ],
  },
  {
    id: "compare",
    label: "Compare & Benchmark",
    icon: "BarChart3",
    prompts: [
      "How does this student compare to class average?",
      "Which peers are at a similar level?",
      "Where does this student rank in the subject?",
      "Compare this student's growth rate to typical students",
    ],
  },
  {
    id: "wellbeing",
    label: "Wellbeing & Motivation",
    icon: "Heart",
    prompts: [
      "How is the student's overall wellbeing?",
      "Does the student seem motivated?",
      "Any signs of frustration or anxiety with the material?",
      "How can I encourage this student?",
      "Suggest a confidence-boosting activity",
    ],
  },
];
