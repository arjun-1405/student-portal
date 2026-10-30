/* ================= LOCAL DEMO AUTHENTICATION ================= */

const DemoAuth = window.StudentPortalDemoAuth;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const rememberCheckbox = document.getElementById("remember");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginButtonText = document.getElementById("loginButtonText");

function showAuthMessage(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = "alert alert-" + type;
}

function displayLoginMessage(message, type = "danger") {
    showAuthMessage(loginMessage, message, type);
}

let loginInProgress = false;

if (loginForm && emailInput && passwordInput) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        if (loginInProgress) return;
        let signInSucceeded = false;

        const email = DemoAuth.normalizeEmail(emailInput.value);
        const password = passwordInput.value;
        emailInput.classList.remove("input-error", "input-success");
        passwordInput.classList.remove("input-error", "input-success");
        if (loginMessage) {
            loginMessage.textContent = "";
            loginMessage.className = "alert d-none";
        }

        if (!EMAIL_PATTERN.test(email)) {
            emailInput.classList.add("input-error");
            displayLoginMessage("Enter a valid email address.");
            return;
        }
        if (password.length < 8) {
            passwordInput.classList.add("input-error");
            displayLoginMessage("Password must contain at least 8 characters.");
            return;
        }

        loginInProgress = true;
        if (loginButton) loginButton.disabled = true;
        if (loginButtonText) loginButtonText.textContent = "Checking demo account...";

        try {
            const account = DemoAuth.findAccount(email);
            const authType = "registered";
            let authenticated = false;

            if (account) {
                const result = await DemoAuth.verifyPassword(email, password);
                authenticated = result.ok;
                if (result.code === "crypto-unavailable") {
                    displayLoginMessage("This browser cannot verify demo accounts. Open the portal using a current browser on localhost.", "info");
                }
            }
            if (!authenticated) {
                if (!loginMessage || !loginMessage.classList.contains("alert-info")) {
                    displayLoginMessage("Email or password not recognized. Check your details or register a demo account.");
                }
                return;
            }

            try {
                sessionStorage.setItem("studentLoggedIn", "true");
                sessionStorage.setItem("studentEmail", account.email);
                sessionStorage.setItem("studentName", account.name);
                sessionStorage.setItem("studentDemoAuthType", authType);
            } catch (error) {
                ["studentLoggedIn", "studentEmail", "studentName", "studentDemoAuthType"].forEach(function(key) {
                    try {
                        sessionStorage.removeItem(key);
                    } catch (storageError) {
                        // Session storage is unavailable in this browser.
                    }
                });
                displayLoginMessage("This browser blocked the demo session. Allow browser session storage and try again.", "danger");
                return;
            }

            if (rememberCheckbox && rememberCheckbox.checked) {
                try {
                    localStorage.setItem("rememberedEmail", account.email);
                } catch (error) {
                    // Session sign-in still works when the optional email preference cannot be saved.
                }
            } else {
                try {
                    localStorage.removeItem("rememberedEmail");
                } catch (error) {
                    // The remember-me preference is optional.
                }
            }

            emailInput.classList.add("input-success");
            passwordInput.classList.add("input-success");
            // Success notification intentionally suppressed.
            if (loginButtonText) loginButtonText.textContent = "Opening dashboard...";
            signInSucceeded = true;
            window.location.assign("dashboard.html");
        } catch (error) {
            displayLoginMessage("Could not read the local demo account. Check browser storage and try again.");
        } finally {
            if (!signInSucceeded) {
                loginInProgress = false;
                if (loginButton) loginButton.disabled = false;
                if (loginButtonText) loginButtonText.textContent = "Sign in to dashboard";
            }
        }
    });
}

/* Reset login UI when the browser restores this page from its back-forward cache. */
window.addEventListener("pageshow", function() {
    if (!document.getElementById("loginForm")) return;

    loginInProgress = false;

    if (loginButton) loginButton.disabled = false;
    if (loginButtonText) loginButtonText.textContent = "Sign in to dashboard";

    if (emailInput) emailInput.classList.remove("input-success");
    if (passwordInput) passwordInput.classList.remove("input-success");
});
/* Registration keeps only a salted PBKDF2 verifier in local browser storage. */
const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");
const registerNameInput = document.getElementById("registerName");
const registerEmailInput = document.getElementById("registerEmail");
const registerPasswordInput = document.getElementById("registerPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const registerButton = document.getElementById("registerButton");
const registerButtonText = document.getElementById("registerButtonText");
let registrationInProgress = false;

if (registerForm) {
    registerForm.addEventListener("submit", async function(event) {
        event.preventDefault();
        if (registrationInProgress) return;

        const name = registerNameInput.value.trim();
        const email = DemoAuth.normalizeEmail(registerEmailInput.value);
        const password = registerPasswordInput.value;
        const confirmation = confirmPasswordInput.value;

        if (name.length < 2 || name.length > 80) {
            showAuthMessage(registerMessage, "Enter your name (2 to 80 characters).", "danger");
            registerNameInput.focus();
            return;
        }
        if (!EMAIL_PATTERN.test(email)) {
            showAuthMessage(registerMessage, "Enter a valid email address.", "danger");
            registerEmailInput.focus();
            return;
        }
        if (password.length < 8) {
            showAuthMessage(registerMessage, "Choose a password with at least 8 characters.", "danger");
            registerPasswordInput.focus();
            return;
        }
        if (password !== confirmation) {
            showAuthMessage(registerMessage, "The passwords do not match. Check both password fields.", "danger");
            confirmPasswordInput.focus();
            return;
        }

        registrationInProgress = true;
        if (registerButton) registerButton.disabled = true;
        if (registerButtonText) registerButtonText.textContent = "Creating local account...";

        try {
            const result = await DemoAuth.registerAccount(name, email, password);
            if (!result.ok) {
                const messages = {
                    "duplicate-email": "A demo account already uses this email. Return to sign in or use another email.",
                    "crypto-unavailable": "Account creation needs Web Crypto. Open the portal in a current browser using localhost.",
                    "storage-unavailable": "The browser could not save this demo account. Check available browser storage and try again.",
                    "invalid-name": "Enter a name between 2 and 80 characters.",
                    "invalid-email": "Enter a valid email address.",
                    "weak-password": "Choose a password with at least 8 characters."
                };
                showAuthMessage(registerMessage, messages[result.code] || "Could not create the local demo account.", "danger");
                return;
            }

            registerForm.reset();
            showAuthMessage(registerMessage, "Account created on this browser. You can now sign in with this email and password.", "success");
        } catch (error) {
            showAuthMessage(registerMessage, "Could not create the local demo account. Check browser storage and try again.", "danger");
        } finally {
            registrationInProgress = false;
            if (registerButton) registerButton.disabled = false;
            if (registerButtonText) registerButtonText.textContent = "Create account";
        }
    });
}

/* ================= SHOW / HIDE PASSWORD ================= */

const togglePassword = document.getElementById("togglePassword");
if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function() {
        const isVisible = passwordInput.type === "password";
        passwordInput.type = isVisible ? "text" : "password";
        togglePassword.textContent = isVisible ? "Hide" : "Show";
        togglePassword.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
    });
}

/* Email-based recovery is unavailable without a real email service. */
const forgotPassword = document.getElementById("forgotPassword");
if (forgotPassword) {
    forgotPassword.addEventListener("click", function(event) {
        event.preventDefault();
        displayLoginMessage("Password recovery by email is unavailable in local demo mode. No reset email will be sent.", "info");
    });
}

/* ================= DASHBOARD PROTECTION ================= */

const isDashboardPage = window.location.pathname.includes("dashboard.html");
const currentDemoEmail = DemoAuth.normalizeEmail(sessionStorage.getItem("studentEmail"));
const currentDemoAuthType = sessionStorage.getItem("studentDemoAuthType");
const hasRegisteredDemoSession =
    currentDemoAuthType === "registered" &&
    Boolean(DemoAuth.findAccount(currentDemoEmail));

if (isDashboardPage && (
    sessionStorage.getItem("studentLoggedIn") !== "true" ||
    !hasRegisteredDemoSession
)) {
    window.location.href = "index.html";
}
/* ================= LOGOUT ================= */

