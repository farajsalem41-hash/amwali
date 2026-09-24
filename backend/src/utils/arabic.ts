/**
 * Minimal Arabic shaping for PDF output.
 * PDFKit has no complex-text layout engine, so Arabic text must be converted to
 * Unicode presentation forms (U+FE70..U+FEFF) and visually reordered right-to-left
 * before drawing. Digits and Latin runs keep their logical order.
 */

interface FormSet {
  isolated: number;
  final: number;
  initial?: number;
  medial?: number;
}

// code point -> presentation forms
const FORMS: Record<number, FormSet> = {
  0x0621: { isolated: 0xfe80, final: 0xfe80 }, // hamza
  0x0622: { isolated: 0xfe81, final: 0xfe82 },
  0x0623: { isolated: 0xfe83, final: 0xfe84 },
  0x0624: { isolated: 0xfe85, final: 0xfe86 },
  0x0625: { isolated: 0xfe87, final: 0xfe88 },
  0x0626: { isolated: 0xfe89, final: 0xfe8a, initial: 0xfe8b, medial: 0xfe8c },
  0x0627: { isolated: 0xfe8d, final: 0xfe8e },
  0x0628: { isolated: 0xfe8f, final: 0xfe90, initial: 0xfe91, medial: 0xfe92 },
  0x0629: { isolated: 0xfe93, final: 0xfe94 },
  0x062a: { isolated: 0xfe95, final: 0xfe96, initial: 0xfe97, medial: 0xfe98 },
  0x062b: { isolated: 0xfe99, final: 0xfe9a, initial: 0xfe9b, medial: 0xfe9c },
  0x062c: { isolated: 0xfe9d, final: 0xfe9e, initial: 0xfe9f, medial: 0xfea0 },
  0x062d: { isolated: 0xfea1, final: 0xfea2, initial: 0xfea3, medial: 0xfea4 },
  0x062e: { isolated: 0xfea5, final: 0xfea6, initial: 0xfea7, medial: 0xfea8 },
  0x062f: { isolated: 0xfea9, final: 0xfeaa },
  0x0630: { isolated: 0xfeab, final: 0xfeac },
  0x0631: { isolated: 0xfead, final: 0xfeae },
  0x0632: { isolated: 0xfeaf, final: 0xfeb0 },
  0x0633: { isolated: 0xfeb1, final: 0xfeb2, initial: 0xfeb3, medial: 0xfeb4 },
  0x0634: { isolated: 0xfeb5, final: 0xfeb6, initial: 0xfeb7, medial: 0xfeb8 },
  0x0635: { isolated: 0xfeb9, final: 0xfeba, initial: 0xfebb, medial: 0xfebc },
  0x0636: { isolated: 0xfebd, final: 0xfebe, initial: 0xfebf, medial: 0xfec0 },
  0x0637: { isolated: 0xfec1, final: 0xfec2, initial: 0xfec3, medial: 0xfec4 },
  0x0638: { isolated: 0xfec5, final: 0xfec6, initial: 0xfec7, medial: 0xfec8 },
  0x0639: { isolated: 0xfec9, final: 0xfeca, initial: 0xfecb, medial: 0xfecc },
  0x063a: { isolated: 0xfecd, final: 0xfece, initial: 0xfecf, medial: 0xfed0 },
  0x0640: { isolated: 0x0640, final: 0x0640, initial: 0x0640, medial: 0x0640 }, // tatweel
  0x0641: { isolated: 0xfed1, final: 0xfed2, initial: 0xfed3, medial: 0xfed4 },
  0x0642: { isolated: 0xfed5, final: 0xfed6, initial: 0xfed7, medial: 0xfed8 },
  0x0643: { isolated: 0xfed9, final: 0xfeda, initial: 0xfedb, medial: 0xfedc },
  0x0644: { isolated: 0xfedd, final: 0xfede, initial: 0xfedf, medial: 0xfee0 },
  0x0645: { isolated: 0xfee1, final: 0xfee2, initial: 0xfee3, medial: 0xfee4 },
  0x0646: { isolated: 0xfee5, final: 0xfee6, initial: 0xfee7, medial: 0xfee8 },
  0x0647: { isolated: 0xfee9, final: 0xfeea, initial: 0xfeeb, medial: 0xfeec },
  0x0648: { isolated: 0xfeed, final: 0xfeee },
  0x0649: { isolated: 0xfeef, final: 0xfef0 },
  0x064a: { isolated: 0xfef1, final: 0xfef2, initial: 0xfef3, medial: 0xfef4 },
  0x0671: { isolated: 0xfb50, final: 0xfb51 },
  0x067e: { isolated: 0xfb56, final: 0xfb57, initial: 0xfb58, medial: 0xfb59 },
  0x0686: { isolated: 0xfb7a, final: 0xfb7b, initial: 0xfb7c, medial: 0xfb7d },
  0x06a4: { isolated: 0xfb6a, final: 0xfb6b, initial: 0xfb6c, medial: 0xfb6d },
  0x06af: { isolated: 0xfb92, final: 0xfb93, initial: 0xfb94, medial: 0xfb95 },
};

