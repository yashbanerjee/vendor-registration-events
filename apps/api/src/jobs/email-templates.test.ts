import assert from "node:assert/strict";
import test from "node:test";
import { absoluteUrl, renderEmail } from "./email-templates";

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
