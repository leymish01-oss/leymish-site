// Black Friday sale-claim checker: rules based on ACCC guidance for sales and discounts.
// Pure functions, no network. The page imports this file and node tests import it too.

const PRICE = String.raw`(?:AU?\$|\$)\s?\d[\d,]*(?:\.\d{1,2})?`;

// Words that show the was price is backed by a stated period or price history.
const HISTORY = /\bprice history\b|\b(?:was|regular|normal|usual|previous|original|full|strike-?through) price\b[^.\n]{0,40}?\b(?:applied|charged|from|between|until|since|for the|in the)\b|\bsold (?:it |them |this |these )?at (?:that|this|the (?:was|regular|full|normal)) price\b|\blowest price (?:in|over) the (?:last|past)\b|\b(?:in|over|for) the (?:last|past) \d+ (?:days|weeks|months)\b/i;

const UPTO_DETAIL = /\b\d{1,3}\s?% off (?:applies|is|only applies) (?:to|on)\b|\bthe (?:top|biggest|full|maximum) discount (?:applies|is)\b|\b\d+ (?:of (?:our|the) \d+ )?(?:products|items|lines|styles|models|skus)\b[^.\n]{0,60}\b\d{1,3}\s?%/i;

const CONDITIONS = /\b(?:exclud\w*|exclusions?|except(?:ions?)?|not (?:valid|available|included) (?:on|for|with)|does(?:n'?t| not) (?:apply|include)|conditions apply|t\s?&\s?cs? apply|terms (?:and conditions )?apply|selected (?:items|lines|products|styles|ranges?))\b|\*\s*(?:conditions|t\s?&\s?c|terms|excl|selected|not valid|only)|[\w%]\*(?=\s|$|[.,;!)])/i;

const DISCOUNT_NEAR = /%|\boff\b|half price|\bsale\b|discount|\bsave\b/i;

const FREE_CONDITION = /\b(?:orders?|spend(?:ing)?|purchases?|carts?|baskets?)\s+(?:of\s+over\s+|of\s+|over\s+|above\s+|\$)|\bmin(?:imum)?\.?\s+(?:spend|order|purchase)\b|\bwhen you (?:spend|buy|order)\b|\b(?:purchase|order)s? (?:over|above|of) \$|\bover \$\d|\bbuy \d+ /i;

const NEGATED = /\b(?:no|zero|without|never|free of|waived|nil)\b[\w\s-]{0,14}$/i;

const CARD_WORDS = /\b(?:card|credit|debit|visa|mastercard|eftpos|amex|american express)\b/i;

export const SURCHARGE_NOTE = "Card surcharges on eftpos, Mastercard and Visa payments have been banned in Australia since 1 October 2026, so remove any card surcharge rather than just showing it.";

export const RULES = [
  {
    id: "was-now",
    title: "Was/now or strike-through price",
    severity: 3,
    why: "The \"was\" price must be a genuine price the item actually sold at for a reasonable period just before the sale; otherwise the saving is overstated.",
    check: "Confirm each \"was\" price is what you really charged for a reasonable period before the sale, and keep your price records.",
    patterns: [
      new RegExp(String.raw`\bwas:?\s*` + PRICE, "gi"),
      /\boriginal price was\b/gi,
      /\bRRP\b/gi,
      new RegExp(String.raw`\bsave\s+(?:up to\s+)?(?:` + PRICE + String.raw`|\d{1,3}\s?%)`, "gi"),
      /\bcompared? at\b/gi,
      /\b(?:regular|normal|usual|original|full|retail) price\b/gi,
      new RegExp(String.raw`\b(?:normally|usually|previously|originally)\s*` + PRICE, "gi"),
      /\b(?:strike-?through|crossed[- ]out) prices?\b/gi,
      // Two prices side by side, higher first: how a strike-through price looks once copied as text.
      { re: /(?:AU?\$|\$)\s?(\d[\d,]*(?:\.\d{1,2})?)(?:\s*AUD)?(?:\s+|\s*(?:→|->)\s*)(?:AU?\$|\$)\s?(\d[\d,]*(?:\.\d{1,2})?)/g,
        keep: (m) => num(m[1]) > num(m[2]) },
    ],
    suppressIf: HISTORY,
    rewrite: (m, text) => {
      const p = prices(text.slice(m.start, m.end + 40));
      const was = p[0] || "$120", now = p[1] || "$80";
      return `Say when the was price applied: "Was ${was} (our regular price from 1 September to 31 October 2026), now ${now}." If you can't show the item sold at that price recently, drop the was price and just show the sale price.`;
    },
  },
  {
    id: "urgency",
    title: "Countdown or urgency claim",
    severity: 2,
    why: "The ACCC has flagged countdown timers and \"ends tonight\" claims that don't match how long the sale really runs; if the deal continues or the timer restarts, the claim is misleading.",
    check: "Make sure the sale really ends when you say, and that any countdown timer doesn't restart or get extended.",
    patterns: [
      /\bends? (?:tonight|today|at midnight|soon|in \d+\s*(?:hours?|hrs?|minutes?|mins?|days?))\b/gi,
      /\b(?:ending soon|today only|only today|tonight only|(?:24|48|72) hours only|one day only|hurry|last chance|final hours|don'?t miss out|before it'?s gone|now or never)\b/gi,
      /\b\d+\s*(?:hours?|hrs?|minutes?|mins?|days?)\s+(?:left|to go|remaining)\b/gi,
      /\b(?:countdown|timer)\b/gi,
      /\boffer expires (?:soon|tonight|today)\b/gi,
    ],
    rewrite: () => "Give the real end time and stick to it: \"Sale ends 11:59 pm AEDT, Monday 1 December 2026.\" Only show a countdown timer if it counts down to that time and doesn't restart.",
  },
  {
    id: "up-to",
    title: "\"Up to X% off\"",
    severity: 2,
    why: "The ACCC has flagged \"up to\" claims where only a few items get the top discount; shoppers expect a fair share of the range to be at or near that number.",
    check: "Say how many or which items get the top discount, or lead with the discount most items actually get.",
    patterns: [
      new RegExp(String.raw`\bup to\s+(?:\d{1,3}\s?%|` + PRICE + String.raw`|half price|half off)(?:\s*off)?`, "gi"),
    ],
    suppressIf: UPTO_DETAIL,
    rewrite: (m) => {
      const x = (m.text.match(/\d{1,3}\s?%/) || ["50%"])[0].replace(/\s/g, "");
      return `Say which items get it: "Up to ${x} off: 12 jackets are ${x} off and everything else in the sale is 20% off." Or lead with the common discount: "20% off, with some styles up to ${x} off."`;
    },
  },
  {
    id: "sitewide",
    title: "Sitewide claim with exclusions or fine print",
    severity: 3,
    why: "A \"sitewide\" or \"everything\" headline must not be contradicted by exclusions or conditions in the fine print; the ACCC has called out storewide sales that weren't.",
    check: "If anything is excluded, put the exclusions next to the headline or drop \"sitewide\".",
    patterns: [
      /\b(?:site[\s-]?wide|store[\s-]?wide|entire (?:store|range|site|website|stock)|all products|all stock|every (?:item|product) in store)\b/gi,
      { re: /\beverything\b/gi, keep: (m, text) => DISCOUNT_NEAR.test(text.slice(Math.max(0, m.index - 50), m.index + m[0].length + 50)) },
    ],
    requireAlso: CONDITIONS,
    rewrite: () => "Put the main exclusions right beside the headline: \"25% off sitewide, except gift cards and new arrivals.\" If more than a few things are excluded, say \"25% off selected ranges\" instead.",
  },
  {
    id: "fine-print",
    title: "Discount with an asterisk or \"conditions apply\"",
    severity: 1,
    why: "Fine print can't take away what the headline promises; any condition that changes the deal needs to be clear and close to the claim.",
    check: "Move any condition that changes the deal up next to the headline, in plain words.",
    patterns: [
      /\d{1,3}\s?% off\s?\*/gi,
      /\boff\s?\*/gi,
      /\*\s*(?:conditions|t\s?&\s?cs?|terms(?: and conditions)?) apply\b/gi,
    ],
    skipIfRule: "sitewide",
    rewrite: () => "Replace the asterisk with the condition itself: \"30% off full-price dresses (not sale items).\"",
  },
  {
    id: "free",
    title: "\"Free\" offer with a condition elsewhere",
    severity: 2,
    why: "\"Free\" is read as free with no catch; a minimum spend or other condition needs to sit right next to the claim, not in a footer.",
    check: "Put the minimum spend or other condition right next to the word \"free\".",
    patterns: [
      { re: /\bfree\s+(?:standard\s+|express\s+|australia[-\s]wide\s+)?(?:shipping|delivery|postage|returns|gifts?|bonus|items?)\b(\s?\*)?/gi,
        keep: (m, text) => {
          const near = text.slice(Math.max(0, m.index - 60), m.index + m[0].length + 100);
          if (FREE_CONDITION.test(near)) return false;
          return Boolean(m[1]) || FREE_CONDITION.test(text);
        } },
    ],
    rewrite: (m) => `State the condition with the claim: "${cap(m.text.replace(/\s?\*$/, ""))} on orders over $80."`,
  },
  {
    id: "drip",
    title: "Extra fees added on top of the price",
    severity: 3,
    why: "If a fee can't be avoided, the advertised price must include it; showing a lower price and adding fees at checkout (drip pricing) can mislead.",
    check: "Show one total price that already includes every fee the buyer can't avoid.",
    patterns: [
      { re: /\b(?:booking|service|processing|admin(?:istration)?|card|transaction|handling|convenience|payment|merchant|credit card|platform) fees?\b|\bsurcharges?\b|\bfees? (?:are )?(?:added|applied|calculated|charged|apply) at checkout\b|\bplus (?:fees|booking fee)\b|\+\s?fees\b|\bexcl(?:\.|uding|udes)? (?:fees|booking fees?|service fees?)\b/gi,
        keep: (m, text) => !NEGATED.test(text.slice(Math.max(0, m.index - 24), m.index)) },
    ],
    rewrite: (m, text) => {
      let s = "Show the total up front: \"$129 total, including the $4.95 booking fee.\"";
      if (cardRelated(m, text)) s += " For card payments: remove the surcharge.";
      return s;
    },
    note: (ms, text) => (ms.some((m) => cardRelated(m, text)) ? SURCHARGE_NOTE : ""),
  },
  {
    id: "lowest-price",
    title: "\"Lowest\", \"best\" or \"cheapest\" price claim",
    severity: 2,
    why: "A claim like \"lowest price\" or \"cheapest in Australia\" has to be true and you need evidence for it; the ACCC can ask you to back it up.",
    check: "Only keep a \"lowest/best price\" claim you can prove, and keep the evidence.",
    patterns: [
      /\b(?:lowest|best|cheapest|unbeatable|unbeaten)\s+(?:prices?|deals?|value)\b(?!\s+(?:in|over|for) the (?:last|past))/gi,
      /\bcheapest\b/gi,
      /\b(?:can'?t be beaten|beat any price|lowest ever|won'?t find (?:it )?cheaper)\b/gi,
    ],
    rewrite: () => "Say what you compared, or drop it: \"Lower than the 3 big retailers we checked on 20 November 2026.\" Keep screenshots of the prices you compared.",
  },
  {
    id: "stock",
    title: "Limited stock claim",
    severity: 2,
    why: "\"Only 3 left\" or \"limited stock\" must be true when shoppers see it, and sale items must be available in reasonable quantities.",
    check: "Make sure stock claims come from your real stock levels and update as they change.",
    patterns: [
      /\b(?:limited stock|limited quantit(?:y|ies)|low stock|only \d+ left|\d+ left in stock|only a few left|few left|selling fast|almost gone|nearly gone|nearly sold out|almost sold out|while stocks? lasts?|stock is running out|going fast)\b/gi,
    ],
    rewrite: () => "Only show it when it's true and tied to real stock: \"Only 6 left\" pulled from your stock system, or say how many you have: \"We have 40 at this price.\"",
  },
];

function num(s) { return parseFloat(String(s).replace(/,/g, "")); }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function prices(s) { return (s.match(/(?:AU?\$|\$)\s?\d[\d,]*(?:\.\d{1,2})?/g) || []).map((p) => p.replace(/\s/g, "")); }
function cardRelated(m, text) {
  const around = text.slice(Math.max(0, m.start - 60), m.end + 60);
  if (/holiday|weekend|sunday/i.test(m.text + around) && !CARD_WORDS.test(around)) return false;
  return CARD_WORDS.test(around) || /surcharge/i.test(m.text);
}

// A short slice of text around a match, split so the page can highlight the match.
export function snippet(text, start, end, pad = 50) {
  let a = Math.max(0, start - pad), b = Math.min(text.length, end + pad);
  if (a > 0) { const sp = text.indexOf(" ", a); if (sp > -1 && sp < start) a = sp + 1; }
  if (b < text.length) { const sp = text.lastIndexOf(" ", b); if (sp > end) b = sp; }
  const clean = (s) => s.replace(/\s+/g, " ");
  return { before: (a > 0 ? "…" : "") + clean(text.slice(a, start)), match: clean(text.slice(start, end)), after: clean(text.slice(end, b)) + (b < text.length ? "…" : "") };
}

function findMatches(rule, text) {
  const out = [];
  for (const p of rule.patterns) {
    const re = p instanceof RegExp ? p : p.re;
    const keep = p instanceof RegExp ? null : p.keep;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m[0] === "") { re.lastIndex++; continue; }
      if (keep && !keep(m, text)) continue;
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    }
  }
  out.sort((x, y) => x.start - y.start || y.end - x.end);
  const merged = [];
  for (const m of out) {
    const last = merged[merged.length - 1];
    if (last && m.start < last.end) continue; // overlapping hit of the same rule
    merged.push(m);
  }
  return merged;
}