function logout() {
    if (!confirm("Are you sure you want to logout?")) return;

    ["studentLoggedIn", "studentEmail", "studentName", "studentDemoAuthType"].forEach(function(key) {
        sessionStorage.removeItem(key);
    });
    localStorage.removeItem("activeSection");
    window.location.href = "index.html";
}


/* ================= MOBILE MENU ================= */

const mobileMenuBtn =
    document.getElementById("mobileMenuBtn");

const sidebar =
    document.querySelector(".sidebar");

if (mobileMenuBtn && sidebar) {

    mobileMenuBtn.addEventListener("click", function() {

        const isOpen = sidebar.classList.toggle("mobile-open");
        mobileMenuBtn.setAttribute("aria-expanded", String(isOpen));

    });

}


/* ================= STUDENT DATA ================= */

const defaultStudentData = {
    name: sessionStorage.getItem("studentName") || "",
    department: "",
    semester: "",
    email: sessionStorage.getItem("studentEmail") || "",
    registerNumber: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    section: "",
    academicYear: "",
    address: "",
    guardianName: "",
    guardianPhone: "",
    interests: ""
};

function loadStudentData() {
    try {
        const savedData = JSON.parse(localStorage.getItem("studentProfile") || "null");
        const profile = { ...defaultStudentData };
        if (savedData && typeof savedData === "object" && !Array.isArray(savedData)) {
            Object.keys(defaultStudentData).forEach(function(key) {
                const value = savedData[key];
                if (typeof value === "string") {
                    profile[key] = value.trim();
                }
            });
            if (!profile.name) profile.name = defaultStudentData.name;
            if (!profile.department) profile.department = defaultStudentData.department;
            if (!profile.semester) profile.semester = defaultStudentData.semester;
            if (!profile.email) profile.email = defaultStudentData.email;
        }

        const activeEmail = DemoAuth.normalizeEmail(sessionStorage.getItem("studentEmail"));
        const activeName = sessionStorage.getItem("studentName");
        const registeredAccount = DemoAuth.findAccount(activeEmail);
        if (registeredAccount) {
            profile.name = registeredAccount.name;
            profile.email = registeredAccount.email;
        } else if (sessionStorage.getItem("studentLoggedIn") === "true") {
            if (activeName) profile.name = activeName;
            if (activeEmail) profile.email = activeEmail;
        }
        return profile;
    } catch (error) {
        return { ...defaultStudentData };
    }
}

const studentData = loadStudentData();

function getStudentInitials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(function(part) {
        return part.charAt(0);
    }).join("").toUpperCase() || "S";
}

function renderStudentProfile() {
    const initials = getStudentInitials(studentData.name);
    const profileFields = [
        ["studentName", studentData.name],
        ["studentDepartment", studentData.department],
        ["studentSemester", studentData.semester],
        ["studentEmail", studentData.email],
        ["studentRegisterNumber", studentData.registerNumber || "Not provided"],
        ["studentDateOfBirth", studentData.dateOfBirth || "Not provided"],
        ["studentGender", studentData.gender || "Not provided"],
        ["studentPhone", studentData.phone || "Not provided"],
        ["studentSection", studentData.section || "Not provided"],
        ["studentAcademicYear", studentData.academicYear || "Not provided"],
        ["studentAddress", studentData.address || "Not provided"],
        ["studentGuardianName", studentData.guardianName || "Not provided"],
        ["studentGuardianPhone", studentData.guardianPhone || "Not provided"],
        ["studentInterests", studentData.interests || "Not provided"],
        ["sidebarStudentName", studentData.name],
        ["sidebarStudentSemester", studentData.semester],
        ["profileInitials", initials],
        ["sidebarInitials", initials],
        ["welcomeName", studentData.name]
    ];

    profileFields.forEach(function(entry) {
        const element = document.getElementById(entry[0]);
        if (element) {
            element.textContent = entry[1];
        }
    });
}

renderStudentProfile();

/* ================= EDITABLE STUDENT PROFILE ================= */

const profileEditor = document.getElementById("profileEditor");
const editProfileButton = document.getElementById("editProfileButton");
const cancelProfileEdit = document.getElementById("cancelProfileEdit");
const profileUpdateStatus = document.getElementById("profileUpdateStatus");

function fillProfileEditor() {
    const editorValues = {
        editStudentName: studentData.name,
        editStudentDepartment: studentData.department,
        editStudentSemester: studentData.semester,
        editStudentEmail: studentData.email,
        editStudentRegisterNumber: studentData.registerNumber,
        editStudentDateOfBirth: studentData.dateOfBirth,
        editStudentGender: studentData.gender,
        editStudentPhone: studentData.phone,
        editStudentSection: studentData.section,
        editStudentAcademicYear: studentData.academicYear,
        editStudentAddress: studentData.address,
        editStudentGuardianName: studentData.guardianName,
        editStudentGuardianPhone: studentData.guardianPhone,
        editStudentInterests: studentData.interests
    };

    Object.keys(editorValues).forEach(function(id) {
        const input = document.getElementById(id);
        if (input) {
            input.value = editorValues[id];
        }
    });
}

function setProfileEditorOpen(isOpen) {
    if (!profileEditor || !editProfileButton) return;
    profileEditor.classList.toggle("d-none", !isOpen);
    editProfileButton.setAttribute("aria-expanded", String(isOpen));
    editProfileButton.textContent = isOpen ? "Close editor" : "Edit profile";
}

if (editProfileButton && profileEditor) {
    editProfileButton.addEventListener("click", function() {
        fillProfileEditor();
        const isOpening = profileEditor.classList.contains("d-none");
        setProfileEditorOpen(isOpening);
        if (isOpening) {
            profileEditor.querySelector("input")?.focus();
        }
    });
}

if (cancelProfileEdit && profileEditor) {
    cancelProfileEdit.addEventListener("click", function() {
        fillProfileEditor();
        setProfileEditorOpen(false);
        if (profileUpdateStatus) {
            profileUpdateStatus.textContent = "No changes were saved.";
        }
        editProfileButton?.focus();
    });
}

if (profileEditor) {
    profileEditor.addEventListener("submit", function(event) {
        event.preventDefault();
        if (!profileEditor.reportValidity()) return;

        const updatedName = document.getElementById("editStudentName").value.trim();
        const updatedDepartment = document.getElementById("editStudentDepartment").value.trim();
        const updatedSemester = document.getElementById("editStudentSemester").value.trim();
        const updatedEmail = DemoAuth.normalizeEmail(document.getElementById("editStudentEmail").value);
        const optionalProfileFields = {
            registerNumber: "editStudentRegisterNumber",
            dateOfBirth: "editStudentDateOfBirth",
            gender: "editStudentGender",
            phone: "editStudentPhone",
            section: "editStudentSection",
            academicYear: "editStudentAcademicYear",
            address: "editStudentAddress",
            guardianName: "editStudentGuardianName",
            guardianPhone: "editStudentGuardianPhone",
            interests: "editStudentInterests"
        };
        const updatedOptionalFields = {};
        Object.keys(optionalProfileFields).forEach(function(key) {
            const input = document.getElementById(optionalProfileFields[key]);
            updatedOptionalFields[key] = input ? input.value.trim() : "";
        });
        const accountUpdate = DemoAuth.updateAccountProfile(studentData.email, updatedName, updatedEmail);

        if (!accountUpdate.ok) {
            profileUpdateStatus.textContent = accountUpdate.code === "duplicate-email"
                ? "That email belongs to another local demo account. Choose a different email."
                : "The account could not be updated in browser storage. Try again.";
            return;
        }

        studentData.name = updatedName;
        studentData.department = updatedDepartment;
        studentData.semester = updatedSemester;
        studentData.email = updatedEmail;
        Object.assign(studentData, updatedOptionalFields);

        try {
            localStorage.setItem("studentProfile", JSON.stringify(studentData));
            if (localStorage.getItem("rememberedEmail")) {
                localStorage.setItem("rememberedEmail", updatedEmail);
            }
        } catch (error) {
            // Keep the current profile visible even when optional profile storage is blocked.
        }
        if (sessionStorage.getItem("studentLoggedIn") === "true") {
            sessionStorage.setItem("studentEmail", updatedEmail);
            sessionStorage.setItem("studentName", updatedName);
        }

        renderStudentProfile();
        setProfileEditorOpen(false);
        if (profileUpdateStatus) {
            profileUpdateStatus.textContent = "Profile updated and saved on this device.";
        }
        editProfileButton?.focus();
    });
}

