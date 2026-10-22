import assert from "node:assert/strict";
import test from "node:test";
import { beginMailSend, mailSendIntervalMs, type MailPace } from "./mail-pace";

test("local and json mail is not spaced out", () => {
  assert.equal(mailSendIntervalMs("json", 5000), 0);
  assert.equal(mailSendIntervalMs("localhost", 5000), 0);
  assert.equal(mailSendIntervalMs("127.0.0.1", 5000), 0);
  assert.equal(mailSendIntervalMs("", 5000), 0);
  assert.equal(mailSendIntervalMs("smtp.hostinger.com", 5000), 5000);
  assert.equal(mailSendIntervalMs("smtp.hostinger.com", 0), 0);
});

test("a real mailbox waits until the previous slot has passed", () => {
  const first = beginMailSend({ nextAt: 0 }, 1_000, 5_000);
  assert.equal(first.action, "send");
  assert.equal(first.pace.nextAt, 6_000);
  const early = beginMailSend(first.pace, 2_000, 5_000);
  assert.equal(early.action, "wait");
  if (early.action === "wait") assert.equal(early.availableAt, 6_000);
  assert.equal(early.pace.nextAt, 6_000);
  const next = beginMailSend(early.pace, 6_000, 5_000);
  assert.equal(next.action, "send");
  assert.equal(next.pace.nextAt, 11_000);
});

test("json mail never consumes the real mailbox slot", () => {
  const pace: MailPace = { nextAt: 50_000 };
  const decision = beginMailSend(pace, 0, 0);
  assert.equal(decision.action, "send");
  assert.equal(decision.pace.nextAt, 50_000);
});

test("200 queued messages leave one every five seconds and stay under 15 per minute", () => {
  const interval = 5_000;
  let pace: MailPace = { nextAt: 0 };
  let waiting = Array.from({ length: 200 }, () => 0);
  const sent: number[] = [];
  for (let now = 0; now <= 200 * interval; now += 1_000) {
    const due = waiting.filter((availableAt) => availableAt <= now);
    const later = waiting.filter((availableAt) => availableAt > now);
    if (!due.length) continue;
    const decision = beginMailSend(pace, now, interval);
    pace = decision.pace;
    if (decision.action === "wait") {
      waiting = [...later, ...due.map(() => decision.availableAt)];
      continue;
    }
    sent.push(now);
    waiting = [...later, ...due.slice(1).map(() => decision.pace.nextAt)];
  }
  assert.equal(sent.length, 200);
  assert.equal(sent[0], 0);
  for (let index = 1; index < sent.length; index += 1) {
    assert.equal(sent[index] - sent[index - 1], interval);
  }
  assert.equal(sent.filter((at) => at < 60_000).length, 12);
});
