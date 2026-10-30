const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const { TextEncoder } = require("node:util");

const projectRoot = path.join(__dirname, "..");
const helperSource = fs.readFileSync(path.join(projectRoot, "js", "demo-auth.js"), "utf8");
const pageScriptSource = fs.readFileSync(path.join(projectRoot, "js", "script.js"), "utf8");
const dashboardSource = fs.readFileSync(path.join(projectRoot, "dashboard.html"), "utf8");

function makeStorage(initialValues) {
    const values = new Map(initialValues || []);
    return {
        values,
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); }
    };
}

function makeElement(id, initial = {}) {
    const listeners = {};
    const classNames = new Set();
    const element = {
        id,
        value: initial.value || "",
        type: initial.type || "text",
        checked: false,
        disabled: false,
        textContent: "",
        attributes: {},
        style: {},
        listeners,
        classList: {
            add(...names) { names.forEach(function(name) { classNames.add(name); }); },
            remove(...names) { names.forEach(function(name) { classNames.delete(name); }); },
            contains(name) { return classNames.has(name); },
            toggle(name, force) {
                const shouldAdd = force === undefined ? !classNames.has(name) : Boolean(force);
                if (shouldAdd) classNames.add(name);
                else classNames.delete(name);
                return shouldAdd;
            }
        },
        addEventListener(type, handler) { listeners[type] = handler; },
        setAttribute(name, value) { this.attributes[name] = String(value); },
        getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null; },
        removeAttribute(name) { delete this.attributes[name]; },
        click() {
            if (listeners.click) listeners.click({ preventDefault() {}, target: this });
        },
        focus() { this.focused = true; },
        reset() {
            (initial.resetFields || []).forEach(function(field) { field.value = ""; });
        }
    };
    Object.defineProperty(element, "className", {
        get() { return Array.from(classNames).join(" "); },
        set(value) {
            classNames.clear();
            String(value).split(/\s+/).filter(Boolean).forEach(function(name) { classNames.add(name); });
        }
    });
    return element;
}

function createPage(options = {}) {
    const localStorage = options.localStorage || makeStorage();
    const sessionStorage = options.sessionStorage || makeStorage();
    const elements = new Map();
    const confirmCalls = [];
    const pathName = options.path || "/index.html";
    (options.elementIds || []).forEach(function(entry) {
        const id = typeof entry === "string" ? entry : entry.id;
        const config = typeof entry === "string" ? {} : entry;
        elements.set(id, makeElement(id, config));
    });
    if (options.elementMap) {
        options.elementMap.forEach(function(element, id) { elements.set(id, element); });
    }

    const bodyClassNames = new Set();
    const document = {
        body: {
            classList: {
                add(name) { bodyClassNames.add(name); },
                remove(name) { bodyClassNames.delete(name); },
                contains(name) { return bodyClassNames.has(name); },
                toggle(name) {
                    if (bodyClassNames.has(name)) bodyClassNames.delete(name);
                    else bodyClassNames.add(name);
                }
            }
        },
        createElement(tagName) {
            const element = makeElement(tagName);
            element.tagName = tagName.toUpperCase();
            element.children = [];

            element.append = function(...children) {
                this.children.push(...children);
            };

            element.appendChild = function(child) {
                this.children.push(child);
                return child;
            };

            return element;
        },
        getElementById(id) { return elements.get(id) || null; },
        querySelectorAll(selector) {
            return options.querySelectorAll ? options.querySelectorAll(selector) : [];
        },
        querySelector(selector) {
            return options.querySelector ? options.querySelector(selector) : null;
        }
    };
    const windowListeners = new Map();
    const window = {
        localStorage,
        crypto: webcrypto,
        TextEncoder,
        location: {
    pathname: pathName,
    href: pathName,
    assign(url) {
        this.href = url;
    }
},
        addEventListener(type, callback) {
            if (!windowListeners.has(type)) {
                windowListeners.set(type, []);
            }
            windowListeners.get(type).push(callback);
        },
        dispatchEvent(event) {
            (windowListeners.get(event.type) || []).forEach(function(callback) {
                callback(event);
            });
            return true;
        },
        setTimeout(callback) { callback(); }
    };
    const context = {
        window,
        document,
        localStorage,
        sessionStorage,
        TextEncoder,
        Uint8Array,
        confirm(message) { confirmCalls.push(message); return options.confirmResult !== false; },
        console,
        setTimeout(callback) { callback(); }
    };
    vm.runInNewContext(helperSource, context, { filename: "demo-auth.js" });
    vm.runInNewContext(pageScriptSource, context, { filename: "script.js" });
    return { context, elements, localStorage, sessionStorage, confirmCalls, window, document };
}

