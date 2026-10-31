#!/usr/bin/env node
// Claude Code transcripts for this project, boiled down for the retro's meta
// review: `list` gives one row per session, `digest <id>` the owner's prompts,
// Claude's prose and the tool calls without tool output (a raw transcript is
// mostly tool output, megabytes a session).
//
//   node .claude/skills/retro/session-stats.mjs list [--since YYYY-MM-DD]
//   node .claude/skills/retro/session-stats.mjs digest <session id or prefix> [--agent <agent id>]
//
// Claude Code specific: it reads ~/.claude/projects/<project path>/*.jsonl,
// whose format isn't documented and may change. Another harness needs its own
// version of this file; the rest of the meta review doesn't care.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const projectDir = path.join(
  os.homedir(), '.claude', 'projects', process.cwd().replace(/[:\\/]/g, '-'));

function readJsonl(file) {
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* a line cut by a live write */ }
  }
  return out;
}

// Context in the window for one request: everything sent, cached or not.
const contextOf = (u) =>
  (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);

const isCompaction = (e) =>
  (e.type === 'system' && e.subtype === 'compact_boundary') || e.isCompactSummary;

function ownerText(e) {
  if (e.type !== 'user' || e.isMeta) return null;
  const c = e.message?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    const t = c.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return t || null;
  }
  return null;
}

// Harness-injected user turns (reminders, task notifications) aren't the owner.
const fromOwner = (t) =>
  !!t && !/^<(system-reminder|task-notification|local-command|side-sessions-event|ci-monitor-event)/.test(t);

function summarise(entries) {
  const s = { start: null, end: null, title: '', models: new Set(), effort: '', owner: 0,
    requests: 0, peak: 0, compactions: 0, cost: null, output: 0 };
  const seen = new Set();
  for (const e of entries) {
    if (e.timestamp) { s.start ??= e.timestamp; s.end = e.timestamp; }
    if (e.type === 'custom-title' && e.customTitle) s.title = e.customTitle;
    if (e.effort) s.effort = e.effort;
    if (isCompaction(e)) s.compactions++;
    if (e.type === 'cost-state') s.cost = e.totalCostUSD;
    if (fromOwner(ownerText(e))) s.owner++;
    const m = e.message;
    if (e.type === 'assistant' && m?.usage && !seen.has(m.id)) {
      // One API response is written as several entries, one per content block.
      seen.add(m.id);
      s.requests++;
      s.models.add(m.model);
      s.peak = Math.max(s.peak, contextOf(m.usage));
      s.output += m.usage.output_tokens ?? 0;
    }
  }
  return s;
}

function subagents(sessionId) {
  const dir = path.join(projectDir, sessionId, 'subagents');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.meta.json')).map((f) => {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const id = f.replace(/^agent-/, '').replace(/\.meta\.json$/, '');
    const log = path.join(dir, `agent-${id}.jsonl`);
    return { id, meta, stats: fs.existsSync(log) ? summarise(readJsonl(log)) : null };
  });
}

const k = (n) => `${Math.round(n / 1000)}k`;
const day = (iso) => (iso ?? '').slice(0, 16).replace('T', ' ');

function list(since) {
  const files = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
  const rows = files.map((f) => {
    const id = f.replace(/\.jsonl$/, '');
    return { id, s: summarise(readJsonl(path.join(projectDir, f))), subs: subagents(id) };
  }).filter((r) => r.s.start && (!since || r.s.start >= since))
    .sort((a, b) => a.s.start.localeCompare(b.s.start));

  console.log('| session | start (UTC) | end | title | model, effort | owner msgs | requests | peak ctx | compactions | out tokens | cost $ | subagents |');
  console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const { id, s, subs } of rows) {
    const subText = subs.map((a) =>
      `${a.meta.model ?? 'inherit'} ${a.meta.agentType}: ${a.meta.description ?? ''} (peak ${a.stats ? k(a.stats.peak) : '?'})`).join('; ');
    console.log(`| ${id.slice(0, 8)} | ${day(s.start)} | ${day(s.end)} | ${s.title.replace(/\|/g, '/')} | ` +
      `${[...s.models].join(', ')} ${s.effort} | ${s.owner} | ${s.requests} | ${k(s.peak)} | ${s.compactions} | ` +
      `${k(s.output)} | ${s.cost?.toFixed(2) ?? ''} | ${subs.length ? `${subs.length}: ${subText}` : ''} |`);
  }
}

function toolLine(b) {
  const i = b.input ?? {};
  const arg = b.name === 'Agent' ? `${i.model ?? 'inherit'} ${i.subagent_type ?? ''}: ${i.description ?? ''}`
    : b.name === 'Skill' ? i.skill
    : i.description ?? i.file_path ?? i.pattern ?? i.query ?? i.url ?? (i.command ?? '').slice(0, 80);
  return `  > ${b.name}: ${String(arg ?? '').replace(/\s+/g, ' ')}`;
}

function digest(prefix, agentId) {
  const match = fs.readdirSync(projectDir).filter((f) => f.endsWith('.jsonl') && f.startsWith(prefix));
  if (match.length !== 1) throw new Error(`${match.length} sessions match "${prefix}"`);
  const id = match[0].replace(/\.jsonl$/, '');
  const file = agentId
    ? path.join(projectDir, id, 'subagents', `agent-${agentId}.jsonl`)
    : path.join(projectDir, match[0]);
  let ctx = 0;
  const seen = new Set();
  for (const e of readJsonl(file)) {
    const at = `[${day(e.timestamp).slice(5)} ${k(ctx)}]`;
    if (isCompaction(e)) { console.log(`${at} --- compacted ---`); continue; }
    if (e.toolDenialKind) console.log(`${at}   ! permission denied (${e.toolDenialKind})`);
    const owner = ownerText(e);
    if (owner) { console.log(`${at} owner: ${owner.slice(0, 800)}`); continue; }
    const m = e.message;
    if (e.type === 'user' && Array.isArray(m?.content)) {
      for (const b of m.content) {
        if (b.type === 'tool_result' && b.is_error) {
          const t = typeof b.content === 'string' ? b.content : JSON.stringify(b.content);
          console.log(`${at}   ! error: ${t.replace(/\s+/g, ' ').slice(0, 160)}`);
        }
      }
    }
    if (e.type !== 'assistant' || !Array.isArray(m?.content)) continue;
    if (m.usage && !seen.has(m.id)) { seen.add(m.id); ctx = contextOf(m.usage); }
    for (const b of m.content) {
      if (b.type === 'text' && b.text.trim()) console.log(`${at} claude: ${b.text.slice(0, 500)}`);
      if (b.type === 'tool_use') console.log(toolLine(b));
    }
  }
  if (!agentId) {
    for (const a of subagents(id)) {
      console.log(`subagent ${a.id}: ${a.meta.model ?? 'inherit'} ${a.meta.agentType}, ${a.meta.description ?? ''}, ` +
        `${a.stats?.requests ?? '?'} requests, peak ${a.stats ? k(a.stats.peak) : '?'}`);
    }
  }
}

const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
if (cmd === 'list') list(flag('--since'));
else if (cmd === 'digest' && rest[0]) digest(rest[0], flag('--agent'));
else { console.error('usage: list [--since YYYY-MM-DD] | digest <session> [--agent <id>]'); process.exit(1); }
