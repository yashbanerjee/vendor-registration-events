import assert from "node:assert/strict";
import test from "node:test";
import { addressIn, batchFailureKind, deliveryRoutes, mailFailureKind, senderIdentity, type SmtpEndpoint } from "./mail-route";

const primary: SmtpEndpoint = {
  host: "smtp.primary.example",
  port: 587,
  secure: false,
  user: "primary",
  password: "secret",
  from: "iktva <info@example.com>",
};

test("a different fallback server is used after the saved server", () => {
  const routes = deliveryRoutes(primary, [
    { ...primary, host: "smtp.backup.example", user: "backup", from: "iktva <backup@example.com>" },
  ]);
  assert.deepEqual(routes.map((route) => route.name), ["primary", "fallback"]);
  assert.equal(routes[1]?.host, "smtp.backup.example");
});

test("the same server is not used as its own fallback", () => {
  const routes = deliveryRoutes(primary, [primary, { ...primary, host: "localhost" }, { ...primary, host: "" }]);
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.name, "primary");
});

test("the authenticated mailbox is the visible sender", () => {
  const identity = senderIdentity({
    fromName: "Vehda \"team\"",
    fromAddress: "other@example.com",
    smtpUser: "Info@Example.com",
  });
  assert.deepEqual(identity.from, { name: "Vehda team", address: "info@example.com" });
  assert.equal(identity.replyTo, "info@example.com");
  assert.equal(identity.envelopeFrom, "info@example.com");
  assert.match(identity.messageId, /^<[0-9a-f-]+@example\.com>$/);
  assert.equal(addressIn("iktva <Desk@Example.com>"), "desk@example.com");
});

test("a refused address fails once, and a rate limit stays retryable", () => {
  assert.equal(mailFailureKind(new Error("550 User unknown")), "permanent");
  assert.equal(mailFailureKind(new Error("535 Authentication failed")), "permanent");
  assert.equal(mailFailureKind(new Error("421 Too many messages, try again")), "retryable");
  assert.equal(batchFailureKind([new Error("421 rate limit"), new Error("535 Authentication failed")]), "retryable");
  assert.equal(batchFailureKind([new Error("550 User unknown")]), "permanent");
});