function submit(element) {
    return element.listeners.submit({ preventDefault() {} });
}

test("registration and sign-in forms validate, remember, and establish a dashboard session", async function() {
    const localStorage = makeStorage();
    const sessionStorage = makeStorage();
    const registerFields = [
        makeElement("registerName"), makeElement("registerEmail"),
        makeElement("registerPassword", { type: "password" }), makeElement("confirmPassword", { type: "password" })
    ];
    const registerIds = ["registerForm", "registerMessage", "registerButton", "registerButtonText"];
    const registerPage = createPage({
        path: "/register.html",
        localStorage,
        sessionStorage,
        elementIds: registerIds.concat(registerFields.map(function(field) {
            return { id: field.id, value: field.value, type: field.type };
        }))
    });
    const registerForm = registerPage.elements.get("registerForm");
    const registerName = registerPage.elements.get("registerName");
    const registerEmail = registerPage.elements.get("registerEmail");
    const registerPassword = registerPage.elements.get("registerPassword");
    const confirmPassword = registerPage.elements.get("confirmPassword");
    registerForm.reset = function() {
        registerName.value = "";
        registerEmail.value = "";
        registerPassword.value = "";
        confirmPassword.value = "";
    };

    await submit(registerForm);
    assert.match(registerPage.elements.get("registerMessage").textContent, /name/i);
    assert.equal(localStorage.getItem("studentDemoAccounts"), null);

    registerName.value = "Demo Student";
    registerEmail.value = "demo.student@example.test";
    registerPassword.value = "StrongDemoPass123!";
    confirmPassword.value = "DifferentPass123!";
    await submit(registerForm);
    assert.match(registerPage.elements.get("registerMessage").textContent, /do not match/i);
    assert.equal(localStorage.getItem("studentDemoAccounts"), null);

    confirmPassword.value = registerPassword.value;
    await submit(registerForm);
    assert.match(registerPage.elements.get("registerMessage").textContent, /account created/i);
    assert.equal(JSON.parse(localStorage.getItem("studentDemoAccounts")).length, 1);
    assert.equal(localStorage.getItem("studentDemoAccounts").includes("StrongDemoPass123!"), false);

    registerName.value = "Demo Student";
    registerEmail.value = "DEMO.STUDENT@example.test";
    registerPassword.value = "StrongDemoPass123!";
    confirmPassword.value = registerPassword.value;
    await submit(registerForm);
    assert.match(registerPage.elements.get("registerMessage").textContent, /already uses this email/i);

    const loginPage = createPage({
        path: "/index.html",
        localStorage,
        sessionStorage,
        elementIds: [
            "loginForm", "loginMessage", "email", "password", "loginButton", "loginButtonText", "togglePassword", "forgotPassword", "remember"
        ]
    });
    const loginForm = loginPage.elements.get("loginForm");
    const email = loginPage.elements.get("email");
    const password = loginPage.elements.get("password");
    const remember = loginPage.elements.get("remember");

    email.value = "demo.student@example.test";
    password.value = "IncorrectPass123!";
    await submit(loginForm);
    assert.match(loginPage.elements.get("loginMessage").textContent, /not recognized/i);
    assert.equal(sessionStorage.getItem("studentLoggedIn"), null);

    email.value = "DEMO.STUDENT@EXAMPLE.TEST";
    password.value = "StrongDemoPass123!";
    remember.checked = true;
    await submit(loginForm);
    assert.equal(sessionStorage.getItem("studentLoggedIn"), "true");
    assert.equal(sessionStorage.getItem("studentEmail"), "demo.student@example.test");
    assert.equal(sessionStorage.getItem("studentDemoAuthType"), "registered");
    assert.equal(localStorage.getItem("rememberedEmail"), "demo.student@example.test");
    assert.equal(loginPage.window.location.href, "dashboard.html");

    const dashboard = createPage({ path: "/dashboard.html", localStorage, sessionStorage });
    assert.equal(dashboard.window.location.href, "/dashboard.html", "registered session should pass dashboard guard");

    vm.runInNewContext("logout()", dashboard.context);
    assert.equal(dashboard.window.location.href, "index.html");
    assert.equal(sessionStorage.getItem("studentLoggedIn"), null);
    assert.equal(sessionStorage.getItem("studentDemoAuthType"), null);
    assert.equal(localStorage.getItem("rememberedEmail"), "demo.student@example.test", "logout preserves remember-me email");
});

