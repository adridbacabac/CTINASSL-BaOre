import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { money } from "./format.js";

function walkJsx(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkJsx(path);
    return entry.name.endsWith(".jsx") ? [path] : [];
  });
}

describe("currency formatting", () => {
  test("shows pesos with two decimal places", () => {
    assert.equal(money(399), "₱399.00");
    assert.equal(money(399.5), "₱399.50");
    assert.equal(money(399.99), "₱399.99");
    assert.equal(money(0), "₱0.00");
    assert.equal(money("10"), "₱10.00");
  });
});

describe("employee role labels", () => {
  test("visible role text says Employee and keeps the stored role value", () => {
    const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..");
    const labeled = walkJsx(join(srcDir, "components")).map((file) => readFileSync(file, "utf8")).join("\n");
    assert.equal(labeled.includes(">User<"), false);
    assert.equal(labeled.includes(">User</option>"), false);
    assert.match(labeled, /<option value="user">Employee<\/option>/);
  });
});
