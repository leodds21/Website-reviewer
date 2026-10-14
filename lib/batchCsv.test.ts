import { describe, expect, it } from "vitest";
import { toCsv } from "./batchCsv";

describe("toCsv", () => {
  it("joins cells and rows, leaving empty cells blank", () => {
    expect(toCsv([["site", "nota"], ["a.com", 72], ["b.com", null]])).toBe("site,nota\r\na.com,72\r\nb.com,");
  });

  it("quotes cells holding the separator, quotes or line breaks", () => {
    expect(toCsv([["a, b", 'diz "oi"', "linha\nnova"]])).toBe('"a, b","diz ""oi""","linha\nnova"');
  });

  it("uses the separator it's given", () => {
    expect(toCsv([["a;b", "c,d"]], ";")).toBe('"a;b";c,d');
  });

  it("keeps a spreadsheet from running a cell as a formula", () => {
    expect(toCsv([["=HYPERLINK(\"x\")", "+1", "@cmd", "-2"]])).toBe(`"'=HYPERLINK(""x"")",'+1,'@cmd,'-2`);
    expect(toCsv([[-2]])).toBe("-2");
  });
});