test("dashboard redirects without a session and sample credentials are rejected", async function() {
    const guarded = createPage({ path: "/dashboard.html" });
    assert.equal(guarded.window.location.href, "index.html");

    const login = createPage({
        elementIds: ["loginForm", "loginMessage", "email", "password", "togglePassword", "forgotPassword", "loginButton", "loginButtonText", "remember"]
    });
    const password = login.elements.get("password");
    const email = login.elements.get("email");
    const toggle = login.elements.get("togglePassword");
    password.type = "password";
    toggle.listeners.click();
    assert.equal(password.type, "text");
    toggle.listeners.click();
    assert.equal(password.type, "password");
    assert.equal(toggle.attributes["aria-label"], "Show password");

    let prevented = false;
    login.elements.get("forgotPassword").listeners.click({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.match(login.elements.get("loginMessage").textContent, /no reset email will be sent/i);

    email.value = "bad address";
    password.value = "not-a-valid-email-pass";
    await submit(login.elements.get("loginForm"));
    assert.match(login.elements.get("loginMessage").textContent, /valid email/i);
    email.value = "student@gmail.com";
    password.value = "short";
    await submit(login.elements.get("loginForm"));
    assert.match(login.elements.get("loginMessage").textContent, /at least 8 characters/i);
    email.value = "student@gmail.com";
    password.value = "student123";
    await submit(login.elements.get("loginForm"));
    assert.match(login.elements.get("loginMessage").textContent, /not recognized/i);
    assert.equal(login.sessionStorage.getItem("studentLoggedIn"), null);
    assert.equal(login.sessionStorage.getItem("studentDemoAuthType"), null);
    assert.notEqual(login.window.location.href, "dashboard.html");

    const legacySampleSession = createPage({
        path: "/dashboard.html",
        sessionStorage: makeStorage([
            ["studentLoggedIn", "true"],
            ["studentEmail", "student@gmail.com"],
            ["studentName", "Manoranjitham M"],
            ["studentDemoAuthType", "sample"]
        ])
    });
    assert.equal(legacySampleSession.window.location.href, "index.html");
});

test("dashboard sections and existing feature hooks are still wired", function() {
    const sections = Array.from(dashboardSource.matchAll(/id="(dashboard|profile|marks|attendance|courses|assignments)"/g), function(match) {
        return match[1];
    });
    const navTargets = Array.from(dashboardSource.matchAll(/data-section="([^"]+)"/g), function(match) {
        return match[1];
    });
    assert.deepEqual(new Set(navTargets), new Set(sections));

    const shortcuts = Array.from(dashboardSource.matchAll(/data-go-section="([^"]+)"/g), function(match) {
        return match[1];
    });
    assert.ok(shortcuts.length > 0);
    shortcuts.forEach(function(target) { assert.ok(navTargets.includes(target), "shortcut resolves to a sidebar section"); });

    ["mobileMenuBtn", "themeToggle", "profileEditor", "marksTableBody", "attendanceList", "coursesContainer", "assignmentsContainer", "assignmentSearch", "activityContainer"].forEach(function(id) {
        assert.match(dashboardSource, new RegExp("id=\"" + id + "\""));
    });
    ["mobileMenuBtn.addEventListener(\"click\"", "themeToggle.addEventListener(\"click\"", "assignmentSearch.addEventListener(\"input\"", "filter.addEventListener(\"click\""] .forEach(function(hook) {
        assert.ok(pageScriptSource.includes(hook), "existing dashboard handler remains: " + hook);
    });
});

