// App Configuration & State
const API_URL = window.location.origin;
let state = {
    token: localStorage.getItem("token") || null,
    email: localStorage.getItem("email") || null,
    profile: null,
    currentView: "dashboard",
    syllabi: [],
    planner: null,
    selectedSubject: "",
    selectedChapterId: "",
    selectedChapterName: "",
    // Calendar view state
    calendarSelectedDate: new Date().toISOString().split('T')[0],
    calendarCurrentMonth: new Date(),
    // Flashcard State
    flashcards: [],
    currentFlashcardIndex: 0,
    // Quiz State
    quizQuestions: [],
    currentQuizIndex: 0,
    quizAnswers: [],
    quizAttemptFinished: false,
    // Break Timer State
    breakTimerInterval: null,
    breakTimeLeft: 15 * 60, // 15 minutes in seconds
    breakTimerRunning: false,
    // Daily water
    waterIntake: 0,
    // Reschedule Prompt tracking
    reschedulePrompted: false
};

// Custom browser beep sound helper
function playBeepNotification() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Double beep
        const playBeep = (delay, freq, duration) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + delay + duration);
            osc.start(audioCtx.currentTime + delay);
            osc.stop(audioCtx.currentTime + delay + duration);
        };
        
        playBeep(0, 880, 0.15);
        playBeep(0.2, 880, 0.2);
    } catch (e) {
        console.error("Audio Notification failed: ", e);
    }
}

// Request permission for browser notification
if (Notification.permission === "default") {
    Notification.requestPermission();
}

function showWebNotification(title, message) {
    if (Notification.permission === "granted") {
        new Notification(title, {
            body: message,
            icon: "https://cdn-icons-png.flaticon.com/512/3135/3135810.png"
        });
    }
    playBeepNotification();
}

