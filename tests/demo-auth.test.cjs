const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { TextEncoder } = require("node:util");

const authSource = fs.readFileSync(path.join(__dirname, "..", "js", "demo-auth.js"), "utf8");

function createAuthHarness(options = {}) {
    const values = new Map();
    const localStorage = {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            if (options.storageUnavailable) throw new Error("Storage unavailable");
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
    const window = {
        localStorage,
        crypto: options.cryptoUnavailable ? undefined : webcrypto,
        TextEncoder
    };
    const context = {
        window,
        Uint8Array,
        Array,
        Object,
        String,
        Boolean,
        Number,
        RegExp,
        parseInt,
        JSON,
        Promise,
        TextEncoder
    };
    vm.runInNewContext(authSource, context, { filename: "demo-auth.js" });
    return { auth: window.StudentPortalDemoAuth, values };
}

test("registration, password verification, account updates, and malformed storage", async function() {
    const harness = createAuthHarness();
    const auth = harness.auth;
    const passphrase = "StrongDemoPass123!";

    const created = await auth.registerAccount("  Example Student  ", "Student@Example.test", passphrase);
    assert.equal(created.ok, true);
    assert.equal(created.account.name, "Example Student");
    assert.equal(created.account.email, "student@example.test");
    assert.equal(harness.values.get(auth.storageKey).includes(passphrase), false, "plaintext password is not stored");
    assert.equal((await auth.verifyPassword("STUDENT@example.test", passphrase)).ok, true);
    assert.equal((await auth.verifyPassword("student@example.test", "WrongPassword123!")).ok, false);
    assert.equal((await auth.registerAccount("Another Student", "student@example.test", "AnotherPass123!")).code, "duplicate-email");
    assert.equal((await auth.registerAccount("Second Student", "second@example.test", "AnotherPass123!")).ok, true);
    assert.equal(auth.updateAccountProfile("student@example.test", "Example Updated", "second@example.test").code, "duplicate-email");
    assert.equal(auth.updateAccountProfile("student@example.test", "Example Updated", "updated@example.test").ok, true);
    assert.equal((await auth.verifyPassword("updated@example.test", passphrase)).ok, true);
    assert.equal((await auth.verifyPassword("student@example.test", passphrase)).code, "account-not-found");

    harness.values.set(auth.storageKey, "{ malformed");
    assert.equal(auth.readAccounts().length, 0);
    assert.equal((await auth.verifyPassword("updated@example.test", passphrase)).code, "account-not-found");
});

test("account creation validates fields and handles unavailable browser APIs", async function() {
    const auth = createAuthHarness().auth;
    assert.equal((await auth.registerAccount("A", "valid@example.test", "StrongDemoPass123!")).code, "invalid-name");
    assert.equal((await auth.registerAccount("Valid Name", "not-an-email", "StrongDemoPass123!")).code, "invalid-email");
    assert.equal((await auth.registerAccount("Valid Name", "valid@example.test", "short")).code, "weak-password");

    const noCrypto = createAuthHarness({ cryptoUnavailable: true }).auth;
    assert.equal((await noCrypto.registerAccount("Valid Name", "valid@example.test", "StrongDemoPass123!")).code, "crypto-unavailable");

    const noStorage = createAuthHarness({ storageUnavailable: true }).auth;
    assert.equal((await noStorage.registerAccount("Valid Name", "valid@example.test", "StrongDemoPass123!")).code, "storage-unavailable");
});
