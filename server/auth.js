// Autenticação real: hash de senha (scrypt) e tokens assinados (HMAC). Sem libs externas.
const crypto = require("node:crypto");

const SECRET = process.env.AUTH_SECRET || "q7-educacao-local-secret-troque-em-producao";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(test, "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function signToken(userId) {
  const payload = { sub: userId, exp: Date.now() + TOKEN_TTL_MS };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expect = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
