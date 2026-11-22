// Gullu (Gullak's chatbot): questions about your own money, answered by an AI model that can only call these tools.
// The tools run our tested stats code over the user's own transactions and return totals and short lists:
// no SQL, no raw SMS text ever reaches the model. Provider-agnostic: any OpenAI-compatible chat API.

import { jarPlan, type Jar, type JarEntry } from './jars.ts';
import { budgetProgress, monthOf, recurringPayments, summarize, trend, type Budget, type Month } from './stats.ts';
import type { Transaction } from './types.ts';

export interface AskData {
  transactions: Transaction[];
  budgets: Budget[];
  jars: Jar[];
  jarEntries: JarEntry[];
  now: Date;
}

/** OpenAI-style tool definitions. */
export const ASK_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'spending',
      description:
        'Total spent (and received) between two dates, optionally only one category, or only payments whose payee, merchant or note contains a word (e.g. "chai", "uber"). Also returns the top merchants and categories.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Start date, YYYY-MM-DD (inclusive)' },
          to: { type: 'string', description: 'End date, YYYY-MM-DD (inclusive)' },
          category: { type: 'string', description: 'One of: Food, Groceries, Shopping, Transport, Travel, Bills, Entertainment, Health, Investments, Transfers, Cash, Income, Refund, Other' },
          search: { type: 'string', description: 'Word to look for in the payee, merchant or note' },
        },
        required: ['from', 'to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'month_summary',
      description: 'One month at a glance: spent, received, daily average, change vs last month, categories, top merchants.',
      parameters: {
        type: 'object',
        properties: { month: { type: 'string', description: 'YYYY-MM' } },
        required: ['month'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trend',
      description: 'Spent and received for each of the last N months (oldest first).',
      parameters: { type: 'object', properties: { months: { type: 'integer', minimum: 1, maximum: 12 } } },
    },
  },
  {
    type: 'function',
    function: { name: 'subscriptions', description: 'Repeating monthly payments (subscriptions, rent, SIPs, EMIs) with typical amount and next date.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'budgets', description: "This month's budget per category: limit, spent, left, and whether it's on pace to go over.", parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: { name: 'jars', description: 'Savings goals (Gullak Jars): saved, target, deadline, weekly amount needed, on track or behind, and a suggested cut.', parameters: { type: 'object', properties: {} } },
  },
  {
    type: 'function',
    function: {
      name: 'biggest_payments',
      description: 'The largest payments in a date range (date, who, amount, category).',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          category: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 10 },
        },
        required: ['from', 'to'],
      },
    },
  },
] as const;

export type ToolName = (typeof ASK_TOOLS)[number]['function']['name'];

const round = (n: number) => Math.round(n * 100) / 100;

function day(s: unknown, endOfDay: boolean): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
}

function localDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function inRange(t: Transaction, from: Date, to: Date) {
  const x = new Date(t.occurred_at).getTime();
  return x >= from.getTime() && x <= to.getTime();
}

function parseMonth(s: unknown, now: Date): Month {
  if (typeof s === 'string' && /^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-').map(Number);
    return { year: y, month: m - 1 };
  }
  return monthOf(now);
}

const monthLabel = (m: Month) => `${m.year}-${String(m.month + 1).padStart(2, '0')}`;