/* ================= DASHBOARD NAVIGATION ================= */

const navigationLinks =
    document.querySelectorAll(".nav-link[data-section]");

const pageSections =
    document.querySelectorAll(".page-section");

navigationLinks.forEach(function(link) {

    link.addEventListener("click", function(event) {

        event.preventDefault();

        const sectionName =
            link.getAttribute("data-section");

        pageSections.forEach(function(section) {
            section.classList.add("d-none");
        });

        const selectedSection =
            document.getElementById(sectionName);

        if (selectedSection) {
            selectedSection.classList.remove("d-none");
        }

        navigationLinks.forEach(function(item) {
            item.classList.remove("active");
        });

        link.classList.add("active");
        link.setAttribute("aria-current", "page");

        navigationLinks.forEach(function(item) {
            if (item !== link) {
                item.removeAttribute("aria-current");
            }
        });

        if (sidebar) {
            sidebar.classList.remove("mobile-open");
        }
        if (mobileMenuBtn) {
            mobileMenuBtn.setAttribute("aria-expanded", "false");
        }

        localStorage.setItem(
            "activeSection",
            sectionName
        );

    });

});

document.querySelectorAll("[data-go-section]").forEach(function(button) {
    button.addEventListener("click", function() {
        const sectionName = button.getAttribute("data-go-section");
        const targetLink = document.querySelector(
            `.nav-link[data-section="${sectionName}"]`
        );

        if (targetLink) {
            targetLink.click();
        }
    });
});


/* ================= RESTORE ACTIVE SECTION ================= */

const savedSection =
    localStorage.getItem("activeSection");

if (savedSection && isDashboardPage) {

    pageSections.forEach(function(section) {
        section.classList.add("d-none");
    });

    const savedPage =
        document.getElementById(savedSection);

    if (savedPage) {
        savedPage.classList.remove("d-none");
    }

    navigationLinks.forEach(function(link) {

        link.classList.remove("active");

        if (
            link.getAttribute("data-section") ===
            savedSection
        ) {
            link.classList.add("active");
            link.setAttribute("aria-current", "page");
        }

    });

}


/* ================= MARKS ================= */

const defaultMarksData = [
    { subject: "Database Management Systems", marks: 86 },
    { subject: "Web Development", marks: 91 },
    { subject: "Python Programming", marks: 78 },
    { subject: "Software Engineering", marks: 84 },
    { subject: "Computer Networks", marks: 88 }
];

function loadMarksData() {
    try {
        const saved = JSON.parse(localStorage.getItem("studentMarks") || "null");
        if (!Array.isArray(saved)) return defaultMarksData.map(item => ({ ...item }));
        return saved.filter(item =>
            item && typeof item.subject === "string" && item.subject.trim() &&
            Number.isFinite(Number(item.marks)) &&
            Number(item.marks) >= 0 && Number(item.marks) <= 100
        ).map(item => ({
            subject: item.subject.trim().slice(0, 100),
            marks: Number(item.marks)
        }));
    } catch (error) {
        return defaultMarksData.map(item => ({ ...item }));
    }
}

let marksData = loadMarksData();

function getGrade(marks) {
    if (marks >= 90) return "A+";
    if (marks >= 80) return "A";
    if (marks >= 70) return "B";
    if (marks >= 60) return "C";
    return "D";
}

const marksTableBody = document.getElementById("marksTableBody");
const marksAverageElement = document.getElementById("marksAverage");
const marksEditorForm = document.getElementById("marksEditorForm");
const toggleMarksEditor = document.getElementById("toggleMarksEditor");
const marksEditorCard = document.querySelector("#marks .marks-editor-card");

if (toggleMarksEditor && marksEditorCard) {
    toggleMarksEditor.addEventListener("click", function() {
        const opening = marksEditorCard.hidden;
        marksEditorCard.hidden = !opening;
        toggleMarksEditor.textContent = opening ? "Close Editor" : "Edit Marks";
        if (opening && marksSubjectInput) marksSubjectInput.focus();
    });
}
const marksEditIndex = document.getElementById("marksEditIndex");
const marksSubjectInput = document.getElementById("marksSubjectInput");
const marksValueInput = document.getElementById("marksValueInput");
const marksSaveButton = document.getElementById("marksSaveButton");
const marksCancelButton = document.getElementById("marksCancelButton");
const marksEditorMessage = document.getElementById("marksEditorMessage");

function saveMarksData() {
    try {
        localStorage.setItem("studentMarks", JSON.stringify(marksData));
        return true;
    } catch (error) {
        if (marksEditorMessage) marksEditorMessage.textContent =
            "Could not save to browser storage. Check browser storage settings.";
        return false;
    }
}

function resetMarksEditor() {
    if (!marksEditorForm) return;
    marksEditorForm.reset();
    marksEditIndex.value = "";
    marksSaveButton.textContent = "Add subject";
    marksCancelButton.hidden = true;
}

function renderMarksTable() {
    if (!marksTableBody) return;
    marksTableBody.replaceChildren();
    let total = 0;

    marksData.forEach(function(item, index) {
        total += item.marks;
        const row = document.createElement("tr");

        const subjectCell = document.createElement("td");
        subjectCell.textContent = item.subject;

        const marksCell = document.createElement("td");
        const mark = document.createElement("span");
        mark.className = "mark-value";
        mark.textContent = `${item.marks}%`;
        marksCell.appendChild(mark);

        const gradeCell = document.createElement("td");
        const grade = getGrade(item.marks);
        const gradePill = document.createElement("span");
        gradePill.className = `grade-pill grade-${grade.replace("+", "plus")}`;
        gradePill.textContent = grade;
        gradeCell.appendChild(gradePill);

        const actionsCell = document.createElement("td");
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "btn btn-sm btn-outline-primary me-2";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", function() {
            marksEditIndex.value = String(index);
            marksSubjectInput.value = item.subject;
            marksValueInput.value = String(item.marks);
            marksSaveButton.textContent = "Save changes";
            marksCancelButton.hidden = false;
            marksEditorMessage.textContent = `Editing ${item.subject}.`;
            marksSubjectInput.focus();
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "btn btn-sm btn-outline-danger";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", function() {
            if (!window.confirm(`Delete marks for "${item.subject}"?`)) return;
            const previous = marksData.map(entry => ({ ...entry }));
            marksData.splice(index, 1);
            if (!saveMarksData()) {
                marksData = previous;
                renderMarksTable();
                return;
            }
            resetMarksEditor();
            renderMarksTable();
            marksEditorMessage.textContent = "Subject deleted.";
        });

        actionsCell.append(editButton, deleteButton);
        row.append(subjectCell, marksCell, gradeCell, actionsCell);
        marksTableBody.appendChild(row);
    });

    const average = marksData.length ? total / marksData.length : 0;
    if (marksAverageElement) marksAverageElement.textContent =
        `Average: ${average.toFixed(1)}%`;
}

if (marksEditorForm) {
    marksEditorForm.addEventListener("submit", function(event) {
        event.preventDefault();
        if (!marksEditorForm.reportValidity()) return;

        const subject = marksSubjectInput.value.trim();
        const marks = Number(marksValueInput.value);
        if (!subject || !Number.isFinite(marks) || marks < 0 || marks > 100) {
            marksEditorMessage.textContent = "Enter a subject and marks between 0 and 100.";
            return;
        }

        const editIndex = marksEditIndex.value;
        const duplicate = marksData.some((item, index) =>
            item.subject.toLowerCase() === subject.toLowerCase() &&
            String(index) !== editIndex
        );
        if (duplicate) {
            marksEditorMessage.textContent = "That subject already exists.";
            return;
        }

        const previous = marksData.map(item => ({ ...item }));
        if (editIndex === "") {
            marksData.push({ subject, marks });
        } else {
            const index = Number(editIndex);
            if (!Number.isInteger(index) || !marksData[index]) {
                marksEditorMessage.textContent = "Record not found. Refresh and try again.";
                return;
            }
            marksData[index] = { subject, marks };
        }

        if (!saveMarksData()) {
            marksData = previous;
            renderMarksTable();
            return;
        }

        resetMarksEditor();
        renderMarksTable();
        marksEditorMessage.textContent = "Marks saved on this device.";
    });
}