// lam + alef ligatures: alef code -> [isolated, final]
const LAM_ALEF: Record<number, [number, number]> = {
  0x0622: [0xfef5, 0xfef6],
  0x0623: [0xfef7, 0xfef8],
  0x0625: [0xfef9, 0xfefa],
  0x0627: [0xfefb, 0xfefc],
};

// presentation forms produced by the lam-alef ligature step: they join to the
// previous letter but never to the next one.
const LAM_ALEF_FORMS = new Set([0xfef5, 0xfef6, 0xfef7, 0xfef8, 0xfef9, 0xfefa, 0xfefb, 0xfefc]);

function isLamAlefForm(ch: string): boolean {
  return LAM_ALEF_FORMS.has(ch.codePointAt(0) || 0);
}

const HARAKAT = /[\u064B-\u0652\u0670\u06D6-\u06ED]/;

function isArabicLetter(ch: string): boolean {
  return FORMS[ch.codePointAt(0) || 0] !== undefined;
}

function connectsForward(ch: string): boolean {
  const f = FORMS[ch.codePointAt(0) || 0];
  return !!f && f.initial !== undefined;
}

function connectsBackward(ch: string): boolean {
  const f = FORMS[ch.codePointAt(0) || 0];
  return !!f;
}

function isRtlChar(ch: string): boolean {
  const c = ch.codePointAt(0) || 0;
  return (c >= 0x0600 && c <= 0x06ff) || (c >= 0xfb50 && c <= 0xfeff);
}

/** Converts a logical Arabic string into a visually-ordered, shaped string for PDFKit. */
export function shapeArabic(input: string): string {
  if (!input) return '';
  const src = [...input].filter((c) => !HARAKAT.test(c));

  // 1) join lam-alef ligatures
  const joined: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const cur = src[i];
    const nxt = src[i + 1];
    if (cur === '\u0644' && nxt && LAM_ALEF[nxt.codePointAt(0) as number]) {
      const prev = joined[joined.length - 1];
      const useFinal = prev !== undefined && connectsForward(prev);
      const pair = LAM_ALEF[nxt.codePointAt(0) as number];
      joined.push(String.fromCodePoint(useFinal ? pair[1] : pair[0]));
      i++;
      continue;
    }
    joined.push(cur);
  }

  // 2) pick presentation forms
  const shaped = joined.map((ch, i) => {
    if (!isArabicLetter(ch)) return ch;
    const prev = joined[i - 1];
    const next = joined[i + 1];
    const linkPrev = prev !== undefined && isArabicLetter(prev) && connectsForward(prev);
    const linkNext =
      next !== undefined && ((isArabicLetter(next) && connectsBackward(next)) || isLamAlefForm(next));
    const f = FORMS[ch.codePointAt(0) as number];
    let cp = f.isolated;
    if (linkPrev && linkNext && f.medial !== undefined) cp = f.medial;
    else if (linkPrev && f.final !== undefined) cp = f.final;
    else if (linkNext && f.initial !== undefined) cp = f.initial;
    return String.fromCodePoint(cp);
  });

  // 3) visual reordering: reverse the order of words and the characters inside
  // Arabic words, while latin/numeric words keep their own left-to-right order.
  const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
  const mirror = (t: string) => [...t].map((c) => MIRROR[c] || c).join('');
  const words = shaped.join('').split(/\s+/).filter((w) => w.length > 0);
  type Token = { rtl: boolean; text: string };
  const tokens: Token[] = [];
  for (const w of words) {
    const rtl = [...w].some(isRtlChar);
    if (rtl) {
      tokens.push({ rtl: true, text: mirror([...w].reverse().join('')) });
    } else if (tokens.length && !tokens[tokens.length - 1].rtl) {
      // keep consecutive latin/numeric words in their original order
      tokens[tokens.length - 1].text += ' ' + w;
    } else {
      tokens.push({ rtl: false, text: w });
    }
  }
  return tokens
    .reverse()
    .map((t) => t.text)
    .join(' ');
}
