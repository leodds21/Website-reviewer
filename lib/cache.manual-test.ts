import { getCached, setCached } from "./cache";

function assert(condition: boolean, message: string) {
  console.log(condition ? "OK  " : "FAIL", message);
}

assert(getCached("example.com") === null, "cache vazio retorna null antes de qualquer set");

setCached("example.com", { score: 42 });
assert(
  JSON.stringify(getCached("example.com")) === JSON.stringify({ score: 42 }),
  "retorna o valor salvo logo após o set",
);

assert(getCached("outro-dominio.com") === null, "domínio diferente não vê o cache de outro");