test("sidebar shortcuts, mobile menu, theme, assignment search, and filters respond", async function() {
    const sectionNames = ["dashboard", "profile", "marks", "attendance", "courses", "assignments"];
    const sections = sectionNames.map(function(name) {
        const section = makeElement(name);
        section.id = name;
        if (name !== "dashboard") section.classList.add("d-none");
        return section;
    });
    const navLinks = sectionNames.map(function(name) {
        const link = makeElement("nav-" + name);
        link.setAttribute("data-section", name);
        if (name === "dashboard") link.classList.add("active");
        return link;
    });
    const shortcut = makeElement("attendanceShortcut");
    shortcut.setAttribute("data-go-section", "attendance");
    const sidebar = makeElement("sidebar");
    const mobileMenu = makeElement("mobileMenuBtn");
    const themeToggle = makeElement("themeToggle");
    const assignmentSearch = makeElement("assignmentSearch");
    const filters = ["All", "Pending", "Due Soon", "Completed"].map(function(status) {
        const filter = makeElement("filter-" + status);
        filter.setAttribute("data-status", status);
        if (status === "All") filter.classList.add("active");
        return filter;
    });
    const assignments = [
        { status: "Pending", text: "Database Systems" },
        { status: "Completed", text: "Computer Networks" }
    ].map(function(record) {
        const item = makeElement("assignment-" + record.status);
        item.setAttribute("data-status", record.status);
        item.textContent = record.text;
        return item;
    });
  const assignmentsContainer = makeElement("assignmentsContainer");

assignmentsContainer.querySelectorAll = function(selector) {
    if (selector === ".assignment") return assignments;
    return [];
};

assignmentsContainer.replaceChildren = function() {
    // Preserve the assignment elements created by this test.
};

assignmentsContainer.appendChild = function() {
    // Rendering is not the subject of this filtering test.
};

const elementMap = new Map([
    ["mobileMenuBtn", mobileMenu],
    ["themeToggle", themeToggle],
    ["assignmentSearch", assignmentSearch],
    ["assignmentsContainer", assignmentsContainer]
]);

sections.forEach(function(section) {
    elementMap.set(section.id, section);
});
    const localStorage = makeStorage();
    const sessionStorage = makeStorage();

    const accountSetupPage = createPage({
        path: "/register.html",
        localStorage,
        sessionStorage
    });
    const registration = await accountSetupPage.window.StudentPortalDemoAuth.registerAccount(
        "Feature Test Student",
        "feature.student@example.test",
        "FeatureTestPass123!"
    );
    assert.equal(registration.ok, true, "test account should be registered");

    sessionStorage.setItem("studentLoggedIn", "true");
    sessionStorage.setItem("studentEmail", "feature.student@example.test");
    sessionStorage.setItem("studentName", "Feature Test Student");
    sessionStorage.setItem("studentDemoAuthType", "registered");

    const page = createPage({
        path: "/dashboard.html",
        localStorage,
        sessionStorage,
        elementMap,
        querySelectorAll(selector) {
            if (selector === ".nav-link[data-section]") return navLinks;
            if (selector === ".page-section") return sections;
            if (selector === "[data-go-section]") return [shortcut];
            if (selector === ".assignment-filter") return filters;
            if (selector === "#assignmentsContainer .assignment") return assignments;
            return [];
        },
        querySelector(selector) {
            const navMatch = selector.match(/^\.nav-link\[data-section="([^"]+)"\]$/);
            if (navMatch) return navLinks.find(function(link) { return link.getAttribute("data-section") === navMatch[1]; }) || null;
            if (selector === ".sidebar") return sidebar;
            if (selector === ".assignment-filter.active") return filters.find(function(filter) { return filter.classList.contains("active"); }) || null;
            return null;
        }
    });

    mobileMenu.click();
    assert.equal(sidebar.classList.contains("mobile-open"), true);
    assert.equal(mobileMenu.attributes["aria-expanded"], "true");
    shortcut.click();
    assert.equal(sections.find(function(section) { return section.id === "attendance"; }).classList.contains("d-none"), false);
    assert.equal(navLinks.find(function(link) { return link.getAttribute("data-section") === "attendance"; }).classList.contains("active"), true);
    assert.equal(sidebar.classList.contains("mobile-open"), false, "section navigation closes the mobile menu");

    themeToggle.click();
    assert.equal(page.document.body.classList.contains("dark-mode"), true);
    assert.equal(localStorage.getItem("theme"), "dark");

    filters.find(function(filter) { return filter.getAttribute("data-status") === "Completed"; }).click();
    assert.equal(assignments[0].style.display, "none");
    assert.equal(assignments[1].style.display, "flex");
    assignmentSearch.value = "database";
    assignmentSearch.listeners.input();
    assert.equal(assignments[0].style.display, "none");
    assert.equal(assignments[1].style.display, "none");
    filters.find(function(filter) { return filter.getAttribute("data-status") === "All"; }).click();
    assert.equal(assignments[0].style.display, "flex");
    assert.equal(assignments[1].style.display, "none");
});