if (marksCancelButton) {
    marksCancelButton.addEventListener("click", function() {
        resetMarksEditor();
        marksEditorMessage.textContent = "Edit cancelled.";
    });
}

renderMarksTable();

/* ================= ATTENDANCE ================= */

const defaultAttendanceData = [
    { subject: "Database Management Systems", total: 40, present: 36 },
    { subject: "Web Development", total: 35, present: 32 },
    { subject: "Python Programming", total: 38, present: 31 },
    { subject: "Software Engineering", total: 42, present: 37 },
    { subject: "Computer Networks", total: 40, present: 34 }
];

function loadAttendanceData() {
    try {
        const saved = JSON.parse(localStorage.getItem("studentAttendance") || "null");
        if (!Array.isArray(saved)) return defaultAttendanceData.map(x => ({ ...x }));
        return saved.filter(x =>
            x && typeof x.subject === "string" && x.subject.trim() &&
            Number.isInteger(Number(x.total)) && Number(x.total) >= 0 &&
            Number.isInteger(Number(x.present)) && Number(x.present) >= 0 &&
            Number(x.present) <= Number(x.total)
        ).map(x => ({
            subject: x.subject.trim().slice(0, 100),
            total: Number(x.total),
            present: Number(x.present)
        }));
    } catch {
        return defaultAttendanceData.map(x => ({ ...x }));
    }
}

let attendanceData = loadAttendanceData();

const attendanceProgressCircle = document.getElementById("attendanceProgressCircle");
const overallPercentageElement = document.getElementById("overallPercentage");
const totalClassesElement = document.getElementById("totalClasses");
const presentClassesElement = document.getElementById("presentClasses");
const absentClassesElement = document.getElementById("absentClasses");
const attendanceList = document.getElementById("attendanceList");
const toggleAttendanceEditor = document.getElementById("toggleAttendanceEditor");
const attendanceEditorCard = document.getElementById("attendanceEditorCard");
const attendanceEditorForm = document.getElementById("attendanceEditorForm");
const attendanceEditIndex = document.getElementById("attendanceEditIndex");
const attendanceSubjectInput = document.getElementById("attendanceSubjectInput");
const attendanceTotalInput = document.getElementById("attendanceTotalInput");
const attendancePresentInput = document.getElementById("attendancePresentInput");
const attendanceSaveButton = document.getElementById("attendanceSaveButton");
const attendanceCancelButton = document.getElementById("attendanceCancelButton");
const attendanceEditorMessage = document.getElementById("attendanceEditorMessage");
const attendanceEditorTableBody = document.getElementById("attendanceEditorTableBody");

function saveAttendanceData() {
    try {
        localStorage.setItem("studentAttendance", JSON.stringify(attendanceData));
        return true;
    } catch {
        if (attendanceEditorMessage) {
            attendanceEditorMessage.textContent = "Unable to save. Check browser storage settings.";
        }
        return false;
    }
}

function resetAttendanceEditor() {
    if (!attendanceEditorForm) return;
    attendanceEditorForm.reset();
    attendanceEditIndex.value = "";
    attendanceSaveButton.textContent = "Add subject";
    attendanceCancelButton.hidden = true;
}

function renderAttendance() {
    const totalClasses = attendanceData.reduce((sum, x) => sum + x.total, 0);
    const totalPresent = attendanceData.reduce((sum, x) => sum + x.present, 0);
    const totalAbsent = totalClasses - totalPresent;
    const overallPercentage = totalClasses ? totalPresent / totalClasses * 100 : 0;

    if (attendanceProgressCircle) {
        attendanceProgressCircle.style.setProperty(
            "--attendance-angle", `${Math.min(overallPercentage, 100) * 3.6}deg`
        );
        attendanceProgressCircle.setAttribute(
            "aria-label", `Overall attendance is ${overallPercentage.toFixed(1)} percent`
        );
    }
    if (overallPercentageElement) overallPercentageElement.textContent = `${overallPercentage.toFixed(1)}%`;
    if (totalClassesElement) totalClassesElement.textContent = totalClasses;
    if (presentClassesElement) presentClassesElement.textContent = totalPresent;
    if (absentClassesElement) absentClassesElement.textContent = totalAbsent;

    if (attendanceList) {
        attendanceList.replaceChildren();
        attendanceData.forEach(subject => {
            const percentage = subject.total ? subject.present / subject.total * 100 : 0;
            const item = document.createElement("div");
            item.className = "mb-4";

            const heading = document.createElement("div");
            heading.className = "attendance-subject-heading";
            const name = document.createElement("strong");
            name.textContent = subject.subject;
            const percent = document.createElement("span");
            percent.textContent = `${percentage.toFixed(1)}%`;
            heading.append(name, percent);

            const progress = document.createElement("div");
            progress.className = "progress attendance-progress";
            const bar = document.createElement("div");
            bar.className = "progress-bar";
            bar.setAttribute("role", "progressbar");
            bar.style.width = `${percentage}%`;
            bar.setAttribute("aria-label", `${subject.subject} attendance`);
            bar.setAttribute("aria-valuenow", percentage.toFixed(1));
            bar.setAttribute("aria-valuemin", "0");
            bar.setAttribute("aria-valuemax", "100");
            progress.appendChild(bar);
            item.append(heading, progress);
            attendanceList.appendChild(item);
        });
    }

    if (attendanceEditorTableBody) {
        attendanceEditorTableBody.replaceChildren();
        attendanceData.forEach((subject, index) => {
            const row = document.createElement("tr");
            [subject.subject, subject.total, subject.present, subject.total - subject.present].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = String(value);
                row.appendChild(cell);
            });

            const actions = document.createElement("td");
            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "btn btn-sm btn-outline-primary me-2";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => {
                attendanceEditIndex.value = String(index);
                attendanceSubjectInput.value = subject.subject;
                attendanceTotalInput.value = String(subject.total);
                attendancePresentInput.value = String(subject.present);
                attendanceSaveButton.textContent = "Save changes";
                attendanceCancelButton.hidden = false;
                attendanceEditorMessage.textContent = `Editing ${subject.subject}.`;
                attendanceSubjectInput.focus();
            });

            const del = document.createElement("button");
            del.type = "button";
            del.className = "btn btn-sm btn-outline-danger";
            del.textContent = "Delete";
            del.addEventListener("click", () => {
                if (!window.confirm(`Delete attendance for "${subject.subject}"?`)) return;
                const previous = attendanceData.map(x => ({ ...x }));
                attendanceData.splice(index, 1);
                if (!saveAttendanceData()) {
                    attendanceData = previous;
                    renderAttendance();
                    return;
                }
                resetAttendanceEditor();
                renderAttendance();
                attendanceEditorMessage.textContent = "Attendance record deleted.";
            });
            actions.append(edit, del);
            row.appendChild(actions);
            attendanceEditorTableBody.appendChild(row);
        });
    }
}

if (toggleAttendanceEditor && attendanceEditorCard) {
    toggleAttendanceEditor.addEventListener("click", () => {
        attendanceEditorCard.hidden = !attendanceEditorCard.hidden;
        toggleAttendanceEditor.textContent = attendanceEditorCard.hidden
            ? "Manage Attendance" : "Close Attendance Editor";
    });
}

if (attendanceEditorForm) {
    attendanceEditorForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!attendanceEditorForm.reportValidity()) return;

        const subject = attendanceSubjectInput.value.trim();
        const total = Number(attendanceTotalInput.value);
        const present = Number(attendancePresentInput.value);

        if (!subject || !Number.isInteger(total) || !Number.isInteger(present) ||
            total < 0 || present < 0 || present > total) {
            attendanceEditorMessage.textContent =
                "Enter valid whole numbers. Present classes cannot exceed total classes.";
            return;
        }

        const editIndex = attendanceEditIndex.value;
        const duplicate = attendanceData.some((x, i) =>
            x.subject.toLowerCase() === subject.toLowerCase() && String(i) !== editIndex
        );
        if (duplicate) {
            attendanceEditorMessage.textContent = "That subject already exists.";
            return;
        }

        const previous = attendanceData.map(x => ({ ...x }));
        if (editIndex === "") {
            attendanceData.push({ subject, total, present });
        } else {
            const index = Number(editIndex);
            if (!Number.isInteger(index) || !attendanceData[index]) {
                attendanceEditorMessage.textContent = "Record not found. Refresh and try again.";
                return;
            }
            attendanceData[index] = { subject, total, present };
        }

        if (!saveAttendanceData()) {
            attendanceData = previous;
            renderAttendance();
            return;
        }

        resetAttendanceEditor();
        renderAttendance();
        attendanceEditorMessage.textContent = "Attendance saved on this device.";
    });
}

