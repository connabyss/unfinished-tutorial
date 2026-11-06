// A basic bad-word filter for names and chat. It's not perfect; reports and auto-mute back it up.
// Words are matched after folding look-alike characters (0->o, 1->i, 3->e, 4->a, 5->s, 7->t, @->a, $->s)
// and dropping repeats, so "f4ggg0t" and "n1gg3r" are caught.
const BAD = [
  "fuck", "fuk", "fck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "asshole", "bastard", "whore", "slut",
  "nigger", "niger", "nigga", "niga", "faggot", "fagot", "fag", "retard", "retarded", "tranny", "kike", "spic", "chink",
  "gook", "wetback", "coon", "dyke", "nazi", "hitler", "rape", "rapist", "porn", "penis", "vagina", "cum", "jizz",
  "molest", "pedo", "kys", "killyourself",
];
// Short words that are only bad on their own (so "cockpit" or "scum" pass in chat, but not as a whole word).
const WHOLE = new Set(["fag", "cum", "kys", "spic", "coon", "gook", "dick", "cock", "niga", "niger"]);

function fold(s) {
  return s.toLowerCase()
    .replace(/[0]/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s").replace(/7/g, "t").replace(/8/g, "b")
    .replace(/(.)\1+/g, "$1");
}

// true if the text contains a bad word anywhere (used for names: strict)
export function isBad(text) {
  const squashed = fold(text).replace(/[^a-z]/g, "");
  const words = text.split(/[\s_.\-]+|(?<=[a-z])(?=[A-Z])/).map((t) => fold(t).replace(/[^a-z]/g, ""));
  return BAD.some((w) => WHOLE.has(w) ? words.includes(fold(w)) : squashed.includes(fold(w)));
}

// chat: replace bad words with a joke, keep the rest
export function cleanChat(text) {
  // spaced-out tricks like "f u c k": if the whole line squashed together hides a long bad word, redact it all
  const squashed = fold(text).replace(/[^a-z]/g, "");
  if (BAD.some((w) => !WHOLE.has(w) && w.length >= 4 && squashed.includes(fold(w))) && /\b\w\b.*\b\w\b.*\b\w\b/.test(text)) {
    const words = text.split(/\s+/);
    if (words.filter((w) => w.length === 1).length >= 3) return "[REDACTED BY QA]";
  }
  return text.split(/(\s+)/).map((tok) => {
    const f = fold(tok).replace(/[^a-z]/g, "");
    if (!f) return tok;
    const hit = BAD.some((w) => { const fw = fold(w); return WHOLE.has(w) ? f === fw : f.includes(fw); });
    return hit ? "[REDACTED BY QA]" : tok;
  }).join("");
}
