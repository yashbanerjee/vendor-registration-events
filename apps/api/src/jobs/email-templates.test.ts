import assert from "node:assert/strict";
import test from "node:test";
import { absoluteUrl, publicActionUrl, renderEmail } from "./email-templates";

test("email templates escape content and keep the action link", () => {
  const rendered = renderEmail({
    template: "approved",
    audience: "vendor",
    organizationName: "Vehda <script>",
    title: "Approved",
    body: "Line one.\n\n<script>alert(1)</script>",
    actionUrl: absoluteUrl("/vendor/assignments/1", "http://localhost:3000"),
  });
  assert.match(rendered.html, /Vehda &lt;script&gt;/);
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(rendered.html, /http:\/\/localhost:3000\/vendor\/assignments\/1/);
  assert.doesNotMatch(rendered.html, /<script>/);
});

test("invitation button keeps the public link when the sender origin is local", () => {
  const tokenPath = "/invite/public-token";
  const publicLink = `https://vendor-registration-events-production.up.railway.app${tokenPath}`;
  const resolved = publicActionUrl({
    link: tokenPath,
    text: `Open this secure link: ${publicLink}\nThe link expires in 72 hours.`,
    origin: "http://localhost:3002",
  });
  assert.equal(resolved, publicLink);
  const rendered = renderEmail({
    template: "invitation",
    audience: "vendor",
    organizationName: "Vehda",
    title: "Complete New Form",
    body: `Open this secure link: ${publicLink}`,
    actionUrl: resolved,
  });
  assert.match(rendered.html, new RegExp(`href="${publicLink}"`));
  assert.doesNotMatch(rendered.html, /localhost/);
});