test("profile edits update the local account and keep the active session aligned", async function() {
    const localStorage = makeStorage();
    const sessionStorage = makeStorage();
    const accountSetup = createPage({ path: "/register.html", localStorage, sessionStorage });
    const auth = accountSetup.window.StudentPortalDemoAuth;
    await auth.registerAccount("Profile Student", "profile@example.test", "StrongDemoPass123!");
    await auth.registerAccount("Other Student", "other@example.test", "OtherDemoPass123!");
    sessionStorage.setItem("studentLoggedIn", "true");
    sessionStorage.setItem("studentEmail", "profile@example.test");
    sessionStorage.setItem("studentName", "Profile Student");
    sessionStorage.setItem("studentDemoAuthType", "registered");

    const ids = [
        "profileEditor", "editProfileButton", "cancelProfileEdit", "profileUpdateStatus",
        "editStudentName", "editStudentDepartment", "editStudentSemester", "editStudentEmail",
        "studentName", "studentDepartment", "studentSemester", "studentEmail",
        "sidebarStudentName", "sidebarStudentSemester", "profileInitials", "sidebarInitials", "welcomeName"
    ];
    const elementMap = new Map(ids.map(function(id) { return [id, makeElement(id)]; }));
    const editor = elementMap.get("profileEditor");
    editor.reportValidity = function() { return true; };
    const dashboard = createPage({ path: "/dashboard.html", localStorage, sessionStorage, elementMap });

    elementMap.get("editStudentName").value = "Profile Student Updated";
    elementMap.get("editStudentDepartment").value = "Engineering";
    elementMap.get("editStudentSemester").value = "8th Semester";
    elementMap.get("editStudentEmail").value = "other@example.test";
    await editor.listeners.submit({ preventDefault() {} });
    assert.match(elementMap.get("profileUpdateStatus").textContent, /another local demo account/i);
    assert.equal(sessionStorage.getItem("studentEmail"), "profile@example.test");

    elementMap.get("editStudentEmail").value = "updated-profile@example.test";
    await editor.listeners.submit({ preventDefault() {} });
    assert.equal(sessionStorage.getItem("studentEmail"), "updated-profile@example.test");
    assert.equal(sessionStorage.getItem("studentName"), "Profile Student Updated");
    assert.equal(elementMap.get("sidebarStudentName").textContent, "Profile Student Updated");
    assert.equal(elementMap.get("welcomeName").textContent, "Profile Student Updated");
    assert.equal(elementMap.get("studentDepartment").textContent, "Engineering");
    assert.equal(elementMap.get("studentSemester").textContent, "8th Semester");
    assert.equal((await auth.verifyPassword("updated-profile@example.test", "StrongDemoPass123!")).ok, true);
    assert.equal(dashboard.window.location.href, "/dashboard.html");
});