if (attendanceCancelButton) {
    attendanceCancelButton.addEventListener("click", () => {
        resetAttendanceEditor();
        attendanceEditorMessage.textContent = "Edit cancelled.";
    });
}

renderAttendance();

/* ================= COURSES ================= */

/* ================= COURSES ================= */

const defaultCoursesData = [
    { code: "CS101", name: "Database Management Systems", instructor: "Dr. Kumar", progress: 80 },
    { code: "CS102", name: "Web Development", instructor: "Ms. Priya", progress: 90 },
    { code: "CS103", name: "Python Programming", instructor: "Mr. Arun", progress: 65 },
    { code: "CS104", name: "Software Engineering", instructor: "Dr. Ravi", progress: 75 },
    { code: "CS105", name: "Computer Networks", instructor: "Ms. Divya", progress: 70 },
    { code: "CS106", name: "Data Analytics", instructor: "Mr. Suresh", progress: 60 }
];

function loadCoursesData() {
    try {
        const saved = JSON.parse(localStorage.getItem("studentCourses") || "null");
        if (!Array.isArray(saved)) return defaultCoursesData.map(x => ({ ...x }));
        return saved.filter(x =>
            x && typeof x.code === "string" && x.code.trim() &&
            typeof x.name === "string" && x.name.trim() &&
            typeof x.instructor === "string" && x.instructor.trim() &&
            Number.isInteger(Number(x.progress)) &&
            Number(x.progress) >= 0 && Number(x.progress) <= 100
        ).map(x => ({
            code: x.code.trim().slice(0, 20),
            name: x.name.trim().slice(0, 100),
            instructor: x.instructor.trim().slice(0, 100),
            progress: Number(x.progress)
        }));
    } catch {
        return defaultCoursesData.map(x => ({ ...x }));
    }
}

let coursesData = loadCoursesData();
const coursesContainer = document.getElementById("coursesContainer");
const toggleCoursesEditor = document.getElementById("toggleCoursesEditor");
const coursesEditorCard = document.getElementById("coursesEditorCard");
const coursesEditorForm = document.getElementById("coursesEditorForm");
const coursesEditIndex = document.getElementById("coursesEditIndex");
const courseCodeInput = document.getElementById("courseCodeInput");
const courseNameInput = document.getElementById("courseNameInput");
const courseInstructorInput = document.getElementById("courseInstructorInput");
const courseProgressInput = document.getElementById("courseProgressInput");
const courseSaveButton = document.getElementById("courseSaveButton");
const courseCancelButton = document.getElementById("courseCancelButton");
const coursesEditorMessage = document.getElementById("coursesEditorMessage");
const coursesEditorTableBody = document.getElementById("coursesEditorTableBody");

function saveCoursesData() {
    try {
        localStorage.setItem("studentCourses", JSON.stringify(coursesData));
        return true;
    } catch {
        if (coursesEditorMessage) coursesEditorMessage.textContent = "Unable to save. Check browser storage settings.";
        return false;
    }
}

function resetCoursesEditor() {
    coursesEditorForm.reset();
    coursesEditIndex.value = "";
    courseSaveButton.textContent = "Add course";
    courseCancelButton.hidden = true;
}

function renderCourses() {
    if (coursesContainer) {
        coursesContainer.replaceChildren();
        coursesData.forEach(course => {
            const column = document.createElement("div");
            column.className = "col-md-6 col-lg-4 course-column";
            const card = document.createElement("div");
            card.className = "dashboard-card course-card";

            const top = document.createElement("div");
            top.className = "course-card-top";
            const code = document.createElement("span");
            code.className = "course-code";
            code.textContent = course.code;
            const mark = document.createElement("span");
            mark.className = "course-card-mark";
            mark.setAttribute("aria-hidden", "true");
            mark.textContent = course.code.slice(-2);
            top.append(code, mark);

            const name = document.createElement("h5");
            name.textContent = course.name;
            const instructor = document.createElement("p");
            instructor.className = "course-instructor";
            instructor.append(document.createTextNode("Instructor "));
            const instructorName = document.createElement("strong");
            instructorName.textContent = course.instructor;
            instructor.appendChild(instructorName);

            const caption = document.createElement("div");
            caption.className = "course-progress-caption";
            const captionText = document.createElement("span");
            captionText.textContent = "Course progress";
            const progressValue = document.createElement("strong");
            progressValue.textContent = `${course.progress}%`;
            caption.append(captionText, progressValue);

            const progress = document.createElement("div");
            progress.className = "progress course-progress";
            progress.setAttribute("role", "progressbar");
            progress.setAttribute("aria-label", `${course.name} progress`);
            progress.setAttribute("aria-valuenow", course.progress);
            progress.setAttribute("aria-valuemin", "0");
            progress.setAttribute("aria-valuemax", "100");
            const bar = document.createElement("div");
            bar.className = "progress-bar";
            bar.style.width = `${course.progress}%`;
            progress.appendChild(bar);

            card.append(top, name, instructor, caption, progress);
            column.appendChild(card);
            coursesContainer.appendChild(column);
        });
    }

    if (coursesEditorTableBody) {
        coursesEditorTableBody.replaceChildren();
        coursesData.forEach((course, index) => {
            const row = document.createElement("tr");
            [course.code, course.name, course.instructor, `${course.progress}%`].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
            const actions = document.createElement("td");

            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "btn btn-sm btn-outline-primary me-2";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => {
                coursesEditIndex.value = String(index);
                courseCodeInput.value = course.code;
                courseNameInput.value = course.name;
                courseInstructorInput.value = course.instructor;
                courseProgressInput.value = String(course.progress);
                courseSaveButton.textContent = "Save changes";
                courseCancelButton.hidden = false;
                coursesEditorMessage.textContent = `Editing ${course.name}.`;
                courseCodeInput.focus();
            });

            const del = document.createElement("button");
            del.type = "button";
            del.className = "btn btn-sm btn-outline-danger";
            del.textContent = "Delete";
            del.addEventListener("click", () => {
                if (!window.confirm(`Delete course "${course.name}"?`)) return;
                const previous = coursesData.map(x => ({ ...x }));
                coursesData.splice(index, 1);
                if (!saveCoursesData()) {
                    coursesData = previous;
                    renderCourses();
                    return;
                }
                resetCoursesEditor();
                renderCourses();
                coursesEditorMessage.textContent = "Course deleted.";
            });

            actions.append(edit, del);
            row.appendChild(actions);
            coursesEditorTableBody.appendChild(row);
        });
    }

    if (document.getElementById("dashboardCourseProgress")) {
        const dashboardCourseProgress = document.getElementById("dashboardCourseProgress");
        const spotlightCourses = coursesData.slice()
            .sort((a, b) => b.progress - a.progress).slice(0, 4);
        dashboardCourseProgress.replaceChildren();

        spotlightCourses.forEach(course => {
            const item = document.createElement("div");
            item.className = "course-progress-item";
            const heading = document.createElement("div");
            heading.className = "course-progress-heading";
            const name = document.createElement("strong");
            name.textContent = course.name;
            const value = document.createElement("span");
            value.textContent = `${course.progress}%`;
            heading.append(name, value);

            const track = document.createElement("div");
            track.className = "course-progress-track";
            track.setAttribute("role", "progressbar");
            track.setAttribute("aria-label", `${course.name} progress`);
            track.setAttribute("aria-valuenow", course.progress);
            track.setAttribute("aria-valuemin", "0");
            track.setAttribute("aria-valuemax", "100");
            const fill = document.createElement("span");
            fill.style.width = `${course.progress}%`;
            track.appendChild(fill);
            item.append(heading, track);
            dashboardCourseProgress.appendChild(item);
        });
    }
}

if (toggleCoursesEditor && coursesEditorCard) {
    toggleCoursesEditor.addEventListener("click", () => {
        coursesEditorCard.hidden = !coursesEditorCard.hidden;
        toggleCoursesEditor.textContent = coursesEditorCard.hidden ? "Manage Courses" : "Close Courses Editor";
    });
}

