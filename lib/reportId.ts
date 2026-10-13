const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const LENGTH = 10;
// 62^10 is about 2^59.5: short enough for a URL, far too many to guess.
const ID_PATTERN = new RegExp(`^[0-9A-Za-z]{${LENGTH}}$`);

export function newReportId(): string {
  let id = "";
  while (id.length < LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(LENGTH))) {
      // 248 = 4 * 62: dropping higher bytes keeps every character equally likely.
      if (byte < 248 && id.length < LENGTH) id += ALPHABET[byte % 62];
    }
  }
  return id;
}

export function isReportId(value: string): boolean {
  return ID_PATTERN.test(value);
}
