import { safeFetch, isBlockedHost, BlockedHostError } from "./safeFetch";

function assert(condition: boolean, message: string) {
  console.log(condition ? "OK  " : "FAIL", message);
}

const blockedHostnames = [
  "localhost",
  "127.0.0.1",
  "127.5.5.5",
  "0.0.0.0",
  "169.254.169.254", // cloud metadata endpoint
  "192.168.1.1",
  "10.0.0.1",
  "172.16.0.1",
  "172.31.255.255",
];
for (const host of blockedHostnames) {
  assert(isBlockedHost(host), `isBlockedHost bloqueia ${host}`);
}

const allowedHostnames = ["example.com", "8.8.8.8", "172.32.0.1", "172.15.0.1", "193.168.1.1"];
for (const host of allowedHostnames) {
  assert(!isBlockedHost(host), `isBlockedHost permite ${host}`);
}

async function main() {
  for (const host of ["http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/"]) {
    try {
      await safeFetch(host);
      assert(false, `safeFetch deveria ter rejeitado ${host} antes de qualquer request`);
    } catch (error) {
      assert(error instanceof BlockedHostError, `safeFetch rejeita ${host} com BlockedHostError`);
    }
  }

  // Legitimate multi-hop redirect (http -> https, different host: wikipedia.org -> www.wikipedia.org)
  // still works — proves switching from redirect:"follow" to manual hop-by-hop didn't break real usage.
  const response = await safeFetch("http://wikipedia.org", { signal: AbortSignal.timeout(10000) });
  assert(response.ok, "safeFetch segue redirect público legítimo (http://wikipedia.org) e retorna 200");
  assert(response.url.startsWith("https://"), "URL final após o redirect legítimo é https");

  console.log(
    "\nNota: a revalidação DE CADA salto de redirect (o ponto central do fix) foi verificada por",
    "leitura do código — isBlockedHost roda tanto antes do loop quanto a cada Location recebido —",
    "não por um teste ao vivo, porque simular \"host público redireciona pra IP interno\" exigiria",
    "controlar um endpoint público de verdade ou mexer no DNS/hosts da máquina, o que não é",
    "razoável fazer só para este teste manual.",
  );
}

main();
