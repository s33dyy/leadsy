const PROFANITY_RULES: Array<[RegExp, string]> = [
  [/\bfuck(ing|ed|er|ers|s)?\b/gi, "f***$1"],
  [/\bshit(s|ty|ting|ted)?\b/gi, "s***$1"],
  [/\bbitch(es|ing|ed)?\b/gi, "b****$1"],
  [/\basshole(s)?\b/gi, "a******$1"],
  [/\bbastard(s)?\b/gi, "b******$1"],
  [/\bdick(s)?\b/gi, "d***$1"],
  [/\bcunt(s)?\b/gi, "c***$1"]
];

export function censorProfanity(value: string): string {
  return PROFANITY_RULES.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value
  );
}