// Check pasted sale copy. Returns one finding per rule that fired, most serious first.
export function checkText(input) {
  const text = String(input || "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return [];
  const findings = [];
  const fired = new Set();
  for (const rule of RULES) {
    if (rule.skipIfRule && fired.has(rule.skipIfRule)) continue;
    if (rule.suppressIf && rule.suppressIf.test(text)) continue;
    if (rule.requireAlso && !rule.requireAlso.test(text)) continue;
    const ms = findMatches(rule, text);
    if (!ms.length) continue;
    fired.add(rule.id);
    findings.push({
      rule: rule.id,
      title: rule.title,
      severity: rule.severity,
      why: rule.why,
      check: rule.check,
      note: rule.note ? rule.note(ms, text) : "",
      rewrite: rule.rewrite(ms[0], text),
      matches: ms.slice(0, 5).map((m) => ({ ...m, snippet: snippet(text, m.start, m.end) })),
      count: ms.length,
    });
  }
  findings.sort((a, b) => b.severity - a.severity || a.matches[0].start - b.matches[0].start);
  return findings;
}

// The headline for the results: up to 3 things to check before publishing.
export function summarize(findings) {
  const n = findings.length;
  if (!n) return { total: 0, headline: "No ACCC-flagged sale risks found in this text.", top: [] };
  const k = Math.min(3, n);
  const top = findings.slice(0, k).map((f) => ({ rule: f.rule, title: f.title, check: f.check }));
  const word = k === 1 ? "thing" : "things";
  return { total: n, headline: `${k} ${word} to check before you publish`, top, more: n - k };
}