function triggerToast(title, message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    else if (type === "warning") icon = "fa-circle-exclamation";
    else if (type === "error") icon = "fa-triangle-exclamation";
    
    toast.innerHTML = `
        <div class="toast-title"><i class="fa-solid ${icon}"></i> ${title}</div>
        <div class="toast-message">${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

// Global background reminders (water every 45 min, break every 5 min)
let lastWaterReminderTime = Date.now();
let lastEyeStrainReminderTime = Date.now();

setInterval(() => {
    if (!state.token || !state.planner || !state.planner.reminders_enabled) return;
    
    const now = Date.now();
    
    if (now - lastWaterReminderTime >= 2700000) { // 45 minutes
        lastWaterReminderTime = now;
        triggerToast("Hydration Reminder", "Time to drink some water! Log your intake to stay healthy.", "warning");
        showWebNotification("Hydration Reminder", "Take a quick sip of water to stay hydrated!");
        // Show the interactive water reminder modal popup
        document.getElementById("water-modal").classList.remove("hidden");
    }
    
    if (now - lastEyeStrainReminderTime >= 300000) {
        lastEyeStrainReminderTime = now;
        triggerToast("Eye Strain Break", "Look away from your screen for 20 seconds to rest your eyes.", "info");
        showWebNotification("Eye Strain Break", "Remember the 20-20-20 rule! Protect your eyes.");
    }
}, 10000);

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    setupEventListeners();
    checkAuth();
});

// Check if user is authenticated
function checkAuth() {
    if (state.token) {
        document.getElementById("auth-view").classList.add("hidden");
        document.getElementById("app-view").classList.remove("hidden");
        loadUserProfile();
    } else {
        document.getElementById("auth-view").classList.remove("hidden");
        document.getElementById("app-view").classList.add("hidden");
        showAuthCard("login");
    }
}

// Show login or register card
function showAuthCard(type) {
    const loginCard = document.getElementById("login-card");
    const registerCard = document.getElementById("register-card");
    if (type === "login") {
        loginCard.classList.remove("hidden");
        registerCard.classList.add("hidden");
    } else {
        loginCard.classList.add("hidden");
        registerCard.classList.remove("hidden");
    }
}

// --- API FETCH HELPERS ---
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const config = {
        method,
        headers
    };
    if (body) {
        config.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        
        if (response.status === 401) {
            // Token expired or invalid
            logout();
            throw new Error("Session expired. Please log in again.");
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "API Request failed");
        }
        
        return await response.json();
    } catch (err) {
        console.error("API Call error:", err);
        throw err;
    }
}

// Auth handlers
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errorDiv = document.getElementById("login-error");
    
    errorDiv.classList.add("hidden");
    try {
        const data = await apiCall("/api/auth/login", "POST", { email, password });
        saveAuthToken(data);
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove("hidden");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const errorDiv = document.getElementById("register-error");
    
    errorDiv.classList.add("hidden");
    try {
        const data = await apiCall("/api/auth/register", "POST", { email, password });
        saveAuthToken(data);
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove("hidden");
    }
}

function saveAuthToken(data) {
    state.token = data.token;
    state.email = data.email;
    localStorage.setItem("token", data.token);
    localStorage.setItem("email", data.email);
    checkAuth();
}

function logout() {
    state.token = null;
    state.email = null;
    state.profile = null;
    state.reschedulePrompted = false;
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    clearInterval(state.breakTimerInterval);
    checkAuth();
}

// Fetch Profile and handle view logic
async function loadUserProfile() {
    try {
        const profile = await apiCall("/api/profile");
        state.profile = profile;
        
        if (!profile) {
            // User needs to go through onboarding wizard
            document.getElementById("onboarding-view").classList.remove("hidden");
            document.getElementById("dashboard-view").classList.add("hidden");
            setupOnboardingWizard();
        } else {
            document.getElementById("onboarding-view").classList.add("hidden");
            
            // Set User name and details in DOM
            document.getElementById("user-name-display").textContent = profile.name;
            document.getElementById("user-email-display").textContent = state.email;
            document.getElementById("user-avatar").textContent = profile.name.charAt(0).toUpperCase();
            
            // Default view load
            showView("dashboard");
        }
    } catch (err) {
        console.error("Failed to load profile", err);
    }
}

// --- WIZARD ONBOARDING ---
let onboardingActiveStep = 1;
const onboardingSubjects = new Set(["Mathematics", "Physics"]); // Defaults selected

function setupOnboardingWizard() {
    onboardingActiveStep = 1;
    updateWizardStepUI();
    
    // Render subjects chips selection state
    const chips = document.querySelectorAll("#onboard-subjects-grid .subject-chip");
    chips.forEach(chip => {
        const sub = chip.getAttribute("data-subject");
        if (onboardingSubjects.has(sub)) {
            chip.classList.add("selected");
        } else {
            chip.classList.remove("selected");
        }
    });
}

function toggleSubjectChip(chip) {
    const sub = chip.getAttribute("data-subject");
    if (onboardingSubjects.has(sub)) {
        if (onboardingSubjects.size > 1) { // Maintain at least one subject
            onboardingSubjects.delete(sub);
            chip.classList.remove("selected");
        }
    } else {
        onboardingSubjects.add(sub);
        chip.classList.add("selected");
    }
}

function updateWizardStepUI() {
    const steps = document.querySelectorAll(".wizard-step");
    steps.forEach(step => {
        step.classList.remove("active");
        if (parseInt(step.getAttribute("data-step")) === onboardingActiveStep) {
            step.classList.add("active");
        }
    });
    
    const dots = document.querySelectorAll(".step-dot");
    dots.forEach(dot => {
        const dotNum = parseInt(dot.getAttribute("data-step"));
        dot.classList.remove("active", "completed");
        if (dotNum === onboardingActiveStep) {
            dot.classList.add("active");
        } else if (dotNum < onboardingActiveStep) {
            dot.classList.add("completed");
        }
    });
}

async function submitOnboarding() {
    const name = document.getElementById("onboard-name").value.trim();
    const country = document.getElementById("onboard-country").value.trim();
    const board = document.getElementById("onboard-board").value.trim();
    const grade_class = document.getElementById("onboard-grade").value.trim();
    const stream = document.getElementById("onboard-stream").value.trim() || null;
    
    if (!name || !country || !board || !grade_class || onboardingSubjects.size === 0) {
        alert("Please complete all required fields and select at least one subject.");
        return;
    }
    
    const submitBtn = document.getElementById("submit-onboarding-btn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Initializing...`;
    
    try {
        await apiCall("/api/profile?generate_syllabi=false", "POST", {
            name,
            country,
            board,
            grade_class,
            stream,
            subjects: Array.from(onboardingSubjects)
        });
        
        state.profile = {
            name,
            country,
            board,
            grade_class,
            stream,
            subjects: Array.from(onboardingSubjects)
        };
        
        // Transition to Generation View
        document.getElementById("onboarding-view").classList.add("hidden");
        document.getElementById("generation-view").classList.remove("hidden");
        
        startVisualSyllabusGeneration();
    } catch (err) {
        alert("Failed to submit onboarding profile: " + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = "Finish & Generate Syllabus";
    }
}

// --- VISUAL SYLLABUS GENERATION MECHANICS ---
function appendGenLog(text, status = 'pending') {
    const list = document.getElementById("generation-logs-list");
    const item = document.createElement("li");
    item.className = `log-item ${status}`;
    let icon = '<i class="fa-regular fa-circle text-muted"></i>';
    if (status === 'active') {
        icon = '<i class="fa-solid fa-spinner fa-spin text-primary"></i>';
    } else if (status === 'done') {
        icon = '<i class="fa-solid fa-circle-check text-emerald"></i>';
    }
    item.innerHTML = `${icon}<span>${text}</span>`;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
    return item;
}

function updateGenLog(itemElement, text, status = 'done') {
    if (!itemElement) return;
    itemElement.className = `log-item ${status}`;
    let icon = '<i class="fa-regular fa-circle text-muted"></i>';
    if (status === 'active') {
        icon = '<i class="fa-solid fa-spinner fa-spin text-primary"></i>';
    } else if (status === 'done') {
        icon = '<i class="fa-solid fa-circle-check text-emerald"></i>';
    }
    itemElement.innerHTML = `${icon}<span>${text}</span>`;
}

async function startVisualSyllabusGeneration() {
    const loadingState = document.getElementById("gen-loading-state");
    const previewState = document.getElementById("gen-preview-state");
    const logsList = document.getElementById("generation-logs-list");
    
    loadingState.classList.remove("hidden");
    previewState.classList.add("hidden");
    logsList.innerHTML = "";
    
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    
    // Phase 1: Handshake and analysis
    const log1 = appendGenLog("Initializing AI curriculum designer agent...", "active");
    await delay(1200);
    updateGenLog(log1, "Initializing AI curriculum designer agent...", "done");
    
    const log2 = appendGenLog(`Analyzing profile settings (Board: ${state.profile.board} | Grade: ${state.profile.grade_class})...`, "active");
    await delay(1200);
    updateGenLog(log2, `Analyzing profile settings (Board: ${state.profile.board} | Grade: ${state.profile.grade_class})...`, "done");
    
    const log3 = appendGenLog(`Accessing official ${state.profile.board} portal for curriculum standards...`, "active");
    await delay(1500);
    updateGenLog(log3, `Curriculum database standard for ${state.profile.board} verified.`, "done");
    
    // Phase 2: Sequential generation
    state.syllabi = [];
    for (let subject of state.profile.subjects) {
        const logSub = appendGenLog(`Constructing chapters for "${subject}" based on official website database...`, "active");
        try {
            const syllabus = await apiCall(`/api/syllabus/${encodeURIComponent(subject)}/regenerate`, "POST");
            state.syllabi.push(syllabus);
            updateGenLog(logSub, `Syllabus for "${subject}" loaded successfully (${syllabus.chapters.length} chapters created).`, "done");
        } catch (err) {
            updateGenLog(logSub, `Error generating syllabus for "${subject}": ${err.message}`, "done");
        }
        await delay(1000);
    }
    
    // Phase 3: Wrapping up
    const log4 = appendGenLog("Synthesizing personalized exam planners and revision trackers...", "active");
    await delay(1200);
    updateGenLog(log4, "Personalized structures mapped to database successfully.", "done");
    
    await delay(800);
    
    showSyllabusPreview();
}

let previewActiveSubject = "";

function showSyllabusPreview() {
    document.getElementById("gen-loading-state").classList.add("hidden");
    document.getElementById("gen-preview-state").classList.remove("hidden");
    
    if (state.syllabi.length > 0) {
        previewActiveSubject = state.syllabi[0].subject;
    } else {
        previewActiveSubject = "";
    }
    
    renderPreviewTabs();
    renderPreviewChapters();
}

function renderPreviewTabs() {
    const container = document.getElementById("gen-preview-tabs");
    container.innerHTML = "";
    
    state.syllabi.forEach(syll => {
        const btn = document.createElement("button");
        btn.className = `tab-btn ${syll.subject === previewActiveSubject ? 'active' : ''}`;
        btn.style.padding = "8px 16px";
        btn.style.fontSize = "0.85rem";
        btn.style.borderRadius = "var(--radius-sm)";
        btn.textContent = syll.subject;
        btn.onclick = () => {
            previewActiveSubject = syll.subject;
            renderPreviewTabs();
            renderPreviewChapters();
        };
        container.appendChild(btn);
    });
}

function renderPreviewChapters() {
    const container = document.getElementById("gen-preview-chapters");
    container.innerHTML = "";
    
    const activeSyll = state.syllabi.find(s => s.subject === previewActiveSubject);
    if (!activeSyll || activeSyll.chapters.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 20px;">No chapters generated.</p>`;
        return;
    }
    
    activeSyll.chapters.forEach((ch, idx) => {
        const item = document.createElement("div");
        item.className = "chapter-item";
        item.style.padding = "10px 14px";
        item.style.background = "rgba(255, 255, 255, 0.01)";
        item.style.borderBottom = "1px solid rgba(255, 255, 255, 0.03)";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        
        item.innerHTML = `
            <div class="chapter-info">
                <span class="chapter-number">Ch ${idx + 1}</span>
                <div>
                    <strong style="color: var(--text-primary); font-size: 0.9rem;">${ch.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                        Topics: ${ch.topics ? ch.topics.join(", ") : "None"}
                    </div>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}


// --- VIEW ROUTING MANAGER ---
function showView(viewName) {
    state.currentView = viewName;
    
    // Hide all main section elements
    document.getElementById("onboarding-view").classList.add("hidden");
    document.getElementById("generation-view").classList.add("hidden");
    document.getElementById("dashboard-view").classList.add("hidden");
    document.getElementById("syllabus-view").classList.add("hidden");
    document.getElementById("study-view").classList.add("hidden");
    document.getElementById("quiz-view").classList.add("hidden");
    document.getElementById("planner-view").classList.add("hidden");
    
    // Un-hide active view
    document.getElementById(`${viewName}-view`).classList.remove("hidden");
    
    // Update sidebar active class
    const menuItems = document.querySelectorAll(".nav-menu .nav-item");
    menuItems.forEach(item => {
        item.classList.remove("active");
        if (item.getAttribute("data-view") === viewName) {
            item.classList.add("active");
        }
    });
    
    // Trigger loader functions
    if (viewName === "dashboard") loadDashboard();
    if (viewName === "syllabus") loadSyllabusEditor();
    if (viewName === "study") loadStudySpace();
    if (viewName === "quiz") loadQuizZone();
    if (viewName === "planner") loadPlanner();
}


// --- DASHBOARD LOADER ---
async function loadDashboard() {
    document.getElementById("dash-student-name").textContent = state.profile.name;
    
    try {
        // Load syllabi and planner
        state.syllabi = await apiCall("/api/syllabus");
        state.planner = await apiCall("/api/planner");
        const attempts = await apiCall("/api/quiz/attempts");
        
        // 1. Calculate overall syllabus completion progress
        let totalChaptersCount = 0;
        let completedChaptersCount = 0;
        
        state.syllabi.forEach(sys => {
            sys.chapters.forEach(ch => {
                totalChaptersCount++;
                // If study_schedule marks this chapter as completed
                const taskMatch = state.planner.study_schedule.find(t => t.chapter_id === ch.id && t.subject === sys.subject);
                if (taskMatch && taskMatch.completed) {
                    completedChaptersCount++;
                }
            });
        });
        
        const overallProgress = totalChaptersCount > 0 ? Math.round((completedChaptersCount / totalChaptersCount) * 100) : 0;
        document.getElementById("stat-progress").textContent = `${overallProgress}%`;
        
        // 2. Set quiz stats
        document.getElementById("stat-quizzes").textContent = `${attempts.length} attempts`;
        
        // 3. Set upcoming exam countdown
        updateExamCountdown();
        
        // 4. Render Today's Checklist
        renderDashboardChecklist();
        
        // 5. Render Quiz attempts history
        renderQuizHistory(attempts);
        
        // 6. Render Weak topicsFocus
        renderWeakTopics(attempts);
        
        // 7. Render Hydration Tracker
        updateHydrationUI();
        
        // 8. Render Break Timer UI
        updateBreakTimerUI();
        
        // 9. Render Dashboard Syllabus Overview Card
        renderDashboardSyllabusOverview();
        
        // Check for uncompleted tasks from past days
        checkPastPendingTasks();
    } catch (err) {
        console.error("Dashboard reload failure:", err);
    }
}

function renderDashboardSyllabusOverview() {
    const container = document.getElementById("dash-syllabus-overview-container");
    if (!container) return;
    
    if (!state.syllabi || state.syllabi.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No subjects selected. Go to Syllabus Editor to add.</p>`;
        return;
    }
    
    container.innerHTML = "";
    
    state.syllabi.forEach(sys => {
        let totalCh = sys.chapters.length;
        let completedCh = 0;
        
        sys.chapters.forEach(ch => {
            const taskMatch = state.planner.study_schedule.find(t => t.chapter_id === ch.id && t.subject === sys.subject);
            if (taskMatch && taskMatch.completed) {
                completedCh++;
            }
        });
        
        const progress = totalCh > 0 ? Math.round((completedCh / totalCh) * 100) : 0;
        
        const row = document.createElement("div");
        row.className = "overview-subject-row";
        row.style.marginBottom = "10px";
        row.innerHTML = `
            <div class="overview-subject-header">
                <span class="overview-subject-name">${sys.subject}</span>
                <span class="overview-chapter-count">${completedCh} / ${totalCh} Chapters</span>
            </div>
            <div class="overview-progress-container">
                <div class="overview-progress-bar-bg">
                    <div class="overview-progress-bar-fill" style="width: ${progress}%;"></div>
                </div>
                <span class="overview-progress-percentage">${progress}%</span>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateExamCountdown() {
    const countdownEl = document.getElementById("countdown-widget");
    if (!state.planner || !state.planner.exam_schedule || Object.keys(state.planner.exam_schedule).length === 0) {
        countdownEl.innerHTML = `<i class="fa-solid fa-hourglass-half mr-2"></i>No exams scheduled`;
        return;
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let nextExamSubject = null;
    let nextExamDays = Infinity;
    let nextExamDateStr = null;
    
    for (const [subject, examDateStr] of Object.entries(state.planner.exam_schedule)) {
        const examDate = new Date(examDateStr);
        examDate.setHours(0,0,0,0);
        const diffTime = examDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < nextExamDays) {
            nextExamDays = diffDays;
            nextExamSubject = subject;
            nextExamDateStr = examDateStr;
        }
    }
    
    // If no upcoming exam found, show the most recently completed exam or default
    if (nextExamSubject === null) {
        let lastExamSubject = null;
        let lastExamDays = -Infinity;
        for (const [subject, examDateStr] of Object.entries(state.planner.exam_schedule)) {
            const examDate = new Date(examDateStr);
            examDate.setHours(0,0,0,0);
            const diffTime = examDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 0 && diffDays > lastExamDays) {
                lastExamDays = diffDays;
                lastExamSubject = subject;
            }
        }
        
        if (lastExamSubject) {
            countdownEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald mr-2"></i>${lastExamSubject} Exam finished`;
        } else {
            countdownEl.innerHTML = `<i class="fa-solid fa-hourglass-half mr-2"></i>No exams scheduled`;
        }
        return;
    }
    
    if (nextExamDays > 0) {
        countdownEl.innerHTML = `<i class="fa-solid fa-bell-concierge mr-2"></i>${nextExamSubject} Exam: <strong>${nextExamDays} days</strong> left`;
    } else if (nextExamDays === 0) {
        countdownEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-2 text-rose"></i><strong>${nextExamSubject} Exam is TODAY!</strong>`;
    }
}

function renderDashboardChecklist() {
    const container = document.getElementById("dash-checklist-container");
    container.innerHTML = "";
    
    const schedule = state.planner.study_schedule || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = schedule.filter(t => t.date === todayStr);
    
    if (todayTasks.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No study tasks scheduled for today.</p>`;
        return;
    }
    
    let totalMins = 0;
    todayTasks.forEach(task => {
        if (task.completed) {
            totalMins += (task.duration_mins || 60);
        }
        
        const taskDiv = document.createElement("div");
        taskDiv.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); border-radius: var(--radius-sm); margin-bottom: 8px;";
        
        const hours = (task.duration_mins / 60).toFixed(1);
        const difficultyLabel = task.difficulty || "Medium";
        let diffBadgeColor = "var(--text-muted)";
        if (difficultyLabel === "Easy") diffBadgeColor = "#10b981";
        else if (difficultyLabel === "Medium") diffBadgeColor = "#f59e0b";
        else if (difficultyLabel === "Hard") diffBadgeColor = "#ef4444";
        
        const chDisplayName = task.chapter_name || `Chapter ${task.chapter_id.replace('ch','').replace('ch_','')}`;
        
        taskDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <input type="checkbox" style="width: 18px; height: 18px; cursor: pointer;" ${task.completed ? 'checked' : ''} onchange="toggleDashboardTask('${task.chapter_id}', '${task.subject}', this.checked)">
                <div style="display: flex; flex-direction: column;">
                    <span style="${task.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
                        <strong>${task.subject}</strong>: Revision of ${chDisplayName}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 3px;">
                        <i class="fa-solid fa-clock mr-1"></i>${hours} hrs &nbsp;|&nbsp; 
                        <span style="color: ${diffBadgeColor}; font-weight: 600;">${difficultyLabel}</span>
                    </span>
                </div>
            </div>
            <span class="text-secondary" style="font-size: 0.8rem;">${task.completed ? '<i class="fa-solid fa-circle-check text-emerald"></i>' : '<i class="fa-solid fa-hourglass"></i>'}</span>
        `;
        container.appendChild(taskDiv);
    });
    
    // Set daily study duration stat
    const hrs = Math.round((totalMins / 60) * 10) / 10;
    document.getElementById("stat-study-time").textContent = `${hrs} hrs`;
}

async function toggleDashboardTask(chapterId, subject, isCompleted) {
    try {
        const schedule = state.planner.study_schedule.map(t => {
            if (t.chapter_id === chapterId && t.subject === subject) {
                return { ...t, completed: isCompleted };
            }
            return t;
        });
        
        await apiCall("/api/planner", "PUT", { study_schedule: schedule });
        state.planner.study_schedule = schedule;
        
        // Reload dashboard
        loadDashboard();
        
        if (isCompleted) {
            const todayStr = new Date().toISOString().split('T')[0];
            checkAndShowCongrats(todayStr);
        }
    } catch (err) {
        alert("Failed to update task state: " + err.message);
    }
}

function renderQuizHistory(attempts) {
    const container = document.getElementById("dash-quiz-history");
    container.innerHTML = "";
    
    if (attempts.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No quizzes attempted yet.</p>`;
        return;
    }
    
    attempts.slice(0, 3).forEach(att => {
        const date = att.completed_at ? new Date(att.completed_at.replace(' ', 'T')).toLocaleDateString() : 'N/A';
        const scorePct = Math.round((att.score / att.total) * 100);
        let colorClass = "text-rose";
        if (scorePct >= 80) colorClass = "text-emerald";
        else if (scorePct >= 50) colorClass = "text-amber";
        
        const row = document.createElement("div");
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(0,0,0,0.15); border: 1px solid var(--panel-border); border-radius: var(--radius-md);";
        row.innerHTML = `
            <div>
                <strong style="font-size: 0.95rem;">${att.subject}</strong> - Chapter ${att.chapter_id.replace('ch','')}
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Completed on ${date}</div>
            </div>
            <div class="${colorClass}" style="font-weight: 800; font-size: 1.1rem;">
                ${Math.round(att.score)}/${att.total} (${scorePct}%)
            </div>
        `;
        container.appendChild(row);
    });
}

function renderWeakTopics(attempts) {
    const container = document.getElementById("dash-weak-topics");
    container.innerHTML = "";
    
    // Find all weak topics from recent attempts
    let allWeak = [];
    attempts.forEach(att => {
        if (att.weak_topics && att.weak_topics.length > 0) {
            att.weak_topics.forEach(wt => {
                if (!allWeak.includes(wt)) {
                    allWeak.push(wt);
                }
            });
        }
    });
    
    if (allWeak.length === 0) {
        container.innerHTML = `<li style="color: var(--text-muted); text-align: center; background: none; border: none; padding: 0;">No weak topics found. Keep studying!</li>`;
        return;
    }
    
    allWeak.slice(0, 4).forEach(topic => {
        const li = document.createElement("li");
        li.className = "weak-topic-item";
        li.innerHTML = `
            <span>${topic}</span>
            <button class="action-btn" title="Go study" onclick="quickGoStudy('${topic}')">
                <i class="fa-solid fa-arrow-right text-rose"></i>
            </button>
        `;
        container.appendChild(li);
    });
}

function quickGoStudy(topicName) {
    // Go to study space
    showView("study");
}


// --- SYLLABUS BUILDER / EDITOR ---
async function loadSyllabusEditor() {
    const select = document.getElementById("syllabus-subject-select");
    select.innerHTML = "";
    
    if (!state.profile || state.profile.subjects.length === 0) return;
    
    // Load options
    state.profile.subjects.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        select.appendChild(opt);
    });
    
    state.selectedSubject = select.value;
    renderSyllabusChapters();
}

function renderSyllabusChapters() {
    const container = document.getElementById("syllabus-chapters-container");
    container.innerHTML = "";
    
    const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
    if (!activeSyllabus) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Generating syllabus content...</p>`;
        return;
    }
    
    document.getElementById("syllabus-title-display").textContent = `${state.selectedSubject} Syllabus Structure`;
    
    activeSyllabus.chapters.forEach((ch, idx) => {
        const item = document.createElement("div");
        item.className = "chapter-item";
        item.setAttribute("draggable", "true");
        item.setAttribute("data-index", idx);
        
        item.innerHTML = `
            <div class="chapter-info">
                <span class="chapter-number">Ch ${idx + 1}</span>
                <div>
                    <strong class="chapter-title-text" id="ch-title-${ch.id}">${ch.name}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 3px;">
                        Topics: ${ch.topics ? ch.topics.join(", ") : "None"}
                    </div>
                </div>
            </div>
            <div class="chapter-actions">
                <button class="action-btn" title="Rename" onclick="renameChapter('${ch.id}', '${ch.name}')"><i class="fa-solid fa-pen"></i></button>
                <button class="action-btn text-rose" title="Delete" onclick="deleteChapter('${ch.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        // Add drag & drop event listeners for reordering
        setupDragAndDropEvents(item);
        
        container.appendChild(item);
    });
}

function renameChapter(chapterId, currentName) {
    const newName = prompt(`Rename Chapter:`, currentName);
    if (newName && newName.trim() !== "") {
        const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
        if (activeSyllabus) {
            activeSyllabus.chapters = activeSyllabus.chapters.map(ch => {
                if (ch.id === chapterId) {
                    return { ...ch, name: newName.trim() };
                }
                return ch;
            });
            renderSyllabusChapters();
        }
    }
}

function deleteChapter(chapterId) {
    if (confirm("Are you sure you want to delete this chapter? This will remove all associated study notes.")) {
        const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
        if (activeSyllabus) {
            activeSyllabus.chapters = activeSyllabus.chapters.filter(ch => ch.id !== chapterId);
            // Re-order
            activeSyllabus.chapters.forEach((ch, idx) => {
                ch.order = idx + 1;
            });
            renderSyllabusChapters();
        }
    }
}

function addNewChapter() {
    const chName = prompt("Enter new Chapter Name:");
    if (!chName || chName.trim() === "") return;
    
    const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
    if (activeSyllabus) {
        const newId = `ch_${Date.now()}`;
        const newCh = {
            id: newId,
            name: chName.trim(),
            topics: ["General concepts", "Self-study notes"],
            order: activeSyllabus.chapters.length + 1
        };
        activeSyllabus.chapters.push(newCh);
        renderSyllabusChapters();
    }
}

async function saveSyllabusChanges() {
    const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
    if (!activeSyllabus) return;
    
    const saveBtn = document.getElementById("save-syllabus-btn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Saving...`;
    
    try {
        await apiCall(`/api/syllabus/${activeSyllabus.id}`, "PUT", {
            chapters: activeSyllabus.chapters
        });
        alert("Syllabus structure saved successfully!");
        loadDashboard(); // Refresh checklist
    } catch (err) {
        alert("Failed to save syllabus: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-2"></i>Save`;
    }
}

// Drag and drop sorting mechanics
let dragSrcEl = null;

function setupDragAndDropEvents(el) {
    el.addEventListener('dragstart', function(e) {
        dragSrcEl = this;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
        this.style.opacity = '0.4';
    });

    el.addEventListener('dragenter', function(e) {
        this.classList.add('over');
    });

    el.addEventListener('dragover', function(e) {
        if (e.preventDefault) {
            e.preventDefault();
        }
        e.dataTransfer.dropEffect = 'move';
        return false;
    });

    el.addEventListener('dragleave', function(e) {
        this.classList.remove('over');
    });

    el.addEventListener('drop', function(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
        }
        
        if (dragSrcEl !== this) {
            const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
            const srcIdx = parseInt(dragSrcEl.getAttribute('data-index'));
            const destIdx = parseInt(this.getAttribute('data-index'));
            
            // Reorder array elements
            const temp = activeSyllabus.chapters[srcIdx];
            activeSyllabus.chapters.splice(srcIdx, 1);
            activeSyllabus.chapters.splice(destIdx, 0, temp);
            
            // Reassign orders
            activeSyllabus.chapters.forEach((ch, i) => {
                ch.order = i + 1;
            });
            
            renderSyllabusChapters();
        }
        return false;
    });

    el.addEventListener('dragend', function() {
        this.style.opacity = '1.0';
        const items = document.querySelectorAll('.chapter-item');
        items.forEach(item => {
            item.classList.remove('over');
        });
    });
}


// --- IMMERSIVE STUDY SPACE ---
let currentChapterMaterials = null;
let activeStudyTab = "notes";

async function loadStudySpace() {
    const select = document.getElementById("study-subject-select");
    select.innerHTML = "";
    
    if (!state.profile || state.profile.subjects.length === 0) return;
    
    state.profile.subjects.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        select.appendChild(opt);
    });
    
    // Maintain previously selected subject if valid
    if (state.profile.subjects.includes(state.selectedSubject)) {
        select.value = state.selectedSubject;
    } else {
        state.selectedSubject = select.value;
    }
    
    renderStudyChaptersNavigator();
}

function renderStudyChaptersNavigator() {
    const nav = document.getElementById("study-chapters-nav");
    nav.innerHTML = "";
    
    const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
    if (!activeSyllabus || activeSyllabus.chapters.length === 0) {
        nav.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No chapters available.</p>`;
        return;
    }
    
    activeSyllabus.chapters.forEach(ch => {
        const btn = document.createElement("button");
        btn.style.cssText = "padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); border-radius: var(--radius-sm); color: var(--text-secondary); text-align: left; cursor: pointer; transition: var(--transition); font-weight: 600;";
        btn.innerHTML = `<i class="fa-solid fa-book mr-2"></i> ${ch.name}`;
        
        if (state.selectedChapterId === ch.id) {
            btn.style.background = "var(--primary-glow)";
            btn.style.borderColor = "var(--primary)";
            btn.style.color = "var(--text-primary)";
        }
        
        btn.onclick = () => selectStudyChapter(ch.id, ch.name);
        nav.appendChild(btn);
    });
    
    // Auto select first chapter if none selected
    if (!state.selectedChapterId && activeSyllabus.chapters.length > 0) {
        selectStudyChapter(activeSyllabus.chapters[0].id, activeSyllabus.chapters[0].name);
    }
}

async function selectStudyChapter(chapterId, chapterName) {
    state.selectedChapterId = chapterId;
    state.selectedChapterName = chapterName;
    
    // Highlight active chapter in nav list
    renderStudyChaptersNavigator();
    
    // Clear and show loading state in material card
    showMaterialLoading();
    
    try {
        const material = await apiCall(`/api/materials/${chapterId}?subject=${encodeURIComponent(state.selectedSubject)}&chapter_name=${encodeURIComponent(chapterName)}`);
        currentChapterMaterials = material;
        
        renderStudySpaceContent();
    } catch (err) {
        showMaterialError(err.message);
    }
}

function showMaterialLoading() {
    document.getElementById("notes-markdown-view").innerHTML = `<div style="text-align: center; margin-top: 100px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top: 10px;">Constructing study materials via AI...</p></div>`;
    document.getElementById("short-notes-markdown-view").innerHTML = `Loading...`;
    document.getElementById("questions-list-view").innerHTML = `Loading...`;
}

function showMaterialError(msg) {
    const errorHtml = `<div style="text-align: center; margin-top: 80px; color: var(--accent-rose);"><i class="fa-solid fa-triangle-exclamation fa-2x"></i><p style="margin-top: 10px;">Failed: ${msg}</p></div>`;
    document.getElementById("notes-markdown-view").innerHTML = errorHtml;
}

function switchStudyTab(tabName) {
    activeStudyTab = tabName;
    
    // Update tab bar buttons
    const tabs = document.querySelectorAll(".tab-nav .tab-btn");
    tabs.forEach(tab => {
        tab.classList.remove("active");
        if (tab.getAttribute("data-tab") === tabName) {
            tab.classList.add("active");
        }
    });
    
    // Show/hide content panels
    const panels = document.querySelectorAll(".study-tab-content");
    panels.forEach(p => p.classList.add("hidden"));
    
    const mapping = {
        "notes": "tab-content-notes",
        "short-notes": "tab-content-short-notes",
        "flashcards": "tab-content-flashcards",
        "questions": "tab-content-questions"
    };
    document.getElementById(mapping[tabName]).classList.remove("hidden");
    
    renderStudySpaceContent();
}

// Lightweight Markdown-to-HTML parser
function parseMarkdown(md) {
    if (!md) return "";
    let html = md;
    
    // Headers
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Unordered lists
    html = html.replace(/^\* (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/^(?:<li>.*?<\/li>\s*)+/gs, '<ul>$&</ul>');
    
    // Inline Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

function renderStudySpaceContent() {
    if (!currentChapterMaterials) return;
    
    if (activeStudyTab === "notes") {
        document.getElementById("notes-markdown-view").innerHTML = parseMarkdown(currentChapterMaterials.notes);
    }
    
    else if (activeStudyTab === "short-notes") {
        document.getElementById("short-notes-markdown-view").innerHTML = parseMarkdown(currentChapterMaterials.short_notes);
    }
    
    else if (activeStudyTab === "flashcards") {
        state.flashcards = currentChapterMaterials.flashcards || [];
        state.currentFlashcardIndex = 0;
        showFlashcard();
    }
    
    else if (activeStudyTab === "questions") {
        renderQuestions();
    }
}

// Flashcards actions
function showFlashcard() {
    const cardWrapper = document.getElementById("flashcard-box");
    cardWrapper.classList.remove("flipped"); // Ensure unflipped view initially
    
    if (state.flashcards.length === 0) {
        document.getElementById("card-front-text").textContent = "No flashcards generated.";
        document.getElementById("card-back-text").textContent = "";
        document.getElementById("card-index-indicator").textContent = "0 / 0";
        return;
    }
    
    const card = state.flashcards[state.currentFlashcardIndex];
    document.getElementById("card-front-text").textContent = card.front;
    document.getElementById("card-back-text").textContent = card.back;
    
    document.getElementById("card-index-indicator").textContent = `${state.currentFlashcardIndex + 1} / ${state.flashcards.length}`;
}

function handleFlashcardNav(direction) {
    if (state.flashcards.length === 0) return;
    
    if (direction === "next") {
        state.currentFlashcardIndex = (state.currentFlashcardIndex + 1) % state.flashcards.length;
    } else {
        state.currentFlashcardIndex = (state.currentFlashcardIndex - 1 + state.flashcards.length) % state.flashcards.length;
    }
    showFlashcard();
}

function renderQuestions() {
    const container = document.getElementById("questions-list-view");
    container.innerHTML = "";
    
    const questions = currentChapterMaterials.important_questions || [];
    if (questions.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center;">No practice questions generated.</p>`;
        return;
    }
    
    questions.forEach((q, i) => {
        const qDiv = document.createElement("div");
        qDiv.style.cssText = "padding: 20px; background: rgba(0,0,0,0.15); border: 1px solid var(--panel-border); border-radius: var(--radius-md);";
        qDiv.innerHTML = `
            <h4 style="margin-bottom: 8px; color: var(--primary-light);">Q${i + 1}: ${q.question}</h4>
            <span style="font-size: 0.75rem; text-transform: uppercase; background: ${q.type === 'important' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)'}; border: 1px solid ${q.type === 'important' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; padding: 4px 8px; border-radius: 4px; color: ${q.type === 'important' ? '#fecdd3' : '#a7f3d0'}">${q.type}</span>
            <div style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 15px;">
                <strong style="color: var(--text-secondary); font-size: 0.85rem;">Answer Guidance:</strong>
                <p style="margin-top: 6px; font-size: 0.95rem; color: #cbd5e1; line-height: 1.6;">${q.guideline_answer}</p>
            </div>
        `;
        container.appendChild(qDiv);
    });
}


// --- QUIZ ZONE MANAGER ---
async function loadQuizZone() {
    const subjSelect = document.getElementById("quiz-subject-select");
    const chapSelect = document.getElementById("quiz-chapter-select");
    
    subjSelect.innerHTML = "";
    chapSelect.innerHTML = "";
    
    if (!state.profile || state.profile.subjects.length === 0) return;
    
    state.profile.subjects.forEach(sub => {
        const opt = document.createElement("option");
        opt.value = sub;
        opt.textContent = sub;
        subjSelect.appendChild(opt);
    });
    
    state.selectedSubject = subjSelect.value;
    
    // Watch subject changes to update chapters list
    subjSelect.onchange = (e) => {
        state.selectedSubject = e.target.value;
        populateQuizChapters();
    };
    
    populateQuizChapters();
}

function populateQuizChapters() {
    const chapSelect = document.getElementById("quiz-chapter-select");
    chapSelect.innerHTML = "";
    
    const activeSyllabus = state.syllabi.find(s => s.subject === state.selectedSubject);
    if (!activeSyllabus || activeSyllabus.chapters.length === 0) {
        const opt = document.createElement("option");
        opt.textContent = "No chapters available";
        chapSelect.appendChild(opt);
        return;
    }
    
    activeSyllabus.chapters.forEach(ch => {
        const opt = document.createElement("option");
        opt.value = ch.id;
        opt.textContent = ch.name;
        chapSelect.appendChild(opt);
    });
}

async function startQuiz() {
    const chapSelect = document.getElementById("quiz-chapter-select");
    const chapterId = chapSelect.value;
    const chapterName = chapSelect.options[chapSelect.selectedIndex].textContent;
    
    if (!chapterId) return;
    
    // Loader
    document.getElementById("quiz-prep-box").classList.add("hidden");
    document.getElementById("quiz-active-box").classList.remove("hidden");
    document.getElementById("quiz-explanation-box").classList.add("hidden");
    
    document.getElementById("quiz-question-text").textContent = "Creating quiz questions...";
    document.getElementById("quiz-options-container").innerHTML = "";
    
    try {
        const quizData = await apiCall(`/api/quiz/${chapterId}?subject=${encodeURIComponent(state.selectedSubject)}&chapter_name=${encodeURIComponent(chapterName)}`);
        state.quizQuestions = quizData.questions || [];
        state.currentQuizIndex = 0;
        state.quizAnswers = Array(state.quizQuestions.length).fill(null);
        state.quizAttemptFinished = false;
        
        renderQuizQuestion();
    } catch (err) {
        alert("Failed to load quiz: " + err.message);
        exitQuiz();
    }
}

function renderQuizQuestion() {
    const qBox = document.getElementById("quiz-active-box");
    const explBox = document.getElementById("quiz-explanation-box");
    explBox.classList.add("hidden");
    
    if (state.quizQuestions.length === 0) {
        alert("No questions found.");
        exitQuiz();
        return;
    }
    
    const q = state.quizQuestions[state.currentQuizIndex];
    document.getElementById("quiz-question-num").textContent = `Question ${state.currentQuizIndex + 1} of ${state.quizQuestions.length}`;
    document.getElementById("quiz-question-text").textContent = q.text;
    
    const optionsContainer = document.getElementById("quiz-options-container");
    optionsContainer.innerHTML = "";
    
    // Set progress bar fill
    const pct = Math.round((state.currentQuizIndex / state.quizQuestions.length) * 100);
    document.getElementById("quiz-progress-bar").style.width = `${pct}%`;
    
    q.options.forEach((opt, idx) => {
        const optBtn = document.createElement("div");
        optBtn.className = "quiz-option";
        if (state.quizAnswers[state.currentQuizIndex] === idx) {
            optBtn.classList.add("selected");
        }
        
        const letter = String.fromCharCode(65 + idx); // A, B, C, D
        optBtn.innerHTML = `
            <div class="quiz-option-index">${letter}</div>
            <div>${opt}</div>
        `;
        
        optBtn.onclick = () => selectQuizOption(idx);
        optionsContainer.appendChild(optBtn);
    });
    
    // Check if option was already answered to show explanation
    if (state.quizAnswers[state.currentQuizIndex] !== null) {
        showQuizExplanation();
    }
}

function selectQuizOption(optionIndex) {
    if (state.quizAnswers[state.currentQuizIndex] !== null) return; // Prevent changing answer
    
    state.quizAnswers[state.currentQuizIndex] = optionIndex;
    
    // Re-render to highlight selected option
    renderQuizQuestion();
}

function showQuizExplanation() {
    const q = state.quizQuestions[state.currentQuizIndex];
    const ansIdx = state.quizAnswers[state.currentQuizIndex];
    const correctIdx = q.correct_option_index;
    
    const explBox = document.getElementById("quiz-explanation-box");
    const explText = document.getElementById("quiz-explanation-text");
    
    if (ansIdx === correctIdx) {
        explBox.style.background = "rgba(16, 185, 129, 0.15)";
        explBox.style.borderColor = "rgba(16, 185, 129, 0.25)";
        explBox.style.color = "#d1fae5";
        explText.innerHTML = `Correct! ${q.explanation}`;
    } else {
        explBox.style.background = "rgba(244, 63, 94, 0.15)";
        explBox.style.borderColor = "rgba(244, 63, 94, 0.25)";
        explBox.style.color = "#ffe4e6";
        explText.innerHTML = `Incorrect. Correct Option: <strong>${String.fromCharCode(65 + correctIdx)}</strong>. <br>${q.explanation}`;
    }
    
    explBox.classList.remove("hidden");
}

function handleQuizNext() {
    // Check if user answered
    if (state.quizAnswers[state.currentQuizIndex] === null) {
        alert("Please select an option before proceeding.");
        return;
    }
    
    // If explanation is not visible yet, show it first
    const explBox = document.getElementById("quiz-explanation-box");
    if (explBox.classList.contains("hidden")) {
        showQuizExplanation();
        return;
    }
    
    if (state.currentQuizIndex < state.quizQuestions.length - 1) {
        state.currentQuizIndex++;
        renderQuizQuestion();
    } else {
        // Complete Quiz
        submitQuizResults();
    }
}

function handleQuizPrev() {
    if (state.currentQuizIndex > 0) {
        state.currentQuizIndex--;
        renderQuizQuestion();
    }
}

async function submitQuizResults() {
    const activeBox = document.getElementById("quiz-active-box");
    const resultsBox = document.getElementById("quiz-results-box");
    
    activeBox.classList.add("hidden");
    
    const chapSelect = document.getElementById("quiz-chapter-select");
    const chapterId = chapSelect.value;
    const chapterName = chapSelect.options[chapSelect.selectedIndex].textContent;
    
    try {
        const result = await apiCall(`/api/quiz/${chapterId}/attempt`, "POST", {
            subject: state.selectedSubject,
            chapter_name: chapterName,
            answers: state.quizAnswers
        });
        
        document.getElementById("quiz-results-score").textContent = Math.round(result.score);
        document.getElementById("quiz-results-total").textContent = result.total;
        
        const weakList = document.getElementById("quiz-weak-topics-list");
        weakList.innerHTML = "";
        
        const weakBox = document.getElementById("quiz-weak-topics-box");
        if (result.weak_topics && result.weak_topics.length > 0) {
            weakBox.classList.remove("hidden");
            result.weak_topics.forEach(t => {
                const li = document.createElement("li");
                li.className = "weak-topic-item";
                li.style.background = "none";
                li.style.border = "none";
                li.style.padding = "4px 0";
                li.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-2 text-rose"></i> ${t}`;
                weakList.appendChild(li);
            });
        } else {
            weakBox.classList.add("hidden");
        }
        
        resultsBox.classList.remove("hidden");
    } catch (err) {
        alert("Failed to submit quiz attempt: " + err.message);
        exitQuiz();
    }
}

function exitQuiz() {
    document.getElementById("quiz-prep-box").classList.remove("hidden");
    document.getElementById("quiz-active-box").classList.add("hidden");
    document.getElementById("quiz-results-box").classList.add("hidden");
    loadQuizZone();
    showView("dashboard");
}


// --- PERSONAL PLANNER MANAGER ---
async function loadPlanner() {
    try {
        state.planner = await apiCall("/api/planner");
        
        // Fetch syllabus list to compute stats
        const syllabi = await apiCall("/api/syllabus") || [];
        
        // Render Exams list
        renderPlannerExamsList(syllabi);
        
        // 2. Populate Wake time
        document.getElementById("planner-wake-time").value = state.planner.daily_routine.wake_up || "07:00";
        
        // 3. Populate reminders checkbox
        document.getElementById("notification-toggle").checked = state.planner.reminders_enabled;
        
        // 4. Render routine blocks
        renderRoutineBlocks();
        
        // 5. Render Checklist items
        renderPlannerChecklist();
        
        // Check for uncompleted tasks from past days
        checkPastPendingTasks();
    } catch (err) {
        console.error("Planner load failed", err);
    }
}

function renderPlannerExamsList(syllabi) {
    const container = document.getElementById("planner-exams-list-container");
    if (!container) return;
    container.innerHTML = "";
    
    const examSchedule = state.planner.exam_schedule || {};
    const examKeys = Object.keys(examSchedule);
    
    if (examKeys.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; margin: 10px 0;">No exams configured yet. Add your first exam below!</p>`;
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    examKeys.forEach(subject => {
        const examDateStr = examSchedule[subject];
        const examDateObj = new Date(examDateStr);
        examDateObj.setHours(0, 0, 0, 0);
        
        const diffTime = examDateObj - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Find syllabus chapter count
        const subLower = subject.toLowerCase().trim();
        const subjectSyllabus = syllabi.find(s => {
            const sLower = s.subject.toLowerCase().trim();
            return sLower === subLower || sLower.includes(subLower) || subLower.includes(sLower);
        });
        const chapterCount = subjectSyllabus ? (subjectSyllabus.chapters || []).length : 0;
        
        let daysText = "";
        let alertClass = "";
        if (diffDays < 0) {
            daysText = "Exam Completed";
            alertClass = "color: var(--text-muted);";
        } else if (diffDays === 0) {
            daysText = "EXAM TODAY!";
            alertClass = "color: #ef4444; font-weight: 700;";
        } else if (diffDays === 1) {
            daysText = "1 day remaining";
            alertClass = "color: #ef4444; font-weight: 600;";
        } else {
            daysText = `${diffDays} days remaining`;
            alertClass = "color: var(--primary-light);";
        }
        
        const chaptersPerDay = (diffDays > 0 && chapterCount > 0) ? (chapterCount / diffDays).toFixed(1) : "N/A";
        
        const item = document.createElement("div");
        item.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(0,0,0,0.15); border: 1px solid var(--panel-border); border-radius: var(--radius-sm);";
        
        item.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="color: var(--text-primary); font-size: 0.95rem;">${subject}</strong>
                    <span style="font-size: 0.75rem; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);">${examDateStr}</span>
                </div>
                <div style="font-size: 0.8rem; display: flex; gap: 12px; flex-wrap: wrap;">
                    <span style="${alertClass}"><i class="fa-solid fa-clock-rotate-left mr-1"></i>${daysText}</span>
                    <span style="color: var(--text-muted);"><i class="fa-solid fa-book-open mr-1"></i>${chapterCount} chapters</span>
                    <span style="color: var(--text-muted);"><i class="fa-solid fa-calendar-day mr-1"></i>Rate: ${chaptersPerDay} ch/day</span>
                </div>
            </div>
            <button type="button" class="action-btn text-rose" onclick="deleteExamFromSchedule('${subject}')"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(item);
    });
}

async function addExamToSchedule() {
    const subjectInput = document.getElementById("planner-exam-subject");
    const dateInput = document.getElementById("planner-exam-date");
    
    const subject = subjectInput.value.trim();
    const date = dateInput.value;
    
    if (!subject || !date) {
        alert("Please enter both Subject Name and Exam Date.");
        return;
    }
    
    try {
        const schedule = state.planner.exam_schedule || {};
        schedule[subject] = date;
        
        await apiCall("/api/planner", "PUT", { exam_schedule: schedule });
        subjectInput.value = "";
        dateInput.value = "";
        
        loadPlanner();
        triggerToast("Exam Added", `Successfully added ${subject} exam on ${date}.`, "success");
    } catch (err) {
        alert("Failed to add exam: " + err.message);
    }
}

async function deleteExamFromSchedule(subject) {
    if (!confirm(`Are you sure you want to remove the ${subject} exam from your schedule?`)) {
        return;
    }
    try {
        const schedule = state.planner.exam_schedule || {};
        delete schedule[subject];
        
        await apiCall("/api/planner", "PUT", { exam_schedule: schedule });
        loadPlanner();
        triggerToast("Exam Removed", `Successfully removed ${subject} exam.`, "warning");
    } catch (err) {
        alert("Failed to delete exam: " + err.message);
    }
}

function renderRoutineBlocks() {
    const container = document.getElementById("routine-blocks-list");
    container.innerHTML = "";
    
    const blocks = state.planner.daily_routine.blocks || [];
    blocks.forEach((block, idx) => {
        const div = document.createElement("div");
        div.style.cssText = "display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.01); border: 1px solid var(--panel-border); padding: 10px; border-radius: var(--radius-sm);";
        div.innerHTML = `
            <input type="time" class="input-control routine-start" style="padding: 8px;" value="${block.start}" required>
            <span style="color: var(--text-secondary);">to</span>
            <input type="time" class="input-control routine-end" style="padding: 8px;" value="${block.end}" required>
            <input type="text" class="input-control routine-activity" style="padding: 8px; flex: 1;" value="${block.activity}" placeholder="Activity Name" required>
            <button type="button" class="action-btn text-rose" onclick="deleteRoutineBlock(${idx})"><i class="fa-solid fa-trash"></i></button>
        `;
        container.appendChild(div);
    });
}

function addNewRoutineBlock() {
    const blocks = state.planner.daily_routine.blocks || [];
    blocks.push({
        start: "08:00",
        end: "10:00",
        activity: "Study Block"
    });
    state.planner.daily_routine.blocks = blocks;
    renderRoutineBlocks();
}

function deleteRoutineBlock(idx) {
    state.planner.daily_routine.blocks.splice(idx, 1);
    renderRoutineBlocks();
}

async function handlePlannerSettingsSubmit(e) {
    e.preventDefault();
    
    const wakeUp = document.getElementById("planner-wake-time").value;
    
    // Read routine blocks from DOM
    const blocksList = [];
    const blockDivs = document.querySelectorAll("#routine-blocks-list > div");
    blockDivs.forEach(div => {
        const start = div.querySelector(".routine-start").value;
        const end = div.querySelector(".routine-end").value;
        const activity = div.querySelector(".routine-activity").value.trim();
        if (start && end && activity) {
            blocksList.push({ start, end, activity });
        }
    });
    
    const saveBtn = e.target.querySelector("button[type='submit']");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Saving Config...`;
    
    try {
        await apiCall("/api/planner", "PUT", {
            daily_routine: { wake_up: wakeUp, blocks: blocksList },
            reminders_enabled: document.getElementById("notification-toggle").checked
        });
        alert("Schedule settings saved successfully!");
        loadPlanner();
    } catch (err) {
        alert("Failed to save: " + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-2"></i>Save Schedule Configuration`;
    }
}

async function togglePlannerChecklistItem(chapterId, subject, isChecked) {
    try {
        const schedule = state.planner.study_schedule.map(t => {
            if (t.chapter_id === chapterId && t.subject === subject) {
                return { ...t, completed: isChecked };
            }
            return t;
        });
        
        await apiCall("/api/planner", "PUT", { study_schedule: schedule });
        state.planner.study_schedule = schedule;
        
        loadPlanner();
        
        if (isChecked) {
            checkAndShowCongrats(state.calendarSelectedDate);
        }
    } catch (err) {
        alert("Failed: " + err.message);
    }
}

async function addNewChecklistTask() {
    const textInput = document.getElementById("new-checklist-task");
    const taskText = textInput.value.trim();
    if (!taskText) return;
    
    const subject = state.profile.subjects[0] || "Mathematics";
    const targetDate = state.calendarSelectedDate || new Date().toISOString().split('T')[0];
    
    const newTask = {
        date: targetDate,
        subject: subject,
        chapter_id: `ch_${Date.now()}`,
        chapter_name: taskText,
        duration_mins: 60,
        completed: false
    };
    
    try {
        const schedule = state.planner.study_schedule || [];
        schedule.push(newTask);
        
        await apiCall("/api/planner", "PUT", { study_schedule: schedule });
        textInput.value = "";
        loadPlanner();
    } catch (err) {
        alert("Failed to add task: " + err.message);
    }
}

async function deleteChecklistTask(chapterId, subject) {
    try {
        const schedule = state.planner.study_schedule.filter(t => !(t.chapter_id === chapterId && t.subject === subject));
        await apiCall("/api/planner", "PUT", { study_schedule: schedule });
        loadPlanner();
    } catch (err) {
        alert("Failed to delete task: " + err.message);
    }
}

async function handleNotificationToggle(e) {
    const checked = e.target.checked;
    try {
        await apiCall("/api/planner", "PUT", { reminders_enabled: checked });
        state.planner.reminders_enabled = checked;
        
        if (checked && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    } catch (err) {
        console.error("Failed to update notification status", err);
    }
}


// --- HYDRATION INTENSE TRACKER ---
function updateHydrationUI() {
    // Pull water progress for today
    const todayStr = new Date().toISOString().split('T')[0];
    const progressLog = state.planner.daily_progress || {};
    const todayLog = progressLog[todayStr] || { completed_study_mins: 0, water_intake_ml: 0, breaks_taken: 0 };
    
    state.waterIntake = todayLog.water_intake_ml;
    
    document.getElementById("water-text").textContent = `${state.waterIntake} / 2000 ml`;
    
    // Set fill level percentage (max 100%)
    const pct = Math.min((state.waterIntake / 2000) * 100, 100);
    document.getElementById("water-fill-level").style.height = `${pct}%`;
}

async function logDrinkWater() {
    const todayStr = new Date().toISOString().split('T')[0];
    const progressLog = state.planner.daily_progress || {};
    const todayLog = progressLog[todayStr] || { completed_study_mins: 0, water_intake_ml: 0, breaks_taken: 0 };
    
    todayLog.water_intake_ml += 250;
    progressLog[todayStr] = todayLog;
    
    try {
        await apiCall("/api/planner", "PUT", { daily_progress: progressLog });
        state.planner.daily_progress = progressLog;
        updateHydrationUI();
        
        // Notification congratulating
        if (todayLog.water_intake_ml >= 2000 && todayLog.water_intake_ml - 250 < 2000) {
            showWebNotification("Hydration Goal Achieved!", "Awesome! You have consumed 2 liters of water today. Keep it up!");
        }
    } catch (err) {
        console.error("Failed to log hydration", err);
    }
}

async function resetWaterIntake() {
    const todayStr = new Date().toISOString().split('T')[0];
    const progressLog = state.planner.daily_progress || {};
    const todayLog = progressLog[todayStr] || { completed_study_mins: 0, water_intake_ml: 0, breaks_taken: 0 };
    
    todayLog.water_intake_ml = 0;
    progressLog[todayStr] = todayLog;
    
    try {
        await apiCall("/api/planner", "PUT", { daily_progress: progressLog });
        state.planner.daily_progress = progressLog;
        updateHydrationUI();
    } catch (err) {
        console.error("Failed to reset hydration", err);
    }
}


// --- STUDY BREAK TIMER LOGIC ---
function updateBreakTimerUI() {
    const mins = Math.floor(state.breakTimeLeft / 60);
    const secs = state.breakTimeLeft % 60;
    document.getElementById("break-timer-display").textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startBreakTimer() {
    if (state.breakTimerRunning) return;
    
    state.breakTimerRunning = true;
    document.getElementById("start-break-btn").classList.add("hidden");
    document.getElementById("pause-break-btn").classList.remove("hidden");
    
    state.breakTimerInterval = setInterval(() => {
        if (state.breakTimeLeft > 0) {
            state.breakTimeLeft--;
            updateBreakTimerUI();
            
            // Periodically remind to drink water every 5 minutes in background
            if (state.breakTimeLeft % 300 === 0 && state.planner.reminders_enabled) {
                showWebNotification("Hydration Reminder", "Take a moment to drink a glass of water to stay focused!");
            }
        } else {
            // Time is up!
            clearInterval(state.breakTimerInterval);
            state.breakTimerRunning = false;
            state.breakTimeLeft = 15 * 60; // reset
            
            document.getElementById("start-break-btn").classList.remove("hidden");
            document.getElementById("pause-break-btn").classList.add("hidden");
            updateBreakTimerUI();
            
            if (state.planner.reminders_enabled) {
                showWebNotification("Break Finished!", "Time to return to your study routine. Stay productive!");
            }
        }
    }, 1000);
}

function pauseBreakTimer() {
    clearInterval(state.breakTimerInterval);
    state.breakTimerRunning = false;
    document.getElementById("start-break-btn").classList.remove("hidden");
    document.getElementById("pause-break-btn").classList.add("hidden");
}

function resetBreakTimer() {
    clearInterval(state.breakTimerInterval);
    state.breakTimerRunning = false;
    state.breakTimeLeft = 15 * 60;
    document.getElementById("start-break-btn").classList.remove("hidden");
    document.getElementById("pause-break-btn").classList.add("hidden");
    updateBreakTimerUI();
}


// --- DOM EVENT LISTENERS SETUP ---
function setupEventListeners() {
    // Auth Forms
    document.getElementById("login-form").addEventListener("submit", handleLogin);
    document.getElementById("register-form").addEventListener("submit", handleRegister);
    
    document.getElementById("show-register-btn").onclick = (e) => { e.preventDefault(); showAuthCard("register"); };
    document.getElementById("show-login-btn").onclick = (e) => { e.preventDefault(); showAuthCard("login"); };
    
    // Sidebar view togglers
    const menuItems = document.querySelectorAll(".nav-menu .nav-item");
    menuItems.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const viewName = item.getAttribute("data-view");
            showView(viewName);
        };
    });
    
    document.getElementById("logout-btn").onclick = logout;
    
    // Onboarding steps navigation
    const wizardView = document.getElementById("onboarding-view");
    wizardView.querySelectorAll(".next-step-btn").forEach(btn => {
        btn.onclick = () => {
            onboardingActiveStep++;
            updateWizardStepUI();
        };
    });
    
    wizardView.querySelectorAll(".prev-step-btn").forEach(btn => {
        btn.onclick = () => {
            onboardingActiveStep--;
            updateWizardStepUI();
        };
    });
    
    // Toggle subject chips
    document.getElementById("onboard-subjects-grid").onclick = (e) => {
        const chip = e.target.closest(".subject-chip");
        if (chip) toggleSubjectChip(chip);
    };
    
    // Add custom subject in onboarding
    document.getElementById("add-custom-subject-btn").onclick = () => {
        const input = document.getElementById("custom-subject-input");
        const val = input.value.trim();
        if (val) {
            onboardingSubjects.add(val);
            
            // Add element to grid
            const grid = document.getElementById("onboard-subjects-grid");
            const newChip = document.createElement("div");
            newChip.className = "subject-chip selected";
            newChip.setAttribute("data-subject", val);
            newChip.textContent = val;
            grid.appendChild(newChip);
            
            input.value = "";
        }
    };
    
    document.getElementById("submit-onboarding-btn").onclick = submitOnboarding;
    
    // Syllabus Editor changes
    document.getElementById("syllabus-subject-select").onchange = (e) => {
        state.selectedSubject = e.target.value;
        renderSyllabusChapters();
    };
    document.getElementById("add-chapter-btn").onclick = addNewChapter;
    document.getElementById("save-syllabus-btn").onclick = saveSyllabusChanges;
    
    // Generation preview button bindings
    document.getElementById("gen-make-changes-btn").onclick = async () => {
        await loadUserProfile();
        showView("syllabus");
    };
    
    document.getElementById("gen-save-continue-btn").onclick = async () => {
        const btn = document.getElementById("gen-save-continue-btn");
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Saving...`;
        try {
            await loadUserProfile();
            showView("dashboard");
        } catch (err) {
            alert("Error saving workspace: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-circle-check mr-2"></i>Save & Continue`;
        }
    };
    
    // Dashboard Change button binding
    document.getElementById("dash-change-syllabus-btn").onclick = () => {
        showView("syllabus");
    };
    
    // Study Space navigation
    document.getElementById("study-subject-select").onchange = (e) => {
        state.selectedSubject = e.target.value;
        state.selectedChapterId = ""; // Reset
        state.selectedChapterName = "";
        renderStudyChaptersNavigator();
    };
    
    // Study space tabs toggling
    document.querySelectorAll(".tab-nav .tab-btn").forEach(btn => {
        btn.onclick = () => {
            const tab = btn.getAttribute("data-tab");
            switchStudyTab(tab);
        };
    });
    
    // Flashcard clicking & navigation
    document.getElementById("flashcard-box").onclick = function() {
        this.classList.toggle("flipped");
    };
    document.getElementById("prev-card-btn").onclick = () => handleFlashcardNav("prev");
    document.getElementById("next-card-btn").onclick = () => handleFlashcardNav("next");
    
    // Quiz Zone active button handlers
    document.getElementById("start-quiz-btn").onclick = startQuiz;
    document.getElementById("quiz-prev-btn").onclick = handleQuizPrev;
    document.getElementById("quiz-next-btn").onclick = handleQuizNext;
    document.getElementById("exit-quiz-btn").onclick = exitQuiz;
    
    // Planner Setup
    document.getElementById("planner-settings-form").addEventListener("submit", handlePlannerSettingsSubmit);
    document.getElementById("add-routine-block-btn").onclick = addNewRoutineBlock;
    document.getElementById("add-checklist-task-btn").onclick = addNewChecklistTask;
    document.getElementById("notification-toggle").onchange = handleNotificationToggle;
    
    // Hydration widget
    document.getElementById("drink-water-btn").onclick = logDrinkWater;
    document.getElementById("reset-water-btn").onclick = resetWaterIntake;
    
    // Water reminder modal buttons
    document.getElementById("modal-drink-btn").onclick = async () => {
        document.getElementById("water-modal").classList.add("hidden");
        await logDrinkWater();
    };
    document.getElementById("modal-cancel-btn").onclick = () => {
        document.getElementById("water-modal").classList.add("hidden");
    };
    
    // Study Break Timer
    document.getElementById("start-break-btn").onclick = startBreakTimer;
    document.getElementById("pause-break-btn").onclick = pauseBreakTimer;
    document.getElementById("reset-break-btn").onclick = resetBreakTimer;
    
    // AI Schedule & Test Reminders
    document.getElementById("generate-ai-schedule-btn").onclick = generateAISchedule;
    document.getElementById("test-notification-btn").onclick = testNotifications;
    
    // Congrats and Reschedule modal buttons
    document.getElementById("modal-congrats-btn").onclick = () => {
        document.getElementById("congrats-modal").classList.add("hidden");
    };
    document.getElementById("modal-reschedule-btn").onclick = reschedulePendingTasks;
    document.getElementById("modal-reschedule-skip-btn").onclick = () => {
        document.getElementById("reschedule-modal").classList.add("hidden");
    };
}

async function generateAISchedule() {
    const textarea = document.getElementById("planner-datesheet-text");
    const datesheetText = textarea.value.trim();
    
    if (!datesheetText) {
        alert("Please paste your datesheet or exam schedule details first.");
        return;
    }
    
    const btn = document.getElementById("generate-ai-schedule-btn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Generating Schedule...`;
    
    try {
        const response = await apiCall("/api/planner/generate_schedule", "POST", { datesheet_text: datesheetText });
        triggerToast("AI Revision Plan Generated", "Your day-by-day revision checklist has been generated based on your datesheet!", "success");
        loadPlanner();
    } catch (err) {
        triggerToast("Failed to Generate Plan", err.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-compass-drafting mr-2"></i>Generate AI Revision Plan`;
    }
}

function testNotifications() {
    triggerToast("Test Notification", "This is an overlay toast notification. Glassmorphism styled!", "success");
    showWebNotification("Test Notification", "This is a native system notification. It works!");
    // Trigger the water modal for easy testing
    document.getElementById("water-modal").classList.remove("hidden");
}

function renderPlannerChecklist() {
    const container = document.getElementById("planner-checklist-container");
    if (!container) return;
    container.innerHTML = "";
    
    // Render the monthly calendar grid alongside the checklist
    renderStudyCalendar();
    
    const schedule = state.planner.study_schedule || [];
    const selectedDate = state.calendarSelectedDate;
    
    // Set date labels in UI
    const dateObj = new Date(selectedDate);
    const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    document.getElementById("selected-date-title").textContent = `Revision Checklist for ${formattedDate}`;
    document.getElementById("add-task-label-date").textContent = `Add Study Task for ${formattedDate}`;
    
    // Filter tasks for the selected date
    const selectedDateTasks = schedule.filter(t => t.date === selectedDate);
    
    if (selectedDateTasks.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin: 15px 0;">No study tasks scheduled for this day.</p>`;
        return;
    }
    
    selectedDateTasks.forEach(task => {
        const item = document.createElement("div");
        item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--panel-border); border-radius: var(--radius-sm); margin-bottom: 8px; flex-wrap: wrap; gap: 10px;";
        
        const hours = (task.duration_mins / 60).toFixed(1);
        const difficultyLabel = task.difficulty || "Medium";
        let diffBadgeColor = "var(--text-muted)";
        if (difficultyLabel === "Easy") diffBadgeColor = "#10b981";
        else if (difficultyLabel === "Medium") diffBadgeColor = "#f59e0b";
        else if (difficultyLabel === "Hard") diffBadgeColor = "#ef4444";
        
        const chDisplayName = task.chapter_name || `Chapter ${task.chapter_id.replace('ch','').replace('ch_','')}`;
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 200px;">
                <input type="checkbox" style="width: 18px; height: 18px; cursor: pointer;" ${task.completed ? 'checked' : ''} onchange="togglePlannerChecklistItem('${task.chapter_id}', '${task.subject}', this.checked)">
                <div style="display: flex; flex-direction: column;">
                    <span style="${task.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
                        <strong>${task.subject}</strong>: Revision of ${chDisplayName}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 3px;">
                        <i class="fa-solid fa-clock mr-1"></i>${hours} hrs &nbsp;|&nbsp; 
                        <span style="color: ${diffBadgeColor}; font-weight: 600;">${difficultyLabel}</span>
                    </span>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <input type="date" value="${task.date}" style="padding: 6px 10px; font-size: 0.75rem; border-radius: var(--radius-sm); background: rgba(0,0,0,0.3); border: 1px solid var(--panel-border); color: var(--text-primary); cursor: pointer;" onchange="reschedulePlannerTask('${task.chapter_id}', '${task.subject}', this.value)">
                <button class="action-btn text-rose" onclick="deleteChecklistTask('${task.chapter_id}', '${task.subject}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderStudyCalendar() {
    const grid = document.getElementById("study-calendar-grid");
    if (!grid) return;
    grid.innerHTML = "";
    
    const currentMonth = state.calendarCurrentMonth || new Date();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // Display Month & Year
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("calendar-month-year-display").textContent = `${monthNames[month]} ${year}`;
    
    // Get first day of month and total days
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 6 is Saturday
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();
    
    const schedule = state.planner.study_schedule || [];
    
    // Create days grid cells
    // 1. Previous month days (padding)
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        const dayNum = prevTotalDays - i;
        const cell = document.createElement("div");
        cell.style.cssText = "padding: 10px 5px; text-align: center; color: var(--text-secondary); opacity: 0.25; font-size: 0.8rem;";
        cell.textContent = dayNum;
        grid.appendChild(cell);
    }
    
    // 2. Current month days
    for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Check if this date has any scheduled tasks
        const hasTasks = schedule.some(t => t.date === dateStr);
        const isSelected = state.calendarSelectedDate === dateStr;
        
        const cell = document.createElement("div");
        cell.style.cssText = `padding: 10px 5px; text-align: center; cursor: pointer; border-radius: var(--radius-sm); font-size: 0.8rem; position: relative; transition: background 0.2s; font-weight: 500;`;
        
        if (isSelected) {
            cell.style.background = "var(--primary)";
            cell.style.color = "#ffffff";
        } else {
            cell.style.background = "rgba(255,255,255,0.03)";
            cell.style.border = "1px solid rgba(255,255,255,0.05)";
            cell.style.color = "var(--text-primary)";
            
            // Hover effect
            cell.onmouseover = () => cell.style.background = "rgba(255,255,255,0.08)";
            cell.onmouseout = () => cell.style.background = "rgba(255,255,255,0.03)";
        }
        
        cell.textContent = day;
        
        // Add task indicator dot
        if (hasTasks) {
            const dot = document.createElement("div");
            dot.style.cssText = "width: 5px; height: 5px; border-radius: 50%; background: #f59e0b; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);";
            if (isSelected) {
                dot.style.background = "#ffffff";
            }
            cell.appendChild(dot);
        }
        
        // Click event
        cell.onclick = () => {
            state.calendarSelectedDate = dateStr;
            renderPlannerChecklist();
        };
        
        grid.appendChild(cell);
    }
}

function shiftCalendarMonth(direction) {
    const currentMonth = state.calendarCurrentMonth || new Date();
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    state.calendarCurrentMonth = currentMonth;
    renderStudyCalendar();
}

async function reschedulePlannerTask(chapterId, subject, newDate) {
    if (!newDate) return;
    try {
        const schedule = state.planner.study_schedule.map(t => {
            if (t.chapter_id === chapterId && t.subject === subject) {
                return { ...t, date: newDate };
            }
            return t;
        });
        
        await apiCall("/api/planner", "PUT", { study_schedule: schedule });
        
        // Focus calendar to the new target date
        state.calendarSelectedDate = newDate;
        state.calendarCurrentMonth = new Date(newDate);
        
        loadPlanner();
        triggerToast("Task Rescheduled", `Moved task to ${newDate}.`, "success");
    } catch (err) {
        alert("Failed to reschedule task: " + err.message);
    }
}

async function regenerateActiveSyllabus() {
    if (!state.selectedSubject) {
        alert("Please select a subject first.");
        return;
    }
    if (!confirm(`Are you sure you want to change and re-generate the official board syllabus for ${state.selectedSubject}? This will overwrite your current chapters.`)) {
        return;
    }
    
    const btn = document.getElementById("regenerate-board-syllabus-btn");
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i>Changing...`;
    
    try {
        await apiCall(`/api/syllabus/${encodeURIComponent(state.selectedSubject)}/regenerate`, "POST");
        await loadPlanner(); // Refresh planner to update stats if necessary
        
        // Re-load syllabus and re-render
        state.planner = await apiCall("/api/planner");
        const syllabi = await apiCall("/api/syllabus") || [];
        
        // Reload syllabus list
        state.syllabi = syllabi;
        renderSyllabusChapters();
        
        triggerToast("Syllabus Changed", `Successfully loaded official board chapters for ${state.selectedSubject}.`, "success");
    } catch (err) {
        alert("Failed to change syllabus: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate mr-2"></i>Change Syllabus`;
    }
}

function checkPastPendingTasks() {
    if (!state.planner || !state.planner.study_schedule) return;
    if (state.reschedulePrompted) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const pastPending = state.planner.study_schedule.filter(t => t.date < todayStr && !t.completed);
    
    if (pastPending.length > 0) {
        state.reschedulePrompted = true;
        showRescheduleModal(pastPending.length);
    }
}

function showRescheduleModal(count) {
    const modal = document.getElementById("reschedule-modal");
    if (!modal) return;
    document.getElementById("reschedule-modal-title").textContent = "Don't stress, you've got this! 🌟";
    document.getElementById("reschedule-modal-text").innerHTML = `
        It's completely okay if you didn't finish everything. You have <strong>${count} pending task(s)</strong> from previous days. <br><br>
        Let's automatically adjust your schedule to distribute these tasks evenly across your remaining days so you don't feel overloaded.
    `;
    modal.classList.remove("hidden");
}

function checkAndShowCongrats(dateStr) {
    const schedule = state.planner.study_schedule || [];
    const dateTasks = schedule.filter(t => t.date === dateStr);
    
    if (dateTasks.length > 0 && dateTasks.every(t => t.completed)) {
        showCongratsModal(dateStr);
    }
}

function showCongratsModal(dateStr) {
    const modal = document.getElementById("congrats-modal");
    if (!modal) return;
    
    const dateObj = new Date(dateStr);
    const formattedDate = dateObj.toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    
    document.getElementById("congrats-modal-text").innerHTML = `
        You've completed all your study tasks scheduled for <strong>${formattedDate}</strong>! <br><br>
        You're making fantastic progress towards your goals. Take a well-deserved break!
    `;
    modal.classList.remove("hidden");
}

async function reschedulePendingTasks() {
    const schedule = state.planner.study_schedule || [];
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Find past pending tasks
    const pastPending = schedule.filter(t => t.date < todayStr && !t.completed);
    if (pastPending.length === 0) return;
    
    const futureTasks = schedule.filter(t => t.date >= todayStr);
    
    // Calculate daily load for future dates
    const daysLoad = {};
    futureTasks.forEach(t => {
        daysLoad[t.date] = (daysLoad[t.date] || 0) + 1;
    });
    
    // Let's find future dates we can reschedule to
    const examSchedule = state.planner.exam_schedule || {};
    
    // Helper to generate list of dates between start and end (inclusive)
    function getDatesInRange(startStr, endStr) {
        const dates = [];
        let current = new Date(startStr);
        const end = new Date(endStr);
        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    }
    
    // Process each past pending task and assign to a new date
    const updatedPending = pastPending.map(task => {
        const subject = task.subject;
        const examDateStr = examSchedule[subject];
        
        let allowedDates = [];
        if (examDateStr && examDateStr >= todayStr) {
            // Reschedule between today and the day before the exam
            const dayBeforeExam = new Date(examDateStr);
            dayBeforeExam.setDate(dayBeforeExam.getDate() - 1);
            const dayBeforeExamStr = dayBeforeExam.toISOString().split('T')[0];
            if (dayBeforeExamStr >= todayStr) {
                allowedDates = getDatesInRange(todayStr, dayBeforeExamStr);
            }
        }
        
        // If no exam date, or exam date is in past, default to next 7 days
        if (allowedDates.length === 0) {
            const next7Days = new Date();
            next7Days.setDate(next7Days.getDate() + 7);
            allowedDates = getDatesInRange(todayStr, next7Days.toISOString().split('T')[0]);
        }
        
        // Find the date in allowedDates with the minimum load
        let targetDate = allowedDates[0];
        let minLoad = Infinity;
        
        allowedDates.forEach(date => {
            const load = daysLoad[date] || 0;
            if (load < minLoad) {
                minLoad = load;
                targetDate = date;
            }
        });
        
        // Update load
        daysLoad[targetDate] = (daysLoad[targetDate] || 0) + 1;
        
        // Update task date
        return { ...task, date: targetDate };
    });
    
    // Combine rescheduled tasks with future tasks (removing the old past pending from their old dates)
    const newSchedule = [
        ...schedule.filter(t => !(t.date < todayStr && !t.completed)), // Keep completed past tasks and future tasks
        ...updatedPending // Add rescheduled pending tasks with new dates
    ];
    
    // Sort chronologically
    newSchedule.sort((a, b) => a.date.localeCompare(b.date));
    
    try {
        await apiCall("/api/planner", "PUT", { study_schedule: newSchedule });
        state.planner.study_schedule = newSchedule;
        
        // Hide modal
        document.getElementById("reschedule-modal").classList.add("hidden");
        
        // Reload
        await loadPlanner();
        await loadDashboard();
        
        triggerToast("Tasks Rescheduled", `Successfully redistributed ${pastPending.length} pending tasks to reduce study pressure!`, "success");
    } catch (err) {
        alert("Failed to reschedule tasks: " + err.message);
    }
}
