#!/usr/bin/env node
/**
 * build_prompt.mjs — assemble and audit an image-generation prompt.
 *
 * Build:
 *   node build_prompt.mjs --subject "..." --action "..." --composition "..." \
 *        --light "..." --style "..." [--technical "..."] [--ratio 16:9] \
 *        [--avoid "..."] [--json]
 *
 * Audit an existing prompt:
 *   node build_prompt.mjs --check "a beautiful 8k photo of a handshake"
 *
 * Exit codes: 0 = clean, 1 = cliché/quality problems found, 2 = usage error.
 * Deterministic, dependency-free. Does not call any image API.
 */

const CLICHE_SUBJECTS = [
  'handshake', 'shaking hands', 'glowing brain', 'neural network brain',
  'circuit board', 'robot at a laptop', 'robot typing', 'humanoid robot',
  'upward arrow', 'growth arrow', 'floating icons', 'holographic interface',
  'hexagon grid', 'hexagonal', 'padlock shield', 'shield icon', 'digital lock',
  'globe with connections', 'connected world', 'business team meeting',
  'magnifying glass over chart', 'lightbulb idea', 'jigsaw puzzle',
  'puzzle piece', 'ladder to the sky', 'stairs to success', 'binary code rain',
  'matrix code', 'glowing cloud', 'data stream', 'wireframe head',
  'gears turning', 'rocket launch startup', 'piggy bank', 'gold coins stack',
  'thumbs up', 'checkmark tick', 'target with dart', 'chess piece strategy',
];

const FILLER_QUALITY = [
  'hyper realistic', 'hyperrealistic', 'photorealistic 8k', '8k', '4k', '16k',
  'ultra detailed', 'ultra-detailed', 'highly detailed', 'trending on artstation',
  'masterpiece', 'award winning', 'award-winning', 'stunning', 'breathtaking',
  'beautiful', 'gorgeous', 'professional photo', 'high quality', 'best quality',
  'vibrant colors', 'vivid colors', 'futuristic', 'epic', 'majestic',
  'intricate details', 'sharp focus', 'unreal engine', 'octane render',
];

const VAGUE_LIGHT = ['cinematic lighting', 'dramatic lighting', 'beautiful lighting', 'perfect lighting', 'studio lighting'];

const TIRED_PALETTES = [
  'blue and purple gradient', 'cyberpunk neon', 'neon pink and blue',
  'gold and black luxury', 'tech blue', 'futuristic blue glow',
];

const RTL_SCRIPT = /[\u0600-\u06FF\u0750-\u077F]/;

// ------------------------------------------------------------------- args

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
};
const has = (name) => argv.includes(`--${name}`);

const asJson = has('json');
const checkOnly = flag('check');

const slots = {
  subject: flag('subject'),
  action: flag('action'),
  composition: flag('composition'),
  light: flag('light'),
  style: flag('style'),
  technical: flag('technical'),
};
const ratio = flag('ratio') || '16:9';
const avoid = flag('avoid') || '';

if (!checkOnly && !slots.subject) {
  console.error(`usage:
  build_prompt.mjs --subject "..." --action "..." --composition "..." --light "..." --style "..." [--technical "..."] [--ratio 16:9] [--avoid "..."] [--json]
  build_prompt.mjs --check "<existing prompt>"`);
  process.exit(2);
}

// ----------------------------------------------------------- build prompt

const DEFAULT_NEGATIVE = 'no text, no lettering, no watermark, no logos, no brand marks';

let prompt;
const missing = [];

if (checkOnly) {
  prompt = checkOnly;
} else {
  for (const [k, v] of Object.entries(slots)) {
    if (k !== 'technical' && !v) missing.push(k);
  }
  const parts = [
    slots.subject,
    slots.action,
    slots.composition,
    slots.light,
    slots.style,
    slots.technical,
  ].filter(Boolean);
  const negative = [DEFAULT_NEGATIVE, avoid].filter(Boolean).join(', ');
  prompt = `${parts.join('; ')}.\nNegative: ${negative}.\nAspect ratio ${ratio}.`;
}

// ----------------------------------------------------------------- audit