if (coursesEditorForm) {
    coursesEditorForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!coursesEditorForm.reportValidity()) return;

        const course = {
            code: courseCodeInput.value.trim(),
            name: courseNameInput.value.trim(),
            instructor: courseInstructorInput.value.trim(),
            progress: Number(courseProgressInput.value)
        };

        if (!course.code || !course.name || !course.instructor ||
            !Number.isInteger(course.progress) || course.progress < 0 || course.progress > 100) {
            coursesEditorMessage.textContent = "Complete all fields and enter progress from 0 to 100.";
            return;
        }

        const editIndex = coursesEditIndex.value;
        if (coursesData.some((x, i) =>
            x.code.toLowerCase() === course.code.toLowerCase() && String(i) !== editIndex
        )) {
            coursesEditorMessage.textContent = "That course code already exists.";
            return;
        }

        const previous = coursesData.map(x => ({ ...x }));
        if (editIndex === "") {
            coursesData.push(course);
        } else {
            const index = Number(editIndex);
            if (!Number.isInteger(index) || !coursesData[index]) {
                coursesEditorMessage.textContent = "Record not found. Refresh and try again.";
                return;
            }
            coursesData[index] = course;
        }

        if (!saveCoursesData()) {
            coursesData = previous;
            renderCourses();
            return;
        }

        resetCoursesEditor();
        renderCourses();
        coursesEditorMessage.textContent = "Course saved on this device.";
    });
}

if (courseCancelButton) {
    courseCancelButton.addEventListener("click", () => {
        resetCoursesEditor();
        coursesEditorMessage.textContent = "Edit cancelled.";
    });
}

renderCourses();

/* ================= ASSIGNMENTS ================= */

function parseAssignmentDate(dateText) {
    const [day, monthName, year] = dateText.replace(/,/g, "").trim().split(/\s+/);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return new Date(Number(year), months.indexOf(monthName), Number(day));
}

function getAssignmentDateOffset(daysFromToday) {
    const dueDate = new Date();
    dueDate.setHours(12, 0, 0, 0);
    dueDate.setDate(dueDate.getDate() + daysFromToday);

    return dueDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}



function formatAssignmentDate(dateText) {
    const [year, month, day] = dateText.split("-").map(Number);
    return new Date(year, month - 1, day, 12).toLocaleDateString("en-IN", {
        day: "2-digit", month: "long", year: "numeric"
    });
}

function toAssignmentDateInput(dateText) {
    const match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(dateText.trim());
    if (match) {
        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        const month = months.findIndex(x => x.toLowerCase() === match[2].toLowerCase()) + 1;
        if (month > 0) return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
    }
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const defaultAssignmentsData = [
    { title: "SQL Queries Practice", subject: "Database Management Systems", dueDate: getAssignmentDateOffset(4), status: "Pending" },
    { title: "Responsive Webpage", subject: "Web Development", dueDate: getAssignmentDateOffset(2), status: "Due Soon" },
    { title: "Python Basics", subject: "Python Programming", dueDate: getAssignmentDateOffset(7), status: "Pending" },
    { title: "Software Engineering Report", subject: "Software Engineering", dueDate: getAssignmentDateOffset(-3), status: "Completed" }
];

function loadAssignmentsData() {
    try {
        const saved = JSON.parse(localStorage.getItem("studentAssignments") || "null");
        if (!Array.isArray(saved)) return defaultAssignmentsData.map(x => ({ ...x }));
        return saved.filter(x =>
            x && typeof x.title === "string" && x.title.trim() &&
            typeof x.subject === "string" && x.subject.trim() &&
            typeof x.dueDate === "string" && !Number.isNaN(parseAssignmentDate(x.dueDate).getTime()) &&
            ["Pending", "Due Soon", "Completed"].includes(x.status)
        ).map(x => ({
            title: x.title.trim().slice(0, 120),
            subject: x.subject.trim().slice(0, 100),
            dueDate: x.dueDate.trim(),
            status: x.status
        }));
    } catch {
        return defaultAssignmentsData.map(x => ({ ...x }));
    }
}

let assignmentsData = loadAssignmentsData();

var assignmentsContainer = document.getElementById("assignmentsContainer");
var assignmentCount = document.getElementById("assignmentCount");
var assignmentSearch = document.getElementById("assignmentSearch");
var assignmentFilters = document.querySelectorAll(".assignment-filter");
var toggleAssignmentsEditor = document.getElementById("toggleAssignmentsEditor");
var assignmentsEditorCard = document.getElementById("assignmentsEditorCard");
var assignmentsEditorForm = document.getElementById("assignmentsEditorForm");
var assignmentsEditIndex = document.getElementById("assignmentsEditIndex");
var assignmentTitleInput = document.getElementById("assignmentTitleInput");
var assignmentSubjectInput = document.getElementById("assignmentSubjectInput");
var assignmentDueDateInput = document.getElementById("assignmentDueDateInput");
var assignmentStatusInput = document.getElementById("assignmentStatusInput");
var assignmentSaveButton = document.getElementById("assignmentSaveButton");
var assignmentCancelButton = document.getElementById("assignmentCancelButton");
var assignmentsEditorMessage = document.getElementById("assignmentsEditorMessage");
var assignmentsEditorTableBody = document.getElementById("assignmentsEditorTableBody");

function saveAssignmentsData() {
    try {
        localStorage.setItem("studentAssignments", JSON.stringify(assignmentsData));
        return true;
    } catch {
        if (assignmentsEditorMessage) assignmentsEditorMessage.textContent =
            "Unable to save. Check browser storage settings.";
        return false;
    }
}

function getAssignmentBadgeClass(status) {
    if (status === "Completed") return "bg-success";
    if (status === "Pending") return "bg-warning text-dark";
    if (status === "Due Soon") return "bg-danger";
    return "bg-secondary";
}

function applyAssignmentFilters() {
    const searchText = assignmentSearch ? assignmentSearch.value.trim().toLowerCase() : "";
    const selectedStatus = document.querySelector(".assignment-filter.active")?.getAttribute("data-status") || "All";

    if (!assignmentsContainer) return;
    assignmentsContainer.querySelectorAll(".assignment").forEach(item => {
        const matchesSearch = item.textContent.toLowerCase().includes(searchText);
        const matchesStatus = selectedStatus === "All" || item.getAttribute("data-status") === selectedStatus;
        item.style.display = matchesSearch && matchesStatus ? "flex" : "none";
    });
}

function renderAssignments() {
    if (assignmentsContainer) {
        assignmentsContainer.replaceChildren();
        assignmentsData.forEach(assignment => {
            const item = document.createElement("div");
            item.className = "assignment";
            item.setAttribute("data-status", assignment.status);

            const details = document.createElement("div");
            const title = document.createElement("h6");
            title.textContent = assignment.title;
            const description = document.createElement("p");
            description.textContent = `${assignment.subject} | Due: ${assignment.dueDate}`;
            details.append(title, description);

            const badge = document.createElement("span");
            badge.className = `badge ${getAssignmentBadgeClass(assignment.status)}`;
            badge.textContent = assignment.status;
            item.append(details, badge);
            assignmentsContainer.appendChild(item);
        });
    }

    if (assignmentCount) {
        assignmentCount.textContent = `${assignmentsData.length} Assignments`;
    }

    if (assignmentsEditorTableBody) {
        assignmentsEditorTableBody.replaceChildren();
        assignmentsData.forEach((assignment, index) => {
            const row = document.createElement("tr");
            [assignment.title, assignment.subject, assignment.dueDate, assignment.status].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });
            const actions = document.createElement("td");

            const edit = document.createElement("button");
            edit.type = "button";
            edit.className = "btn btn-sm btn-outline-primary me-2";
            edit.textContent = "Edit";
            edit.addEventListener("click", () => {
                assignmentsEditIndex.value = String(index);
                assignmentTitleInput.value = assignment.title;
                assignmentSubjectInput.value = assignment.subject;
                assignmentDueDateInput.value = toAssignmentDateInput(assignment.dueDate);
                assignmentStatusInput.value = assignment.status;
                assignmentSaveButton.textContent = "Save changes";
                assignmentCancelButton.hidden = false;
                assignmentsEditorMessage.textContent = `Editing ${assignment.title}.`;
                assignmentTitleInput.focus();
            });

            const del = document.createElement("button");
            del.type = "button";
            del.className = "btn btn-sm btn-outline-danger";
            del.textContent = "Delete";
            del.addEventListener("click", () => {
                if (!window.confirm(`Delete assignment "${assignment.title}"?`)) return;
                const previous = assignmentsData.map(x => ({ ...x }));
                assignmentsData.splice(index, 1);
                if (!saveAssignmentsData()) {
                    assignmentsData = previous;
                    renderAssignments();
                    return;
                }
                resetAssignmentsEditor();
                renderAssignments();
                assignmentsEditorMessage.textContent = "Assignment deleted.";
            });

            actions.append(edit, del);
            row.appendChild(actions);
            assignmentsEditorTableBody.appendChild(row);
        });
    }

    applyAssignmentFilters();

}

