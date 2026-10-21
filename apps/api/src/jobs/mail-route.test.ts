import assert from "node:assert/strict";
import test from "node:test";
import { batchFailureKind, deliveryRoutes, mailFailureKind, type SmtpEndpoint } from "./mail-route";

const primary: SmtpEndpoint = {
  host: "smtp.primary.example",
  port: 587,
  secure: false,
  user: "primary",
  password: "secret",
  from: "s7 <info@example.com>",
};

test("a different fallback server is used after the saved server", () => {
  const routes = deliveryRoutes(primary, [
    { ...primary, host: "smtp.backup.example", user: "backup", from: "s7 <backup@example.com>" },
  ]);
  assert.deepEqual(routes.map((route) => route.name), ["primary", "fallback"]);
  assert.equal(routes[1]?.host, "smtp.backup.example");
});

test("the same server is not used as its own fallback", () => {
  const routes = deliveryRoutes(primary, [primary, { ...primary, host: "localhost" }, { ...primary, host: "" }]);
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.name, "primary");
});

test("a refused address fails once, and a rate limit stays retryable", () => {
  assert.equal(mailFailureKind(new Error("550 User unknown")), "permanent");
  assert.equal(mailFailureKind(new Error("535 Authentication failed")), "permanent");
  assert.equal(mailFailureKind(new Error("421 Too many messages, try again")), "retryable");
  assert.equal(batchFailureKind([new Error("421 rate limit"), new Error("535 Authentication failed")]), "retryable");
  assert.equal(batchFailureKind([new Error("550 User unknown")]), "permanent");
});