const findings = [];
const add = (level, rule, message, hint) => findings.push({ level, rule, message, hint });

const lower = prompt.toLowerCase();

for (const c of CLICHE_SUBJECTS) {
  if (lower.includes(c)) {
    add('error', 'cliche-subject', `cliché subject: "${c}"`, 'references/anti-cliche.md §1');
  }
}
for (const f of FILLER_QUALITY) {
  if (new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)) {
    add('warn', 'filler-quality', `empty quality token: "${f}"`, 'references/anti-cliche.md §2');
  }
}
for (const v of VAGUE_LIGHT) {
  if (lower.includes(v)) {
    add('warn', 'vague-light', `vague light: "${v}" — state direction and source`, 'references/prompt-anatomy.md §4');
  }
}
for (const p of TIRED_PALETTES) {
  if (lower.includes(p)) {
    add('warn', 'tired-palette', `tired palette: "${p}"`, 'references/anti-cliche.md §3');
  }
}

// RTL text requested inside the image
if (RTL_SCRIPT.test(prompt)) {
  add('error', 'rtl-text', 'Persian/Arabic script found in the prompt — generation models mangle it', 'references/text-in-image.md');
}
// quoted text to be rendered
const quoted = prompt.match(/["“]([^"”]{1,60})["”]/g) || [];
for (const q of quoted) {
  if (/read(?:ing|s)?|sign|label|text|says/i.test(prompt)) {
    add('warn', 'text-in-image', `text requested in image: ${q} — expect misspellings; overlay instead for anything critical`, 'references/text-in-image.md');
    break;
  }
}
// missing negative clause
if (!/negative:/i.test(prompt) && !/\bno text\b/i.test(lower)) {
  add('warn', 'no-negative', 'no negative clause — add "no text, no logos, no watermark"', 'references/prompt-anatomy.md §7');
}
// missing ratio
if (!/aspect ratio|--ar\s|\b\d{1,2}:\d{1,2}\b/i.test(prompt)) {
  add('warn', 'no-ratio', 'no aspect ratio declared', 'references/prompt-anatomy.md §8');
}
// length sanity
const wordCount = prompt.split(/\s+/).filter(Boolean).length;
if (wordCount < 18) {
  add('warn', 'too-short', `${wordCount} words — the model will guess the missing decisions`, 'references/prompt-anatomy.md');
} else if (wordCount > 130) {
  add('warn', 'too-long', `${wordCount} words — priorities get diluted`, 'references/prompt-anatomy.md');
}
// missing slots (build mode only)
for (const m of missing) {
  add('error', 'missing-slot', `slot not filled: ${m}`, 'references/prompt-anatomy.md');
}
// multiple mediums
const mediums = ['photograph', 'illustration', '3d render', 'watercolor', 'oil painting', 'vector', 'isometric diagram', 'risograph', 'ink drawing'];
const foundMediums = mediums.filter((m) => lower.includes(m));
if (foundMediums.length > 1) {
  add('warn', 'mixed-medium', `multiple mediums: ${foundMediums.join(' + ')}`, 'references/prompt-anatomy.md §5');
}

// ---------------------------------------------------------------- output

const errors = findings.filter((f) => f.level === 'error');
const warnings = findings.filter((f) => f.level === 'warn');

if (asJson) {
  console.log(JSON.stringify({ prompt, words: wordCount, findings, errors: errors.length, warnings: warnings.length }, null, 2));
} else {
  if (!checkOnly) {
    console.log('\n--- PROMPT ---\n');
    console.log(prompt);
  }
  console.log(`\n--- AUDIT --- (${wordCount} words)\n`);
  if (findings.length === 0) {
    console.log('  ✓ clean: no cliché tokens, all slots present\n');
  } else {
    for (const f of findings) {
      console.log(`  ${f.level === 'error' ? 'ERROR' : 'warn '}  [${f.rule}] ${f.message}`);
      console.log(`         → ${f.hint}`);
    }
    console.log(`\n  ${errors.length} error(s) · ${warnings.length} warning(s)\n`);
  }
}

process.exit(errors.length > 0 ? 1 : 0);
