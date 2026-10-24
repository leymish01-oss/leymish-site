/* Holiday-surcharge wording builder (LeyMish Labs). Used by /local/holiday-surcharge/ in the browser
   (window.HolidayWording) and by the tests through node (module.exports). No network, no storage.
   It never writes the words "card fee", "card surcharge" or "credit card": card surcharges on eftpos, Mastercard and
   Visa are banned in Australia from 1 October 2026; a public holiday surcharge is a different thing. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) { module.exports = api; } else { root.HolidayWording = api; }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
    "November", "December"];
  var BANNED = /card[\s\-]*(fee|surcharge)s?|credit[\s\-]*cards?/gi;
  var BUSINESS = {
    cafe: { label: "Café or restaurant", scope: "", other: "Our menu prices apply at all other times." },
    bar: { label: "Bar or pub", scope: " to food and drinks", other: "Our usual prices apply at all other times." },
    salon: { label: "Salon or beauty", scope: " to all services", other: "Public holiday prices are on our price list. Our usual prices apply at all other times." },
    other: { label: "Other business", scope: "", other: "Public holiday prices are on our price list. Our usual prices apply at all other times." }
  };

  function scrub(s) { return String(s == null ? "" : s).replace(BANNED, "").replace(/\s{2,}/g, " ").trim(); }
  function cleanName(s) { return scrub(s).replace(/[<>{}]/g, "").slice(0, 60).trim(); }

  function parse(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!m) { return null; }
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return { y: +m[1], m: +m[2] - 1, d: +m[3], wd: d.getUTCDay(), iso: iso };
  }

  function hourLabel(hhmm) {
    var h = parseInt(String(hhmm || "").split(":")[0], 10);
    if (isNaN(h)) { return ""; }
    if (h === 0 || h === 24) { return "midnight"; }
    if (h === 12) { return "midday"; }
    return (h > 12 ? h - 12 : h) + (h >= 12 ? "pm" : "am");
  }

  function partText(h) { return h && h.part_day && h.part_day.from ? "from " + hourLabel(h.part_day.from) : ""; }

  function pctText(p) {
    var n = typeof p === "number" ? p : parseFloat(String(p == null ? "" : p).replace("%", ""));
    if (!isFinite(n) || n <= 0 || n > 100) { return ""; }
    return String(Math.round(n * 100) / 100) + "%";
  }

  function sorted(holidays) {
    return (holidays || []).map(function (h) { return { h: h, p: parse(h.date) }; })
      .filter(function (x) { return x.p; })
      .sort(function (a, b) { return a.p.iso < b.p.iso ? -1 : a.p.iso > b.p.iso ? 1 : 0; });
  }

  function joinList(items) {
    if (items.length < 2) { return items.join(""); }
    return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
  }

  /* "Friday 25, Monday 28 December and Friday 1 January": the month goes after the last day of each run in that
     month; a part-day holiday says when it starts ("Thursday 24 December (from 7pm)"). */
  function formatDays(holidays) {
    var xs = sorted(holidays), out = [];
    xs.forEach(function (x, i) {
      var next = xs[i + 1], last = !next || next.p.m !== x.p.m || next.p.y !== x.p.y, part = partText(x.h);
      out.push(DAYS[x.p.wd] + " " + x.p.d + (last ? " " + MONTHS[x.p.m] : "") + (part ? " (" + part + ")" : ""));
    });
    return joinList(out);
  }

  /* One line per day for the sign: "Thursday 24 December, from 7pm (Christmas Eve)". */
  function dayLines(holidays) {
    return sorted(holidays).map(function (x) {
      var part = partText(x.h), name = scrub(String(x.h.name || "").replace(/\s*\([^)]*\)\s*$/, "")
        .replace(/^Additional public holiday for (.+)$/, "$1, extra day"));
      return DAYS[x.p.wd] + " " + x.p.d + " " + MONTHS[x.p.m] + (part ? ", " + part : "") + (name ? " (" + name + ")" : "");
    });
  }

  function hasDecember(holidays) { return sorted(holidays).some(function (x) { return x.p.m === 11; }); }

  function build(opts) {
    opts = opts || {};
    var pct = pctText(opts.pct), days = sorted(opts.holidays).map(function (x) { return x.h; });
    var biz = BUSINESS[opts.business] || BUSINESS.cafe, name = cleanName(opts.name);
    var state = scrub(opts.stateName || "");
    if (!pct) { return { ok: false, error: "Enter a surcharge between 1% and 100%." }; }
    if (!days.length) { return { ok: false, error: "Pick at least one public holiday." }; }
    var list = formatDays(days), one = days.length === 1;
    var on = one ? " on the public holiday, " : " on public holidays: ";
    var menu = "A surcharge of " + pct + " applies" + biz.scope + on + list + ".";
    var where = state ? " in " + state : "";
    var signHeading = "Public holiday surcharge";
    var signLead = "A surcharge of " + pct + " applies" + biz.scope + (one ? " on this public holiday:" : " on these public holidays:");
    var lines = dayLines(days);
    var thanks = "Thank you for supporting our team on public holidays.";
    var signText = [signHeading, "", signLead].concat(lines).concat(["", biz.other, thanks]).join("\n");
    var banner = "Visiting over the holidays? A surcharge of " + pct + " applies" + biz.scope + on + list + ".";
    var season = hasDecember(days);
    var gbp = [
      (name ? name + ": " : "") + (season ? "Christmas and New Year" : "Public holiday") + " surcharge",
      "",
      "If you're visiting us over the holidays, please note: a surcharge of " + pct + " applies" + biz.scope +
        (one ? " on the public holiday" + where + ", " : " on public holidays" + where + ": ") + list + ".",
      biz.other,
      "",
      thanks + (season ? " Merry Christmas and a happy New Year!" : "")
    ].join("\n");
    var res = { ok: true, pct: pct, list: list, menu: menu, signHeading: signHeading, signLead: signLead, signLines: lines,
      signFooter: biz.other, signThanks: thanks, signText: signText, banner: banner, gbp: gbp };
    ["menu", "signHeading", "signLead", "signFooter", "signThanks", "signText", "banner", "gbp", "list"].forEach(function (k) {
      res[k] = res[k].replace(BANNED, "");
    });
    res.signLines = res.signLines.map(function (l) { return l.replace(BANNED, ""); });
    return res;
  }

  /* Default selection: the Christmas and New Year holidays (20 December to 2 January), statewide only. */
  function defaultPick(h) {
    return h.scope === "statewide" && h.date >= "2026-12-20" && h.date <= "2027-01-02";
  }

  return { build: build, formatDays: formatDays, dayLines: dayLines, pctText: pctText, hourLabel: hourLabel,
    defaultPick: defaultPick, BUSINESS: BUSINESS, BANNED: BANNED, DAYS: DAYS, MONTHS: MONTHS };
});
