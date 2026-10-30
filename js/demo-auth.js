/* Local demo account helpers. This is client-side convenience, not authentication security. */
(function(root) {
    "use strict";

    const STORAGE_KEY = "studentDemoAccounts";
    const HASH_VERSION = 1;
    const ITERATIONS = 120000;
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function normalizeEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    function isHex(value, length) {
        return typeof value === "string" && value.length === length && /^[0-9a-f]+$/i.test(value);
    }

    function bytesToHex(bytes) {
        return Array.from(bytes, function(byte) {
            return byte.toString(16).padStart(2, "0");
        }).join("");
    }

    function readAccounts() {
        try {
            const parsed = JSON.parse(root.localStorage.getItem(STORAGE_KEY) || "[]");
            if (!Array.isArray(parsed)) return [];

            return parsed.filter(function(account) {
                return account &&
                    typeof account.name === "string" && account.name.trim() &&
                    typeof account.email === "string" && EMAIL_PATTERN.test(account.email) &&
                    account.version === HASH_VERSION &&
                    account.iterations === ITERATIONS &&
                    isHex(account.salt, 32) &&
                    isHex(account.verifier, 64);
            }).map(function(account) {
                return {
                    name: account.name.trim(),
                    email: normalizeEmail(account.email),
                    version: HASH_VERSION,
                    iterations: ITERATIONS,
                    salt: account.salt.toLowerCase(),
                    verifier: account.verifier.toLowerCase()
                };
            });
        } catch (error) {
            return [];
        }
    }

    function findAccount(email) {
        const normalizedEmail = normalizeEmail(email);
        return readAccounts().find(function(account) {
            return account.email === normalizedEmail;
        }) || null;
    }

    function hasCryptoSupport() {
        return Boolean(root.crypto && root.crypto.subtle && root.crypto.getRandomValues && root.TextEncoder);
    }

    async function deriveVerifier(password, saltBytes) {
        const passwordKey = await root.crypto.subtle.importKey(
            "raw",
            new root.TextEncoder().encode(password),
            "PBKDF2",
            false,
            ["deriveBits"]
        );
        const verifierBits = await root.crypto.subtle.deriveBits({
            name: "PBKDF2",
            salt: saltBytes,
            iterations: ITERATIONS,
            hash: "SHA-256"
        }, passwordKey, 256);
        return bytesToHex(new Uint8Array(verifierBits));
    }

    async function registerAccount(name, email, password) {
        const cleanName = String(name || "").trim();
        const normalizedEmail = normalizeEmail(email);
        const cleanPassword = String(password || "");

        if (cleanName.length < 2 || cleanName.length > 80) {
            return { ok: false, code: "invalid-name" };
        }
        if (!EMAIL_PATTERN.test(normalizedEmail)) {
            return { ok: false, code: "invalid-email" };
        }
        if (cleanPassword.length < 8) {
            return { ok: false, code: "weak-password" };
        }
        if (!hasCryptoSupport()) {
            return { ok: false, code: "crypto-unavailable" };
        }

        const accounts = readAccounts();
        if (accounts.some(function(account) { return account.email === normalizedEmail; })) {
            return { ok: false, code: "duplicate-email" };
        }

        const saltBytes = root.crypto.getRandomValues(new Uint8Array(16));
        const verifier = await deriveVerifier(cleanPassword, saltBytes);
        const account = {
            name: cleanName,
            email: normalizedEmail,
            version: HASH_VERSION,
            iterations: ITERATIONS,
            salt: bytesToHex(saltBytes),
            verifier: verifier
        };

        accounts.push(account);
        try {
            root.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
            return { ok: true, account: { name: account.name, email: account.email } };
        } catch (error) {
            return { ok: false, code: "storage-unavailable" };
        }
    }

    async function verifyPassword(email, password) {
        const account = findAccount(email);
        if (!account) return { ok: false, code: "account-not-found" };
        if (!hasCryptoSupport()) return { ok: false, code: "crypto-unavailable" };

        try {
            const candidate = await deriveVerifier(String(password || ""), hexToBytes(account.salt));
            let difference = 0;
            for (let index = 0; index < candidate.length; index += 1) {
                difference |= candidate.charCodeAt(index) ^ account.verifier.charCodeAt(index);
            }
            return difference === 0
                ? { ok: true, account: { name: account.name, email: account.email } }
                : { ok: false, code: "invalid-credentials" };
        } catch (error) {
            return { ok: false, code: "verification-failed" };
        }
    }

    function hexToBytes(value) {
        const bytes = new Uint8Array(value.length / 2);
        for (let index = 0; index < value.length; index += 2) {
            bytes[index / 2] = parseInt(value.slice(index, index + 2), 16);
        }
        return bytes;
    }

    function updateAccountProfile(previousEmail, name, nextEmail) {
        const oldEmail = normalizeEmail(previousEmail);
        const cleanName = String(name || "").trim();
        const normalizedNextEmail = normalizeEmail(nextEmail);
        const accounts = readAccounts();
        const accountIndex = accounts.findIndex(function(account) {
            return account.email === oldEmail;
        });

        if (accountIndex < 0) return { ok: true, registered: false };
        if (!EMAIL_PATTERN.test(normalizedNextEmail) || cleanName.length < 2) {
            return { ok: false, code: "invalid-profile" };
        }
        if (accounts.some(function(account, index) {
            return index !== accountIndex && account.email === normalizedNextEmail;
        })) {
            return { ok: false, code: "duplicate-email" };
        }

        accounts[accountIndex].name = cleanName;
        accounts[accountIndex].email = normalizedNextEmail;
        try {
            root.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
            return { ok: true, registered: true };
        } catch (error) {
            return { ok: false, code: "storage-unavailable" };
        }
    }

    root.StudentPortalDemoAuth = Object.freeze({
        storageKey: STORAGE_KEY,
        normalizeEmail: normalizeEmail,
        readAccounts: readAccounts,
        findAccount: findAccount,
        hasCryptoSupport: hasCryptoSupport,
        registerAccount: registerAccount,
        verifyPassword: verifyPassword,
        updateAccountProfile: updateAccountProfile
    });
})(window);
