import { checkRateLimit } from "./rateLimit";

function assert(condition: boolean, message: string) {
  console.log(condition ? "OK  " : "FAIL", message);
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const start = 1_000_000;

for (let i = 0; i < 10; i++) {
  const result = checkRateLimit("1.2.3.4", start + i * 1000);
  assert(!result.limited, `requisição ${i + 1}/10 dentro do limite não é bloqueada`);
}

const eleventh = checkRateLimit("1.2.3.4", start + 10_000);
assert(eleventh.limited === true, "11ª requisição na mesma janela é bloqueada");
if (eleventh.limited) {
  assert(
    eleventh.retryAfterSeconds > 0 && eleventh.retryAfterSeconds <= 3600,
    "retryAfterSeconds é um valor plausível dentro da janela de 1h",
  );
}

const otherIp = checkRateLimit("5.6.7.8", start + 10_000);
assert(!otherIp.limited, "IP diferente não é afetado pelo limite do primeiro");

const afterWindow = checkRateLimit("1.2.3.4", start + ONE_HOUR_MS + 1000);
assert(!afterWindow.limited, "depois que a janela de 1h passa, o IP volta a poder analisar");