function resetAssignmentsEditor() {
    if (!assignmentsEditorForm) return;
    assignmentsEditorForm.reset();
    assignmentsEditIndex.value = "";
    assignmentSaveButton.textContent = "Add assignment";
    assignmentCancelButton.hidden = true;
}

function renderAssignmentDashboardSummaries() {
    const pending = assignmentsData.filter(x => x.status !== "Completed");
    const dueSoon = assignmentsData.filter(x => x.status === "Due Soon");

    const dashboardAssignments = document.getElementById("dashboardAssignments");
    if (dashboardAssignments) dashboardAssignments.textContent = assignmentsData.length;

    const dashboardAssignmentNote = document.getElementById("dashboardAssignmentNote");
    if (dashboardAssignmentNote) dashboardAssignmentNote.textContent =
        `${pending.length} pending ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${dueSoon.length} due soon`;

    const navAssignmentCount = document.getElementById("navAssignmentCount");
    if (navAssignmentCount) navAssignmentCount.textContent = pending.length;

    const heroSummary = document.getElementById("heroSummary");
    if (heroSummary) {
        const attendanceValue = document.getElementById("overallPercentage")?.textContent || "0%";
        const totalValue = document.getElementById("totalClasses")?.textContent || "0";
        const duePhrase = dueSoon.length === 1 ? "1 assignment is due soon" : `${dueSoon.length} assignments are due soon`;
        heroSummary.textContent = `Your attendance is ${attendanceValue} across ${totalValue} classes. ${duePhrase}; keep your next deadlines in view.`;
    }

    const dashboardUpcoming = document.getElementById("dashboardUpcoming");
    if (dashboardUpcoming) {
        const upcoming = pending.slice().sort((a, b) =>
            parseAssignmentDate(a.dueDate) - parseAssignmentDate(b.dueDate)
        ).slice(0, 3);

        if (!upcoming.length) {
            dashboardUpcoming.replaceChildren();
            const empty = document.createElement("div");
            empty.className = "dashboard-empty-state";
            const message = document.createElement("div");
            const strong = document.createElement("strong");
            strong.textContent = "All caught up";
            const detail = document.createElement("span");
            detail.textContent = "No upcoming assignments right now.";
            message.append(strong, detail);
            empty.append(message);
            dashboardUpcoming.appendChild(empty);
        } else {
            dashboardUpcoming.replaceChildren();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            upcoming.forEach(assignment => {
                const dueDate = parseAssignmentDate(assignment.dueDate);
                const dayDelta = Math.round((dueDate - today) / 86400000);
                const dueLabel = dayDelta < 0
                    ? `Overdue by ${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? "" : "s"}`
                    : dayDelta === 0 ? "Due today"
                    : dayDelta === 1 ? "Due tomorrow" : `Due in ${dayDelta} days`;

                const item = document.createElement("div");
                item.className = `upcoming-item ${assignment.status === "Due Soon" || dayDelta <= 2 ? "deadline-urgent" : ""}`;
                const dateBlock = document.createElement("div");
                dateBlock.className = "deadline-date";
                const day = document.createElement("strong");
                day.textContent = dueDate.toLocaleDateString("en-IN", { day: "2-digit" });
                const month = document.createElement("span");
                month.textContent = dueDate.toLocaleDateString("en-IN", { month: "short" });
                dateBlock.append(day, month);

                const copy = document.createElement("div");
                copy.className = "upcoming-copy";
                const title = document.createElement("strong");
                title.textContent = assignment.title;
                const subject = document.createElement("span");
                subject.textContent = assignment.subject;
                copy.append(title, subject);

                const label = document.createElement("span");
                label.className = "deadline-label";
                label.textContent = dueLabel;
                item.append(dateBlock, copy, label);
                dashboardUpcoming.appendChild(item);
            });
        }
    }
}

if (toggleAssignmentsEditor && assignmentsEditorCard) {
    toggleAssignmentsEditor.addEventListener("click", () => {
        assignmentsEditorCard.hidden = !assignmentsEditorCard.hidden;
        toggleAssignmentsEditor.textContent = assignmentsEditorCard.hidden
            ? "Manage Assignments" : "Close Assignments Editor";
    });
}

if (assignmentsEditorForm) {
    assignmentsEditorForm.addEventListener("submit", event => {
        event.preventDefault();
        if (!assignmentsEditorForm.reportValidity()) return;

        const title = assignmentTitleInput.value.trim();
        const subject = assignmentSubjectInput.value.trim();
        const dueDateValue = assignmentDueDateInput.value;
        const status = assignmentStatusInput.value;

        if (!title || !subject || !dueDateValue ||
            !["Pending", "Due Soon", "Completed"].includes(status)) {
            assignmentsEditorMessage.textContent = "Complete all fields with valid values.";
            return;
        }

        const assignment = {
            title: title.slice(0, 120),
            subject: subject.slice(0, 100),
            dueDate: formatAssignmentDate(dueDateValue),
            status
        };

        const editIndex = assignmentsEditIndex.value;
        const previous = assignmentsData.map(x => ({ ...x }));
        if (editIndex === "") {
            assignmentsData.push(assignment);
        } else {
            const index = Number(editIndex);
            if (!Number.isInteger(index) || !assignmentsData[index]) {
                assignmentsEditorMessage.textContent = "Record not found. Refresh and try again.";
                return;
            }
            assignmentsData[index] = assignment;
        }

        if (!saveAssignmentsData()) {
            assignmentsData = previous;
            renderAssignments();
            return;
        }

        resetAssignmentsEditor();
        renderAssignments();
        assignmentsEditorMessage.textContent = "Assignment saved on this device.";
    });
}

if (assignmentCancelButton) {
    assignmentCancelButton.addEventListener("click", () => {
        resetAssignmentsEditor();
        assignmentsEditorMessage.textContent = "Edit cancelled.";
    });
}

assignmentFilters.forEach(filter => {
    filter.addEventListener("click", () => {
        assignmentFilters.forEach(button => {
            button.classList.remove("active");
            button.setAttribute("aria-pressed", "false");
        });
        filter.classList.add("active");
        filter.setAttribute("aria-pressed", "true");
        applyAssignmentFilters();
    });
});

if (assignmentSearch) {
    assignmentSearch.addEventListener("input", applyAssignmentFilters);
}

renderAssignments();
renderAssignmentDashboardSummaries();

/* ================= DASHBOARD DATA ================= */

const welcomeName =
    document.getElementById("welcomeName");

if (welcomeName) {
    welcomeName.textContent =
        studentData.name;
}

const currentDate =
    document.getElementById("currentDate");

if (currentDate) {

    const today = new Date();

    currentDate.textContent =
        today.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );

}

const dashboardAttendance =
    document.getElementById("dashboardAttendance");

if (dashboardAttendance) {
    const dashboardCardTotalClasses = attendanceData.reduce(
        (sum, subject) => sum + Number(subject.total || 0), 0
    );
    const dashboardCardTotalPresent = attendanceData.reduce(
        (sum, subject) => sum + Number(subject.present || 0), 0
    );
    const dashboardCardPercentage = dashboardCardTotalClasses
        ? (dashboardCardTotalPresent / dashboardCardTotalClasses) * 100
        : 0;

    dashboardAttendance.textContent =
        `${dashboardCardPercentage.toFixed(1)}%`;
}

const dashboardAssignments =
    document.getElementById("dashboardAssignments");

if (dashboardAssignments) {

    dashboardAssignments.textContent =
        assignmentsData.length;

}

