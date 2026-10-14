// Reads robots.txt the way Google does (RFC 9309): the most specific group
// for the crawler, then the longest matching rule, with Allow winning a tie.

type Rule = { allow: boolean; pattern: string };

function groupsOf(text: string): { agents: string[]; rules: Rule[] }[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;

  for (const rawLine of text.split(/\r?\n|\r/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      // Consecutive user-agent lines share one group.
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      // An empty Disallow allows everything, so it's no rule at all.
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
    }
  }
  return groups;
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/** Does this robots.txt keep Googlebot away from `path` (path plus query)? */
export function blocksGooglebot(text: string, path: string): boolean {
  const groups = groupsOf(text);
  const forGooglebot = groups.filter((group) => group.agents.includes("googlebot"));
  const chosen = forGooglebot.length > 0 ? forGooglebot : groups.filter((group) => group.agents.includes("*"));
  const rules = chosen.flatMap((group) => group.rules).filter((rule) => matches(rule.pattern, path));
  if (rules.length === 0) return false;

  const winner = rules.reduce((best, rule) =>
    rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow) ? rule : best,
  );
  return !winner.allow;
}