/** Runs one tool over the user's data. Always returns something JSON-serialisable (errors included). */
export function runTool(name: string, rawArgs: unknown, data: AskData): unknown {
  const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  const visible = data.transactions.filter((t) => !t.hidden);

  switch (name as ToolName) {
    case 'spending': {
      const from = day(args.from, false);
      const to = day(args.to, true);
      if (!from || !to) return { error: 'from and to must be dates like 2026-11-01' };
      const word = typeof args.search === 'string' ? args.search.trim().toLowerCase() : '';
      const rows = visible.filter(
        (t) =>
          inRange(t, from, to) &&
          (typeof args.category !== 'string' || t.category.toLowerCase() === args.category.toLowerCase()) &&
          (!word || [t.payee, t.merchant, t.note, t.vpa].some((f) => f?.toLowerCase().includes(word))),
      );
      const debits = rows.filter((t) => t.direction === 'debit');
      const by = (key: (t: Transaction) => string) => {
        const m = new Map<string, { total: number; count: number }>();
        for (const t of debits) {
          const k = key(t);
          const v = m.get(k) ?? { total: 0, count: 0 };
          v.total += t.amount;
          v.count += 1;
          m.set(k, v);
        }
        return [...m.entries()].map(([k, v]) => ({ name: k, total: round(v.total), count: v.count })).sort((a, b) => b.total - a.total).slice(0, 5);
      };
      return {
        from: args.from,
        to: args.to,
        filter: { category: args.category ?? null, search: word || null },
        spent: round(debits.reduce((s, t) => s + t.amount, 0)),
        payments: debits.length,
        received: round(rows.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0)),
        top_merchants: by((t) => t.merchant ?? t.payee ?? 'Unknown'),
        by_category: by((t) => t.category),
      };
    }
    case 'month_summary': {
      const m = parseMonth(args.month, data.now);
      const s = summarize(data.transactions, m, data.now);
      return {
        month: monthLabel(m),
        spent: s.spent,
        received: s.received,
        payments: s.count,
        daily_average: s.dailyAverage,
        projected_month_end: s.projected,
        change_vs_last_month_percent: s.changeVsLastMonth,
        average_month_before: s.averageMonth,
        by_category: s.byCategory.map((c) => ({ category: c.category, total: c.amount, count: c.count })),
        top_merchants: s.topMerchants.map((x) => ({ name: x.name, total: x.amount, count: x.count })),
      };
    }
    case 'trend': {
      const n = Math.min(12, Math.max(1, Number(args.months) || 6));
      return trend(data.transactions, monthOf(data.now), n).map((p) => ({ month: monthLabel(p.month), spent: p.spent, received: p.received }));
    }
    case 'subscriptions':
      return recurringPayments(data.transactions, data.now).map((r) => ({
        name: r.name,
        category: r.category,
        typical_amount: r.amount,
        months_seen: r.months,
        next_expected: localDate(r.next.toISOString()),
      }));
    case 'budgets': {
      const s = summarize(data.transactions, monthOf(data.now), data.now);
      return budgetProgress(s, data.budgets).map((b) => ({
        category: b.category,
        limit: b.limit,
        spent: b.spent,
        left: b.left,
        on_pace_to_go_over: b.onPaceToExceed,
      }));
    }
    case 'jars':
      return data.jars.map((j) => {
        const p = jarPlan(j, data.jarEntries, data.transactions, data.now);
        return {
          name: j.name,
          target: j.target,
          saved: p.saved,
          deadline: j.target_date,
          per_week_needed: p.perWeek,
          status: p.status,
          suggestion: p.nudge?.text ?? null,
        };
      });
    case 'biggest_payments': {
      const from = day(args.from, false);
      const to = day(args.to, true);
      if (!from || !to) return { error: 'from and to must be dates like 2026-11-01' };
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
      return visible
        .filter((t) => t.direction === 'debit' && inRange(t, from, to) && (typeof args.category !== 'string' || t.category === args.category))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit)
        .map((t) => ({ date: localDate(t.occurred_at), who: t.merchant ?? t.payee ?? 'Unknown', amount: t.amount, category: t.category }));
    }
    default:
      return { error: `No tool called ${name}` };
  }
}

export function systemPrompt(now: Date) {
  return [
    'You are Gullu, the friendly chatbot inside Gullak, an Indian expense-tracking app. You answer questions about the user\'s own money.',
    `Today is ${localDate(now.toISOString())} (India time). Money is in Indian rupees: write amounts like ₹1,250.`,
    'Always get numbers from the tools; never guess or invent them. If the tools have no data for something, say so plainly.',
    '"This month" means from the 1st of the current month to today. "Last month" is the previous calendar month.',
    'For things like chai, coffee or a specific shop, use the spending tool with search.',
    'Answer in two or three short sentences of plain English. No markdown tables. Suggest one practical next step only when it helps.',
  ].join('\n');
}

/** Chat message in the OpenAI format (the subset we use). */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** `extra_content` carries provider data (Gemini's thought signature) that must be sent back unchanged. */
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string }; extra_content?: unknown }[];
  tool_call_id?: string;
}

/** One call to the AI provider: returns the assistant message (with tool calls or an answer). */
export type ChatFn = (messages: ChatMessage[], tools: typeof ASK_TOOLS) => Promise<ChatMessage>;

export interface AskResult {
  answer: string;
  /** Tools the model used, for "based on …" under the answer. */
  used: string[];
}

const MAX_ROUNDS = 4;

/** Runs the question loop: model → tools → model … until it answers (at most 4 tool rounds). */
export async function ask(history: { role: 'user' | 'assistant'; content: string }[], data: AskData, chat: ChatFn): Promise<AskResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(data.now) },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 1000) })),
  ];
  const used: string[] = [];
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const reply = await chat(messages, ASK_TOOLS);
    const calls = reply.tool_calls ?? [];
    if (!calls.length || round === MAX_ROUNDS) {
      return { answer: (reply.content ?? '').trim() || 'Sorry, I couldn’t work that out. Try asking it another way.', used };
    }
    messages.push({ role: 'assistant', content: reply.content ?? null, tool_calls: calls });
    for (const call of calls) {
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        args = {};
      }
      used.push(call.function.name);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(runTool(call.function.name, args, data)) });
    }
  }
  return { answer: 'Sorry, I couldn’t work that out.', used };
}

/** Gemini through Google's OpenAI-compatible endpoint. */
export const GEMINI_OPENAI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const GEMINI_CHAT_MODEL = 'gemini-3.5-flash-lite';

/** A ChatFn for any OpenAI-compatible endpoint (Gemini, Hugging Face router, Groq, OpenRouter, …). */
export function openAICompatible(opts: { baseUrl: string; apiKey: string; model: string; timeoutMs?: number; fetchFn?: typeof fetch }): ChatFn {
  const doFetch = opts.fetchFn ?? fetch;
  return async (messages, tools) => {
    const res = await doFetch(`${opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
      body: JSON.stringify({ model: opts.model, messages, tools, tool_choice: 'auto', temperature: 0.2, max_tokens: 400 }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
    });
    if (!res.ok) throw new Error(`AI provider answered ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: ChatMessage }[] };
    const msg = body.choices?.[0]?.message;
    if (!msg) throw new Error('AI provider sent no answer');
    return { role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls };
  };
}
