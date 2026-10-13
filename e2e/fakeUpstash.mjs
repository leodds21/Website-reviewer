// A tiny stand-in for Upstash's REST API, so browser tests exercise the real
// Redis code paths (shared reports, cache, locks) without a network service.
// Covers only the commands the app sends. Usage: node e2e/fakeUpstash.mjs <port>
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 3299);
const store = new Map(); // key -> { value, expiresAt }

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, args) {
  const upper = args.map((arg) => String(arg).toUpperCase());
  if (upper.includes("NX") && get(key) !== null) return null;
  const px = upper.indexOf("PX");
  store.set(key, { value, expiresAt: px === -1 ? null : Date.now() + Number(args[px + 1]) });
  return "OK";
}

function run([name, ...args]) {
  switch (String(name).toUpperCase()) {
    case "GET":
      return get(args[0]);
    case "SET":
      return set(args[0], args[1], args.slice(2));
    case "MGET":
      return args.map(get);
    case "DEL":
      return args.reduce((count, key) => count + (store.delete(key) ? 1 : 0), 0);
    case "EVALSHA":
      throw new Error("NOSCRIPT No matching script");
    // The lock release script: delete KEYS[1] only if it holds ARGV[1].
    case "EVAL": {
      const [, keyCount, key, owner] = args;
      if (Number(keyCount) === 1 && get(key) === owner) return Number(store.delete(key));
      return 0;
    }
    case "FLUSHALL":
      store.clear();
      return "OK";
    default:
      throw new Error(`ERR fake Upstash doesn't support ${name}`);
  }
}

// The client asks for base64 strings in responses.
function encode(value) {
  if (typeof value === "string") return Buffer.from(value).toString("base64");
  if (Array.isArray(value)) return value.map(encode);
  return value;
}

function answer(command) {
  try {
    return { result: encode(run(command)) };
  } catch (error) {
    return { error: error.message };
  }
}

createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  if (request.method === "GET") {
    response.writeHead(200).end("ok");
    return;
  }
  const parsed = JSON.parse(body || "[]");
  const isBatch = request.url === "/pipeline" || request.url === "/multi-exec";
  const result = isBatch ? parsed.map(answer) : answer(parsed);
  response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
}).listen(port, () => console.log(`fake Upstash on ${port}`));