const dashboardCourses =
    document.getElementById("dashboardCourses");

if (dashboardCourses) {

    dashboardCourses.textContent =
        coursesData.length;

}

/* ================= DASHBOARD OVERVIEW ================= */

const dashboardTotalClasses = attendanceData.reduce(
    (sum, subject) => sum + Number(subject.total || 0), 0
);
const dashboardTotalPresent = attendanceData.reduce(
    (sum, subject) => sum + Number(subject.present || 0), 0
);
const dashboardOverallPercentage = dashboardTotalClasses
    ? (dashboardTotalPresent / dashboardTotalClasses) * 100
    : 0;

const heroAttendanceRing =
    document.getElementById("heroAttendanceRing");

if (heroAttendanceRing) {
    const attendanceAngle = Math.min(dashboardOverallPercentage, 100) * 3.6;
    heroAttendanceRing.style.setProperty(
        "--attendance-angle",
        `${attendanceAngle}deg`
    );
    heroAttendanceRing.setAttribute(
        "aria-label",
        `Attendance is ${dashboardOverallPercentage.toFixed(1)} percent`
    );
}

const heroAttendanceValue =
    document.getElementById("heroAttendanceValue");

if (heroAttendanceValue) {
    heroAttendanceValue.textContent = `${dashboardOverallPercentage.toFixed(1)}%`;
}

const attendanceInsight =
    document.getElementById("attendanceInsight");

if (attendanceInsight) {
    attendanceInsight.textContent = `Across ${dashboardTotalClasses} classes this semester`;
}

const pendingAssignments = assignmentsData.filter(function(assignment) {
    return assignment.status !== "Completed";
});

const dueSoonAssignments = assignmentsData.filter(function(assignment) {
    return assignment.status === "Due Soon";
});

const dashboardAssignmentNote =
    document.getElementById("dashboardAssignmentNote");

if (dashboardAssignmentNote) {
    dashboardAssignmentNote.textContent =
        `${pendingAssignments.length} pending ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· ${dueSoonAssignments.length} due soon`;
}

const navAssignmentCount =
    document.getElementById("navAssignmentCount");

if (navAssignmentCount) {
    navAssignmentCount.textContent = pendingAssignments.length;
}

const heroSummary =
    document.getElementById("heroSummary");

if (heroSummary) {
    const duePhrase = dueSoonAssignments.length === 1
        ? "1 assignment is due soon"
        : `${dueSoonAssignments.length} assignments are due soon`;
    heroSummary.textContent =
        `Your attendance is ${dashboardOverallPercentage.toFixed(1)}% across ${dashboardTotalClasses} classes. ${duePhrase}; keep your next deadlines in view.`;
}

const dashboardUpcoming =
    document.getElementById("dashboardUpcoming");

if (dashboardUpcoming) {
    const upcomingAssignments = assignmentsData
        .filter(function(assignment) {
            return assignment.status !== "Completed";
        })
        .sort(function(first, second) {
            return parseAssignmentDate(first.dueDate) - parseAssignmentDate(second.dueDate);
        })
        .slice(0, 3);

    if (upcomingAssignments.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "dashboard-empty-state";

        const mark = document.createElement("span");
        mark.className = "empty-state-mark";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = "\u2713";

        const message = document.createElement("div");

        const heading = document.createElement("strong");
        heading.textContent = "All caught up";

        const description = document.createElement("span");
        description.textContent = "No upcoming assignments right now.";

        message.append(heading, description);
        emptyState.append(mark, message);
        dashboardUpcoming.replaceChildren(emptyState);
    } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const assignmentItems = upcomingAssignments.map(function(assignment) {
            const dueDate = parseAssignmentDate(assignment.dueDate);
            const dayDelta = Math.round((dueDate - today) / 86400000);

            const dueLabel = dayDelta < 0
                ? `Overdue by ${Math.abs(dayDelta)} day${Math.abs(dayDelta) === 1 ? "" : "s"}`
                : dayDelta === 0
                    ? "Due today"
                    : dayDelta === 1
                        ? "Due tomorrow"
                        : `Due in ${dayDelta} days`;

            const urgency = assignment.status === "Due Soon" || dayDelta <= 2
                ? "deadline-urgent"
                : "";

            const item = document.createElement("div");
            item.className = `upcoming-item ${urgency}`;

            const dateContainer = document.createElement("div");
            dateContainer.className = "deadline-date";

            const day = document.createElement("strong");
            day.textContent = dueDate.toLocaleDateString("en-IN", {
                day: "2-digit"
            });

            const month = document.createElement("span");
            month.textContent = dueDate.toLocaleDateString("en-IN", {
                month: "short"
            });

            dateContainer.append(day, month);

            const copy = document.createElement("div");
            copy.className = "upcoming-copy";

            const title = document.createElement("strong");
            title.textContent = assignment.title;

            const subject = document.createElement("span");
            subject.textContent = assignment.subject;

            copy.append(title, subject);

            const label = document.createElement("span");
            label.className = "deadline-label";
            label.textContent = dueLabel;

            item.append(dateContainer, copy, label);

            return item;
        });

        dashboardUpcoming.replaceChildren(...assignmentItems);
    }
}
const dashboardCourseProgress =
    document.getElementById("dashboardCourseProgress");

if (dashboardCourseProgress) {
    const spotlightCourses = coursesData
        .slice()
        .sort(function(first, second) {
            return second.progress - first.progress;
        })
        .slice(0, 4);

    const courseItems = spotlightCourses.map(function(course) {
        const item = document.createElement("div");
        item.className = "course-progress-item";

        const heading = document.createElement("div");
        heading.className = "course-progress-heading";

        const name = document.createElement("strong");
        name.textContent = course.name;

        const percentage = document.createElement("span");
        percentage.textContent = `${course.progress}%`;

        heading.append(name, percentage);

        const track = document.createElement("div");
        track.className = "course-progress-track";
        track.setAttribute("role", "progressbar");
        track.setAttribute("aria-label", `${course.name} progress`);

        const progressValue = Math.min(
            100,
            Math.max(0, Number(course.progress) || 0)
        );

        track.setAttribute("aria-valuenow", String(progressValue));
        track.setAttribute("aria-valuemin", "0");
        track.setAttribute("aria-valuemax", "100");

        const bar = document.createElement("span");
        bar.style.width = `${progressValue}%`;

        track.appendChild(bar);
        item.append(heading, track);

        return item;
    });

    dashboardCourseProgress.replaceChildren(...courseItems);
}


/* ================= RECENT ACTIVITY ================= */

const activityData = [
    {
        title: "SQL Assignment Submitted",
        description: "Database Management Systems",
        time: "Today"
    },
    {
        title: "Web Development Course Completed",
        description: "Responsive Web Design",
        time: "Yesterday"
    },
    {
        title: "Python Practice Updated",
        description: "Completed basic programming exercises",
        time: "2 days ago"
    },
    {
        title: "Attendance Updated",
        description: "Current overall attendance recorded",
        time: "3 days ago"
    }
];

const activityContainer =
    document.getElementById("activityContainer");

if (activityContainer) {

    activityData.forEach(function(activity) {

        const activityItem =
            document.createElement("div");

        activityItem.className =
            "assignment";

        activityItem.innerHTML = `
            <div>
                <h6>${activity.title}</h6>
                <p>${activity.description}</p>
            </div>

            <span class="text-muted">
                ${activity.time}
            </span>
        `;

        activityContainer.appendChild(
            activityItem
        );

    });

}


/* ================= THEME TOGGLE ================= */

const themeToggle =
    document.getElementById("themeToggle");

const savedTheme =
    localStorage.getItem("theme");

if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
}

function updateThemeButton() {

    if (!themeToggle) {
        return;
    }

    if (document.body.classList.contains("dark-mode")) {

        themeToggle.textContent =
            "Light Mode";

    } else {

        themeToggle.textContent =
            "Dark Mode";

    }

}

updateThemeButton();

if (themeToggle) {

    themeToggle.addEventListener("click", function() {

        document.body.classList.toggle("dark-mode");

        if (
            document.body.classList.contains("dark-mode")
        ) {

            localStorage.setItem(
                "theme",
                "dark"
            );

        } else {

            localStorage.setItem(
                "theme",
                "light"
            );

        }

        updateThemeButton();

    });

}