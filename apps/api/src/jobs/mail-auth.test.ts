import assert from "node:assert/strict";
import test from "node:test";
import { dkimKeyPresent, dmarcPresent, spfPresent } from "./mail-auth";

test("mail authentication records recognize a usable key", () => {
  assert.equal(spfPresent([["v=spf1 include:_spf.mail.hostinger.com ~all"]]), true);
  assert.equal(spfPresent([["google-site-verification=abc"]]), false);
  assert.equal(dkimKeyPresent([["v=DKIM1; p="]]), false);
  assert.equal(dkimKeyPresent([["v=DKIM1; p=", "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA"]]), true);
  assert.equal(dmarcPresent([["v=DMARC1; p=none"]]), true);
  assert.equal(dmarcPresent([]), false);
});
