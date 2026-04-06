/* ---------- Global State Management ---------- */
let collegeData = JSON.parse(localStorage.getItem('collegeData')) || {
    departments: [], // { name: string, secA: [], secB: [] }
    students: [],    // { id: string, name: string, roll: string, dept: string, sec: string }
    notices: [],     // { id: string, title: string, content: string, date: number }
    exams: [],       // { id: string, subject: string, date: string, dept: string }
    resources: [],   // { id: string, title: string, dept: string, link: string, content: string, date: number }
    attendanceRecords: [], // { date: string, dept: string, sec: string, subject: string, presentIds: [] }
    users: [] // {email, password, name}
};

let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

const MAX_STUDENTS_PER_SEC = 60;

function saveData() {
    localStorage.setItem('collegeData', JSON.stringify(collegeData));
    updateDashboard();
}

// Generates unique ID
const genId = () => '_' + Math.random().toString(36).substr(2, 9);

/* ---------- DOM Ready Initialization ---------- */
document.addEventListener('DOMContentLoaded', () => {
    // Migration: ensure subjects array exists
    if (!collegeData.departments) collegeData.departments = [];
    if (!collegeData.students) collegeData.students = [];
    if (!collegeData.notices) collegeData.notices = [];
    if (!collegeData.exams) collegeData.exams = [];
    if (!collegeData.resources) collegeData.resources = [];
    if (!collegeData.attendanceRecords) collegeData.attendanceRecords = [];
    if (!collegeData.users) collegeData.users = [];

    collegeData.departments.forEach(d => {
        if (!d.subjects) d.subjects = [];
        if (!d.sections) {
            d.sections = { 'A': d.secA || [], 'B': d.secB || [] };
            d.sectionCount = 2;
            delete d.secA;
            delete d.secB;
            delete d.secB;
        }
        if (!d.semCount) d.semCount = 8;
        if (d.subjects && d.subjects.length > 0 && typeof d.subjects[0] === 'string') {
            d.subjects = d.subjects.map(s => ({ name: s, sem: 1 }));
        }
    });

    collegeData.students.forEach(s => { if (!s.sem) s.sem = 1; });
    collegeData.attendanceRecords.forEach(a => { if (!a.sem) a.sem = 1; });
    collegeData.exams.forEach(e => { if (!e.sem) e.sem = 1; });
    collegeData.resources.forEach(r => { if (!r.sem) r.sem = null; });

    initTheme();
    setupNavigation();
    setupKeyboardShortcuts();
    checkAuthState();
    
    // Set default date for attendance (Local Timezone adjusted)
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000; // offset in milliseconds
    const today = new Date(now.getTime() - tzOffset).toISOString().split('T')[0];
    const dateInput = document.getElementById('input-att-date');
    if(dateInput) dateInput.value = today;

    // Initial Render of all sections
    renderDepartments();
    updateDeptDropdowns();
    renderStudents();
    renderNotices();
    renderExams();
    renderResources();
    updateDashboard();
});

/* ---------- Application Routing & UI Nav ---------- */
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(n => n.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(sec => sec.classList.remove('active', 'hidden'));
            sections.forEach(sec => sec.classList.add('hidden'));

            const targetId = link.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
            document.getElementById(targetId).classList.add('active');

            if (targetId === 'attendance') {
                if (typeof window.renderAttendanceSheet === 'function') {
                    window.renderAttendanceSheet();
                }
            }

            pageTitle.textContent = link.querySelector('span').textContent;

            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').classList.remove('active');
            }
        });
    });

    document.getElementById('mobile-open').addEventListener('click', () => {
        document.getElementById('sidebar').classList.add('active');
    });

    document.getElementById('mobile-close').addEventListener('click', () => {
        document.getElementById('sidebar').classList.remove('active');
    });
}

window.switchPage = function(target) {
    document.querySelector(`.nav-link[data-target="${target}"]`).click();
}

/* ---------- Theme Options ---------- */
function initTheme() {
    const savedTheme = localStorage.getItem('erp_theme');
    const themeBtn = document.getElementById('theme-btn');
    const icon = themeBtn.querySelector('i');
    const text = themeBtn.querySelector('span');

    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        icon.className = 'fa-solid fa-sun';
        text.textContent = 'Light Mode';
    }

    themeBtn.addEventListener('click', () => {
        if (document.documentElement.getAttribute('data-theme') === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('erp_theme', 'light');
            icon.className = 'fa-solid fa-moon';
            text.textContent = 'Dark Mode';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('erp_theme', 'dark');
            icon.className = 'fa-solid fa-sun';
            text.textContent = 'Light Mode';
        }
    });
}

/* ---------- Modals & Toasts ---------- */
window.openModal = function(id) {
    document.getElementById(id).classList.add('active');
}
window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
}

window.showToast = function(msg, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modals on clicking outside
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        closeModal(e.target.id);
    }
});

/* ---------- Dashboard Render Logic ---------- */
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

function updateDashboard() {
    // Top Counters
    animateValue(document.getElementById('dash-dept-count'), 0, collegeData.departments.length, 600);
    animateValue(document.getElementById('dash-student-count'), 0, collegeData.students.length, 600);
    animateValue(document.getElementById('dash-notice-count'), 0, collegeData.notices.length, 600);
    animateValue(document.getElementById('dash-exam-count'), 0, collegeData.exams.length, 600);

    // Section Capacity Chart
    const capacityDiv = document.getElementById('dashboard-capacity');
    capacityDiv.innerHTML = '';
    
    if (collegeData.departments.length === 0) {
        capacityDiv.innerHTML = '<div class="empty-state">No departments added yet.</div>';
    } else {
        collegeData.departments.forEach(dept => {
            let totalStudents = 0;
            if(dept.sections) Object.values(dept.sections).forEach(arr => totalStudents += arr.length);
            const maxTotal = (dept.capacity || 60) * (dept.sectionCount || 2);
            const perc = Math.round((totalStudents / maxTotal) * 100) || 0;

            capacityDiv.innerHTML += `
                <div class="capacity-row">
                    <div class="capacity-label">
                        <span>${dept.name}</span>
                        <span>${totalStudents}/${maxTotal} (${perc}%)</span>
                    </div>
                    <div class="capacity-bar-bg">
                        <div class="capacity-bar-fill ${perc >= 90 ? 'bg-danger' : 'bg-success'}" style="width: ${perc}%; background-color: ${perc >= 90 ? 'var(--danger)' : 'var(--success)'};"></div>
                    </div>
                </div>
            `;
        });
    }

    // Quick notices
    const quickNotices = document.getElementById('quick-notices');
    quickNotices.innerHTML = '';
    const recent = collegeData.notices.slice(0, 3);
    if(recent.length === 0) {
        quickNotices.innerHTML = '<div class="empty-state">No active notices.</div>';
    } else {
        recent.forEach(n => {
            quickNotices.innerHTML += `
                <div class="quick-notice-item">
                    <h4>${n.title}</h4>
                    <p>${new Date(n.date).toLocaleDateString()}</p>
                </div>
            `;
        });
    }

    // Quick exams
    const quickExams = document.getElementById('quick-exams');
    if (quickExams) {
        quickExams.innerHTML = '';
        const localNow = new Date();
        const todayStr = new Date(localNow.getTime() - (localNow.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const upcomingExams = collegeData.exams
            .filter(e => e.date >= todayStr)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 3);
            
        if(upcomingExams.length === 0) {
            quickExams.innerHTML = '<div class="empty-state">No upcoming exams.</div>';
        } else {
            upcomingExams.forEach(ex => {
                quickExams.innerHTML += `
                    <div class="quick-notice-item">
                        <h4>${ex.subject} <span style="font-size:0.8rem;color:var(--text-secondary)">(${ex.dept})</span></h4>
                        <p>${new Date(ex.date).toLocaleDateString()}</p>
                    </div>
                `;
            });
        }
    }
}

window.openAddDeptModal = function() {
    if (!requireAuth()) return;
    document.getElementById('input-dept-old-name').value = '';
    document.getElementById('input-dept-name').value = '';
    document.getElementById('input-dept-cap').value = '60';
    document.getElementById('input-dept-sec-count').value = '2';
    document.getElementById('deptModalTitle').innerText = 'Add Department';
    document.getElementById('deptModalSubmitBtn').innerText = 'Add Department';
    openModal('deptModal');
}

window.openEditDeptModal = function(oldName) {
    if (!requireAuth()) return;
    document.getElementById('input-dept-old-name').value = oldName;
    document.getElementById('input-dept-name').value = oldName;
    const dept = collegeData.departments.find(d => d.name === oldName);
    document.getElementById('input-dept-cap').value = dept ? (dept.capacity || 60) : '60';
    document.getElementById('input-dept-sec-count').value = dept ? (dept.sectionCount || 2) : '2';
    document.getElementById('deptModalTitle').innerText = 'Edit Department';
    document.getElementById('deptModalSubmitBtn').innerText = 'Save Changes';
    openModal('deptModal');
}

window.handleDeptSubmit = function(e) {
    e.preventDefault();
    const oldName = document.getElementById('input-dept-old-name').value;
    const nameInput = document.getElementById('input-dept-name').value.trim();
    const capInput = parseInt(document.getElementById('input-dept-cap').value) || 60;
    const secCountInput = parseInt(document.getElementById('input-dept-sec-count').value) || 1;
    const semCountInput = 8;
    
    // Duplicate check
    const exists = collegeData.departments.find(d => d.name.toLowerCase() === nameInput.toLowerCase());
    if (exists && exists.name !== oldName) {
        showToast('Department already exists!', 'error');
        return;
    }

    if (oldName) {
        // Edit mode
        const dept = collegeData.departments.find(d => d.name === oldName);
        if (dept) {
            const letters = ['A','B','C','D','E','F','G','H','I','J'];
            if (secCountInput < dept.sectionCount) {
                let hasStudents = false;
                for(let i=secCountInput; i<dept.sectionCount; i++) {
                    if (dept.sections[letters[i]] && dept.sections[letters[i]].length > 0) {
                        hasStudents = true;
                        break;
                    }
                }
                if (hasStudents) {
                    showToast('Cannot reduce sections: Students currently exist in those upper sections!', 'error');
                    return;
                }
                for(let i=secCountInput; i<dept.sectionCount; i++) {
                    delete dept.sections[letters[i]];
                }
            }

            dept.name = nameInput;
            dept.capacity = capInput;
            dept.sectionCount = secCountInput;
            dept.semCount = semCountInput;
            
            for(let i=0; i<secCountInput; i++) {
                if(!dept.sections[letters[i]]) dept.sections[letters[i]] = [];
            }
            
            // Cascade changes
            collegeData.students.forEach(s => { if(s.dept === oldName) s.dept = nameInput; });
            collegeData.exams.forEach(ex => { if(ex.dept === oldName) ex.dept = nameInput; });
            collegeData.resources.forEach(r => { if(r.dept === oldName) r.dept = nameInput; });
            collegeData.attendanceRecords.forEach(a => { if(a.dept === oldName) a.dept = nameInput; });
            
            showToast(`Department renamed/updated to ${nameInput}.`);
        }
    } else {
        // Create mode
        const letters = ['A','B','C','D','E','F','G','H','I','J'];
        const newSections = {};
        for(let i=0; i<secCountInput; i++) {
            newSections[letters[i]] = [];
        }

        collegeData.departments.push({
            name: nameInput,
            capacity: capInput,
            sectionCount: secCountInput,
            semCount: semCountInput,
            sections: newSections,
            subjects: []
        });
        showToast(`Department ${nameInput} created.`);
    }

    saveData();
    closeModal('deptModal');
    document.getElementById('form-dept').reset();
    renderDepartments();
    updateDeptDropdowns();
    renderStudents();
    renderExams();
    renderResources();
}

window.deleteDepartment = function(deptName) {
    if (!requireAuth()) return;
    if(confirm(`Are you sure you want to delete the department "${deptName}"?\nThis will cascade and permanently delete all students, exams, resources, and attendance records associated with it.`)) {
        collegeData.departments = collegeData.departments.filter(d => d.name !== deptName);
        
        collegeData.students = collegeData.students.filter(s => s.dept !== deptName);
        collegeData.exams = collegeData.exams.filter(e => e.dept !== deptName);
        collegeData.resources = collegeData.resources.filter(r => r.dept !== deptName);
        collegeData.attendanceRecords = collegeData.attendanceRecords.filter(a => a.dept !== deptName);

        saveData();
        renderDepartments();
        updateDeptDropdowns();
        renderStudents();
        renderExams();
        renderResources();
        
        showToast(`Department "${deptName}" deleted.`);
    }
}

function renderDepartments() {
    const grid = document.getElementById('dept-list');
    grid.innerHTML = '';

    if (collegeData.departments.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1"><i class="fa-solid fa-sitemap"></i><p>No departments configured.</p></div>';
        return;
    }

    collegeData.departments.forEach(dept => {
        // Group by semester
        const sems = {};
        for(let i=1; i<=(dept.semCount || 8); i++) sems[i] = [];
        (dept.subjects || []).forEach(s => {
            let semNum = parseInt(s.sem) || 1;
            if(!sems[semNum]) sems[semNum] = [];
            sems[semNum].push(s);
        });

        let subjectMarkup = '';
        Object.keys(sems).forEach(sem => {
            if (sems[sem] && sems[sem].length > 0) {
                subjectMarkup += `<div class="sem-group"><strong style="font-size:0.8rem;color:var(--text-secondary)">Sem ${sem}</strong><div class="subject-tags" style="margin-top:5px;margin-bottom:10px;">`;
                subjectMarkup += sems[sem].map(s => `
                    <div class="subject-tag">
                        ${s.name}
                        <button onclick="deleteSubject('${dept.name.replace(/'/g, "\\'")}', '${s.name.replace(/'/g, "\\'")}', ${s.sem})"><i class="fa-solid fa-times"></i></button>
                    </div>
                `).join('');
                subjectMarkup += `</div></div>`;
            }
        });

        grid.innerHTML += `
            <div class="dept-card" style="position: relative;">
                <div style="position: absolute; right: 10px; top: 10px; display: flex; gap: 5px;">
                    <button onclick="openEditDeptModal('${dept.name.replace(/'/g, "\\'")}')" class="btn-text" style="color: var(--primary); padding: 5px;" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteDepartment('${dept.name.replace(/'/g, "\\'")}')" class="btn-text" style="color: var(--danger); padding: 5px;" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
                <h3 style="padding-right: 60px;">${dept.name}</h3>
                <div class="dept-stats">
                    ${dept.sections ? Object.keys(dept.sections).map(sec => `
                        <div class="sec-stat">
                            <span>Section ${sec}</span>
                            <span><strong>${dept.sections[sec].length}</strong> / ${dept.capacity || 60}</span>
                        </div>
                    `).join('') : ''}
                </div>
                <div class="subject-section">
                    <div class="subject-section-head">
                        <span>Subjects (${(dept.subjects || []).length})</span>
                        <button class="btn-add-subject" onclick="openSubjectModal('${dept.name.replace(/'/g, "\\'")}')">+ Add</button>
                    </div>
                    <div class="subject-groups">
                        ${subjectMarkup}
                    </div>
                </div>
            </div>
        `;
    });
}

function updateDeptDropdowns() {
    const opts = collegeData.departments.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    
    // Student logic
    const stuDrop = document.getElementById('input-stu-dept');
    stuDrop.innerHTML = opts;

    // Exam logic
    const exDrop = document.getElementById('input-ex-dept');
    exDrop.innerHTML = opts;

    // Resource Dropdown
    const resDrop = document.getElementById('input-res-dept');
    if(resDrop) resDrop.innerHTML = opts;

    // Filters
    const filterDept = document.getElementById('filter-dept');
    filterDept.innerHTML = `<option value="all">All Departments</option>` + opts;

    const filterExDept = document.getElementById('filter-exam-dept');
    filterExDept.innerHTML = `<option value="all">All Departments</option>` + opts;

    const filterResDept = document.getElementById('filter-res-dept');
    if(filterResDept) filterResDept.innerHTML = `<option value="all">All Departments</option>` + opts;

    const filterAttDept = document.getElementById('filter-att-dept');
    if(filterAttDept) filterAttDept.innerHTML = `<option value="all">Select Department</option>` + opts;
}

window.populateSectionDropdown = function(deptName, secElemId, defaultLabel) {
    const secSelect = document.getElementById(secElemId);
    if (!secSelect) return;
    secSelect.innerHTML = defaultLabel ? `<option value="all">${defaultLabel}</option>` : '';
    if (deptName !== 'all') {
        const d = collegeData.departments.find(d => d.name === deptName);
        if (d && d.sections) {
            Object.keys(d.sections).forEach(sec => {
                secSelect.innerHTML += `<option value="${sec}">Section ${sec}</option>`;
            });
        }
    }
}

window.populateSemesterDropdown = function(deptName, semElemId, defaultLabel) {
    const semSelect = document.getElementById(semElemId);
    if (!semSelect) return;
    semSelect.innerHTML = defaultLabel ? `<option value="all">${defaultLabel}</option>` : '';
    if (deptName && deptName !== 'all') {
        const d = collegeData.departments.find(d => d.name === deptName);
        if (d) {
            const count = d.semCount || 8;
            for (let i = 1; i <= count; i++) {
                semSelect.innerHTML += `<option value="${i}">Semester ${i}</option>`;
            }
        }
    }
}

window.handleFilterDeptChange = function() {
    const deptName = document.getElementById('filter-dept').value;
    populateSectionDropdown(deptName, 'filter-sec', 'All Sections');
    renderStudents();
}

window.handleStuDeptChange = function() {
    const deptName = document.getElementById('input-stu-dept').value;
    populateSemesterDropdown(deptName, 'input-stu-sem', null);
    populateSectionDropdown(deptName, 'input-stu-sec', null);
}

// Subject Module
window.openSubjectModal = function(deptName) {
    if (!requireAuth()) return;
    document.getElementById('input-sub-dept').value = deptName;
    populateSemesterDropdown(deptName, 'input-sub-sem', null);
    openModal('subjectModal');
}

window.handleSubjectSubmit = function(e) {
    e.preventDefault();
    const deptName = document.getElementById('input-sub-dept').value;
    const semValue = parseInt(document.getElementById('input-sub-sem').value) || 1;
    const subName = document.getElementById('input-sub-name').value.trim();

    const dept = collegeData.departments.find(d => d.name === deptName);
    if (!dept) return;

    if (!dept.subjects) dept.subjects = [];

    // Duplicate check
    if (dept.subjects.find(s => s.name.toLowerCase() === subName.toLowerCase() && s.sem === semValue)) {
        showToast("Subject already exists in this semester!", "error");
        return;
    }

    dept.subjects.push({ name: subName, sem: semValue });
    saveData();
    closeModal('subjectModal');
    document.getElementById('form-subject').reset();
    renderDepartments();

    const filterAttDept = document.getElementById('filter-att-dept');
    if (filterAttDept && filterAttDept.value === deptName && window.handleAttDeptChange) {
        window.handleAttDeptChange();
    }

    showToast(`Subject Added.`);
}

window.deleteSubject = function(deptName, subName, semValue) {
    if (!requireAuth()) return;
    if(confirm(`Delete subject from ${deptName} (Sem ${semValue})?`)) {
        const dept = collegeData.departments.find(d => d.name === deptName);
        if (dept) {
            dept.subjects = dept.subjects.filter(s => !(s.name === subName && s.sem === parseInt(semValue)));
            saveData();
            renderDepartments();
            showToast("Subject removed.");

            const filterAttDept = document.getElementById('filter-att-dept');
            if (filterAttDept && filterAttDept.value === deptName && window.handleAttDeptChange) {
                window.handleAttDeptChange();
            }
        }
    }
}

window.openStudentModal = function() {
    if (!requireAuth()) return;
    if(collegeData.departments.length === 0) {
        showToast("Please create a department first!", "error");
        return;
    }
    setTimeout(() => { window.handleStuDeptChange(); }, 0);
    openModal('studentModal');
}

/* ---------- Student Module ---------- */
window.handleStudentSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById('input-stu-name').value.trim();
    const roll = document.getElementById('input-stu-roll').value.trim();
    const deptName = document.getElementById('input-stu-dept').value;
    const semValue = parseInt(document.getElementById('input-stu-sem').value) || 1;
    const sec = document.getElementById('input-stu-sec').value;

    // Duplicate roll check
    if (collegeData.students.find(s => s.roll === roll)) {
        showToast("Roll number already exists!", "error");
        return;
    }

    // Capacity Logic
    // Capacity Logic
    const dept = collegeData.departments.find(d => d.name === deptName);
    if (!dept || !dept.sections || !dept.sections[sec]) {
        showToast("Invalid section selected.", "error");
        return;
    }
    const targetArray = dept.sections[sec];

    const capacity = dept.capacity || 60;
    if (targetArray.length >= capacity) {
        showToast(`Section ${sec} of ${deptName} is full! (Max ${capacity})`, "error");
        return;
    }

    const newStudent = { id: genId(), name, roll, dept: deptName, sem: semValue, sec };
    
    // Insert into global students
    collegeData.students.push(newStudent);
    // Insert into Department Tracker
    targetArray.push(newStudent.id);

    saveData();
    closeModal('studentModal');
    document.getElementById('form-student').reset();
    renderStudents();
    renderDepartments(); // refesh capacity
    showToast("Student enrolled successfully.");
}

window.renderStudents = function(sortKey = null) {
    const tbody = document.getElementById('student-tbody');
    tbody.innerHTML = '';

    const deptFilter = document.getElementById('filter-dept').value;
    const secFilter = document.getElementById('filter-sec').value;

    let displayList = [...collegeData.students];

    // Filter
    if (deptFilter !== 'all') displayList = displayList.filter(s => s.dept === deptFilter);
    if (secFilter !== 'all') displayList = displayList.filter(s => s.sec === secFilter);

    // Sort
    if (sortKey === 'name') {
        displayList.sort((a,b) => a.name.localeCompare(b.name));
    }

    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No students match criteria.</td></tr>`;
        return;
    }

    displayList.forEach(stu => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${stu.roll}</strong></td>
                <td>${stu.name}</td>
                <td>${stu.dept}</td>
                <td><span class="badge" style="background:var(--bg-secondary); color:var(--text-main); margin-right:4px; border:1px solid var(--border);">Sem ${stu.sem || 1}</span></td>
                <td><span class="badge badge-a">Sec ${stu.sec}</span></td>
                <td style="display:flex; gap:6px;">
                    <button class="action-btn" style="color:var(--primary);" title="Edit" onclick="openEditStudentModal('${stu.id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn" title="Delete" onclick="deleteStudent('${stu.id}', '${stu.dept}', '${stu.sec}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

window.sortStudents = function(key) {
    renderStudents(key);
}

window.openEditStudentModal = function(stuId) {
    if (!requireAuth()) return;
    const stu = collegeData.students.find(s => s.id === stuId);
    if (!stu) return;

    document.getElementById('edit-stu-id').value   = stu.id;
    document.getElementById('edit-stu-name').value = stu.name;
    document.getElementById('edit-stu-roll').value = stu.roll;

    // Populate semester dropdown based on dept
    populateSemesterDropdown(stu.dept, 'edit-stu-sem', null);
    document.getElementById('edit-stu-sem').value = stu.sem || 1;

    // Populate section dropdown based on dept
    populateSectionDropdown(stu.dept, 'edit-stu-sec', null);
    document.getElementById('edit-stu-sec').value = stu.sec;

    // Show dept name (read-only)
    document.getElementById('edit-stu-dept-label').textContent = stu.dept;

    openModal('editStudentModal');
}

window.handleEditStudentSubmit = function(e) {
    e.preventDefault();

    const stuId   = document.getElementById('edit-stu-id').value;
    const newName = document.getElementById('edit-stu-name').value.trim();
    const newRoll = document.getElementById('edit-stu-roll').value.trim();
    const newSem  = parseInt(document.getElementById('edit-stu-sem').value) || 1;
    const newSec  = document.getElementById('edit-stu-sec').value;

    // Duplicate roll check (ignore self)
    const rollConflict = collegeData.students.find(s => s.roll === newRoll && s.id !== stuId);
    if (rollConflict) {
        showToast('Roll number already used by another student!', 'error');
        return;
    }

    const stu = collegeData.students.find(s => s.id === stuId);
    if (!stu) return;

    const dept = collegeData.departments.find(d => d.name === stu.dept);

    // If section changed — move the student ID between section arrays
    if (newSec !== stu.sec && dept) {
        const oldSecArr = dept.sections[stu.sec];
        const newSecArr = dept.sections[newSec];

        if (!newSecArr) {
            showToast('Target section does not exist!', 'error');
            return;
        }
        const capacity = dept.capacity || 60;
        if (newSecArr.length >= capacity) {
            showToast(`Section ${newSec} is full! (Max ${capacity})`, 'error');
            return;
        }

        // Move
        if (oldSecArr) dept.sections[stu.sec] = oldSecArr.filter(id => id !== stuId);
        newSecArr.push(stuId);
    }

    // Apply edits
    stu.name = newName;
    stu.roll = newRoll;
    stu.sem  = newSem;
    stu.sec  = newSec;

    saveData();
    closeModal('editStudentModal');
    renderStudents();
    renderDepartments();
    showToast(`Student "${newName}" updated successfully.`);
}

window.deleteStudent = function(stuId, deptName, sec) {
    if (!requireAuth()) return;
    if(confirm("Are you sure you want to remove this student?")) {
        // Remove from global
        collegeData.students = collegeData.students.filter(s => s.id !== stuId);
        // Remove from department array
        const dept = collegeData.departments.find(d => d.name === deptName);
        if (dept && dept.sections && dept.sections[sec]) {
            dept.sections[sec] = dept.sections[sec].filter(id => id !== stuId);
        }

        saveData();
        renderStudents();
        renderDepartments();
        showToast("Student removed.");
    }
}

/* ---------- Notice Module ---------- */
window.handleNoticeSubmit = function(e) {
    e.preventDefault();
    const title = document.getElementById('input-not-title').value.trim();
    const content = document.getElementById('input-not-content').value.trim();
    const fileInput = document.getElementById('input-not-file');
    const file = fileInput ? fileInput.files[0] : null;

    const saveNotice = (fileData, fileName) => {
        collegeData.notices.unshift({
            id: genId(),
            title,
            content,
            fileData: fileData || '',
            fileName: fileName || '',
            date: new Date().getTime()
        });

        try {
            saveData();
            closeModal('noticeModal');
            document.getElementById('form-notice').reset();
            renderNotices();
            updateDashboard(); // Important since notices show on dashboard
            showToast("Notice published.");
        } catch (err) {
            collegeData.notices.shift();
            saveData();
            showToast("Storage full! File is too large.", "error");
        }
    };

    if (file) {
        if (file.size > 1.5 * 1024 * 1024) {
            showToast("File must be less than 1.5MB.", "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            saveNotice(evt.target.result, file.name);
        };
        reader.onerror = function() {
            showToast("Error reading file.", "error");
        };
        reader.readAsDataURL(file);
    } else {
        saveNotice('', '');
    }
}

window.renderNotices = function() {
    const grid = document.getElementById('notice-list');
    grid.innerHTML = '';
    const term = document.getElementById('notice-search').value.toLowerCase();

    const displayList = collegeData.notices.filter(n => n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term));

    if (displayList.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1">No notices found.</div>';
        return;
    }

    displayList.forEach(n => {
        const safeContent = n.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        let attachmentHTML = '';
        if (n.fileData && n.fileData.startsWith('data:')) {
            const fName = n.fileName ? n.fileName : 'Attachment';
            attachmentHTML = `
                <div style="margin-top: 15px;">
                    <a href="${n.fileData}" download="${fName}" class="btn-text" style="display:inline-flex; align-items:center; gap:0.5rem; padding: 0.5rem 1rem; border: 1px solid var(--border); border-radius: 4px; text-decoration: none;">
                        <i class="fa-solid fa-download"></i> Download ${fName}
                    </a>
                </div>
            `;
        }
        
        grid.innerHTML += `
            <div class="notice-card" style="position:relative;">
                <button class="del-notice" onclick="deleteNotice('${n.id}')" style="position:absolute; right:15px; top:15px; background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                <h3>${n.title}</h3>
                <p class="date">${new Date(n.date).toLocaleDateString()}</p>
                <p class="content">${safeContent}</p>
                ${attachmentHTML}
            </div>
        `;
    });
}

window.deleteNotice = function(id) {
    if (!requireAuth()) return;
    if(confirm("Delete this notice?")) {
        collegeData.notices = collegeData.notices.filter(n => n.id !== id);
        saveData();
        renderNotices();
        showToast("Notice deleted.");
    }
}

/* ---------- Exams Module ---------- */
window.openExamModal = function() {
    if (!requireAuth()) return;
    if(collegeData.departments.length === 0) {
        showToast("Please create a department first!", "error");
        return;
    }
    openModal('examModal');
}


window.handleExamSubmit = function(e) {
    e.preventDefault();
    const subject = document.getElementById('input-ex-sub').value.trim();
    const date = document.getElementById('input-ex-date').value;
    const dept = document.getElementById('input-ex-dept').value;

    collegeData.exams.push({ id: genId(), subject, date, dept });

    saveData();
    closeModal('examModal');
    document.getElementById('form-exam').reset();
    renderExams();
    showToast("Exam scheduled.");
}


window.renderExams = function(sortKey = null) {
    const tbody = document.getElementById('exam-tbody');
    tbody.innerHTML = '';

    const deptFilter = document.getElementById('filter-exam-dept').value;

    let displayList = [...collegeData.exams];

    if (deptFilter !== 'all') {
        displayList = displayList.filter(e => e.dept === deptFilter);
    }

    if (sortKey === 'date') {
        displayList.sort((a,b) => new Date(a.date) - new Date(b.date));
    }

    if (displayList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">No exams scheduled.</td></tr>`;
        return;
    }

    displayList.forEach(ex => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${ex.subject}</strong></td>
                <td>${new Date(ex.date).toLocaleDateString()}</td>
                <td><span style="color:var(--text-secondary)">${ex.dept}</span></td>
                <td>
                    <button class="action-btn" onclick="deleteExam('${ex.id}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

window.deleteExam = function(id) {
    if (!requireAuth()) return;
    if(confirm("Delete this exam schedule?")) {
        collegeData.exams = collegeData.exams.filter(e => e.id !== id);
        saveData();
        renderExams();
        showToast("Exam removed.");
    }
}

window.sortExams = function(key) {
    renderExams(key);
}

/* ---------- Academic Resources Module ---------- */
window.openResourceModal = function() {
    if (!requireAuth()) return;
    if(collegeData.departments.length === 0) {
        showToast("Please create a department first!", "error");
        return;
    }
    openModal('resourceModal');
}

window.handleResourceSubmit = function(e) {
    e.preventDefault();
    const title = document.getElementById('input-res-title').value.trim();
    const dept = document.getElementById('input-res-dept').value;
    const linkInput = document.getElementById('input-res-link').value.trim();
    const content = document.getElementById('input-res-content').value.trim();
    const fileInput = document.getElementById('input-res-file');
    const file = fileInput ? fileInput.files[0] : null;

    const saveResource = (finalLink, fileName) => {
        collegeData.resources.unshift({
            id: genId(),
            title,
            dept,
            link: finalLink,
            fileName: fileName || '',
            content,
            date: new Date().getTime()
        });

        try {
            saveData();
            closeModal('resourceModal');
            document.getElementById('form-resource').reset();
            renderResources();
            showToast("Resource added successfully.");
        } catch (err) {
            // Revert push if localstorage is full
            collegeData.resources.shift();
            saveData(); 
            showToast("Storage full! File is too large.", "error");
        }
    };

    if (file) {
        if (file.size > 1.5 * 1024 * 1024) {
            showToast("File must be less than 1.5MB.", "error");
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            saveResource(evt.target.result, file.name);
        };
        reader.onerror = function() {
            showToast("Error reading file.", "error");
        };
        reader.readAsDataURL(file);
    } else {
        saveResource(linkInput, '');
    }
}

window.renderResources = function() {
    const grid = document.getElementById('resource-list');
    if(!grid) return;
    grid.innerHTML = '';
    
    const deptFilter = document.getElementById('filter-res-dept').value;
    const term = document.getElementById('resource-search').value.toLowerCase();

    let displayList = collegeData.resources.filter(r => 
        (r.title.toLowerCase().includes(term) || r.content.toLowerCase().includes(term))
    );

    if (deptFilter !== 'all') {
        displayList = displayList.filter(r => r.dept === deptFilter);
    }

    if (displayList.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1">No notes or PDFs found.</div>';
        return;
    }

    displayList.forEach(r => {
        const isPdf = r.link && (r.link.toLowerCase().endsWith('.pdf') || r.link.includes('drive.google.com') || r.link.startsWith('data:'));
        const safeContent = r.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        
        let linkHTML = '';
        if (r.link) {
            if (r.link.startsWith('data:')) {
                const fName = r.fileName ? r.fileName : 'Document';
                linkHTML = `<a href="${r.link}" download="${fName}" class="res-link"><i class="fa-solid fa-download"></i> Download ${fName}</a>`;
            } else {
                linkHTML = `<a href="${r.link}" target="_blank" class="res-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open Resource</a>`;
            }
        }

        grid.innerHTML += `
            <div class="resource-card ${isPdf ? 'pdf-type' : ''}">
                <button class="del-resource" onclick="deleteResource('${r.id}')"><i class="fa-solid fa-trash"></i></button>
                <h3>${r.title} <span style="font-size:0.8rem; color:var(--text-secondary)">(${r.dept})</span></h3>
                <p class="date">${new Date(r.date).toLocaleDateString()}</p>
                ${safeContent ? `<p class="content">${safeContent}</p>` : ''}
                ${linkHTML}
            </div>
        `;
    });
}

window.deleteResource = function(id) {
    if (!requireAuth()) return;
    if(confirm("Delete this academic resource?")) {
        collegeData.resources = collegeData.resources.filter(r => r.id !== id);
        saveData();
        renderResources();
        showToast("Resource deleted.");
    }
}

/* ---------- Attendance Module ---------- */
window.handleAttDeptChange = function() {
    const deptName = document.getElementById('filter-att-dept').value;
    // Reset downstream dropdowns
    document.getElementById('filter-att-sec').innerHTML = '<option value="all">Select Section</option>';
    const subjSelect = document.getElementById('input-att-subj');
    subjSelect.innerHTML = '<option value="">Select Subject</option>';

    if (deptName !== 'all') {
        populateSectionDropdown(deptName, 'filter-att-sec', 'Select Section');
        const dept = collegeData.departments.find(d => d.name === deptName);
        if (dept && dept.subjects) {
            dept.subjects.forEach(sub => {
                subjSelect.innerHTML += `<option value="${sub.name}">${sub.name}</option>`;
            });
        }
    }
    window.renderAttendanceSheet();
}

window.renderAttendanceSheet = function() {
    const tbody = document.getElementById('attendance-tbody');
    if(!tbody) return;

    const dept = document.getElementById('filter-att-dept').value;
    const sec  = document.getElementById('filter-att-sec').value;
    const date = document.getElementById('input-att-date').value;
    const subj = document.getElementById('input-att-subj').value.trim();

    if (dept === 'all' || !date || !subj) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Select Department, Section, Date and Subject to take attendance.</td></tr>`;
        return;
    }

    // Filter students by dept AND section
    const students = collegeData.students.filter(s =>
        s.dept === dept && (sec === 'all' || s.sec === sec)
    );

    // Find an existing record matching
    const existingRecord = collegeData.attendanceRecords.find(r =>
        r.date === date &&
        r.dept === dept &&
        r.sec  === sec &&
        r.subject && r.subject.toLowerCase() === subj.toLowerCase()
    );

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No students found in ${dept} Section ${sec}.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    students.sort((a,b) => a.roll.localeCompare(b.roll)).forEach(stu => {
        const isPresent = existingRecord ? existingRecord.presentIds.includes(stu.id) : false;
        tbody.innerHTML += `
            <tr>
                <td><strong>${stu.roll}</strong></td>
                <td>${stu.name}</td>
                <td style="text-align: center;">
                    <label class="att-toggle">
                        <input type="checkbox" class="att-checkbox" data-studentid="${stu.id}" ${isPresent ? 'checked' : ''} onchange="this.nextElementSibling.nextElementSibling.innerText = this.checked ? 'Present' : 'Absent'">
                        <span class="toggle-slider"></span>
                        <span class="toggle-label">${isPresent ? 'Present' : 'Absent'}</span>
                    </label>
                </td>
            </tr>
        `;
    });
}

window.saveAttendance = function() {
    if (!requireAuth()) return;
    const dept = document.getElementById('filter-att-dept').value;
    const sec  = document.getElementById('filter-att-sec').value;
    const date = document.getElementById('input-att-date').value;
    const subj = document.getElementById('input-att-subj').value.trim();

    if (dept === 'all' || !date || !subj) {
        showToast("Please fill all fields (Dept, Sec, Date, Subject) before saving.", "error");
        return;
    }

    const checkboxes = document.querySelectorAll('.att-checkbox');
    if (checkboxes.length === 0) {
        showToast("No students to save attendance for.", "error");
        return;
    }

    const presentIds = [];
    checkboxes.forEach(cb => {
        if (cb.checked) presentIds.push(cb.getAttribute('data-studentid'));
    });

    // Remove old record for the exact same (date, dept, sec, subject)
    collegeData.attendanceRecords = collegeData.attendanceRecords.filter(r =>
        !(r.date === date && r.dept === dept && r.sec === sec &&
          r.subject && r.subject.toLowerCase() === subj.toLowerCase())
    );

    collegeData.attendanceRecords.push({
        date,
        dept,
        sec,
        subject: subj,
        presentIds
    });

    saveData();
    showToast(`Attendance saved for ${dept} (${subj})!`);
}

/* ---------- Global Search Logic (Ctrl + K) ---------- */
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // Ctrl + K Focus Search
        if (e.ctrlKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openSearchModal();
        }
    });
}

window.openSearchModal = function() {
    openModal('searchModal');
    setTimeout(() => {
        document.getElementById('global-search-input').focus();
    }, 100);
}

window.performGlobalSearch = function() {
    const term = document.getElementById('global-search-input').value.toLowerCase();
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';

    if (term.length < 2) return;

    // Search Students
    const studentRes = collegeData.students.filter(s => s.name.toLowerCase().includes(term) || s.roll.toLowerCase().includes(term));
    studentRes.forEach(s => {
        resultsDiv.innerHTML += `
            <div class="search-item" onclick="switchPage('students'); closeModal('searchModal')">
                <strong>${s.name} (${s.roll})</strong>
                <span>Student • ${s.dept} - Sec ${s.sec}</span>
            </div>
        `;
    });

    // Search Departments
    const deptRes = collegeData.departments.filter(d => d.name.toLowerCase().includes(term));
    deptRes.forEach(d => {
        resultsDiv.innerHTML += `
            <div class="search-item" onclick="switchPage('departments'); closeModal('searchModal')">
                <strong>${d.name}</strong>
                <span>Department</span>
            </div>
        `;
    });

    // Search Resources
    const resRes = collegeData.resources.filter(r => r.title.toLowerCase().includes(term));
    resRes.forEach(r => {
        resultsDiv.innerHTML += `
            <div class="search-item" onclick="switchPage('resources'); closeModal('searchModal')">
                <strong>${r.title}</strong>
                <span>Resource • ${r.dept}</span>
            </div>
        `;
    });

    if(resultsDiv.innerHTML === '') {
        resultsDiv.innerHTML = '<div class="empty-state">No results found</div>';
    }
}

/* ---------- Authentication Module ---------- */
function requireAuth() {
    if (!currentUser) {
        showToast("You need to login to perform this action.", "warning");
        openModal('authModal');
        return false;
    }
    return true;
}

function checkAuthState() {
    const authContainer = document.getElementById('auth-container');
    if (!authContainer) return;
    
    if (currentUser) {
        // Show Profile
        const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
        const imgUrl = currentUser.picture ? currentUser.picture : `https://ui-avatars.com/api/?name=${initial}&background=0D8ABC&color=fff`;
        authContainer.innerHTML = `
            <div class="profile-badge">
                <img src="${imgUrl}" alt="${currentUser.name}">
                <div class="profile-info">
                    <span class="profile-name">${currentUser.name}</span>
                </div>
                <button class="btn-text" onclick="openProfileModal()" style="margin-left:12px;" title="Account Settings"><i class="fa-solid fa-gear"></i></button>
                <button class="btn-text" onclick="handleLogout()" style="margin-left:4px;" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
        `;
    } else {
        // Show Login Button
        authContainer.innerHTML = `
            <button class="btn-primary" onclick="openModal('authModal')"><i class="fa-regular fa-user"></i> Login / Sign Up</button>
        `;
    }
}

window.switchAuthTab = function(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    
    if (tab !== 'forgot') {
        const activeTab = document.querySelector(`.auth-tab[data-tab="${tab}"]`);
        if (activeTab) activeTab.classList.add('active');
        const commonEls = document.getElementById('auth-common-elements');
        if (commonEls) commonEls.style.display = 'block';
    } else {
        const commonEls = document.getElementById('auth-common-elements');
        if (commonEls) commonEls.style.display = 'none';
    }
    
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`form-${tab}`).classList.add('active');
}

window.handleLoginSubmit = function(e) {
    e.preventDefault();
    const identifier = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    
    const user = collegeData.users.find(u => (u.email === identifier || u.phone === identifier) && u.password === pass);
    if (user) {
        currentUser = { name: user.name, email: user.email };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        closeModal('authModal');
        document.getElementById('form-login').reset();
        checkAuthState();
        showToast(`Welcome back, ${user.name}!`);
    } else {
        showToast("Invalid email or password", "error");
    }
}

window.handleSignupSubmit = function(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const pass = document.getElementById('signup-password').value;
    
    if (collegeData.users.find(u => u.email === email || (u.phone && u.phone === phone))) {
        showToast("Email or Phone already registered. Try logging in.", "error");
        return;
    }
    
    const newUser = { name, email, phone, password: pass };
    collegeData.users.push(newUser);
    saveData();
    
    currentUser = { name, email };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    closeModal('authModal');
    document.getElementById('form-signup').reset();
    checkAuthState();
    showToast("Account created successfully!");
}

window.handleForgotSubmit = function(e) {
    e.preventDefault();
    const identifier = document.getElementById('forgot-id').value.trim();
    
    const user = collegeData.users.find(u => u.email === identifier || u.phone === identifier);
    if (user) {
        showToast(`Password Recovery: Your password is "${user.password}"`, 'success');
        setTimeout(() => switchAuthTab('login'), 2500);
        document.getElementById('form-forgot').reset();
    } else {
        showToast("Account not found with that email or phone.", "error");
    }
}

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
}

window.handleCredentialResponse = function(response) {
    const responsePayload = decodeJwtResponse(response.credential);
    const name = responsePayload.name;
    const email = responsePayload.email;
    const picture = responsePayload.picture;
    
    currentUser = { name, email, picture };
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    closeModal('authModal');
    checkAuthState();
    showToast(`Signed in as ${name}`);
}

window.togglePasswordVisibility = function(inputId, icon) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

window.handleLogout = function() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    checkAuthState();
    showToast("Logged out successfully.");
}

window.openNoticeModal = function() {
    if (!requireAuth()) return;
    openModal('noticeModal');
}

window.openProfileModal = function() {
    if (!currentUser) return;
    
    // Find full user details
    const user = collegeData.users.find(u => u.email === currentUser.email);
    if (!user) {
        // Must be google user without explicit record
        document.getElementById('prof-name').value = currentUser.name || '';
        document.getElementById('prof-email').value = currentUser.email || '';
        document.getElementById('prof-phone').value = '';
        document.getElementById('prof-password').value = '';
    } else {
        document.getElementById('prof-name').value = user.name || '';
        document.getElementById('prof-email').value = user.email || '';
        document.getElementById('prof-phone').value = user.phone || '';
        document.getElementById('prof-password').value = user.password || '';
    }
    
    openModal('profileModal');
}

window.handleProfileUpdate = function(e) {
    e.preventDefault();
    const newName = document.getElementById('prof-name').value.trim();
    const newEmail = document.getElementById('prof-email').value.trim();
    const newPhone = document.getElementById('prof-phone').value.trim();
    const newPass = document.getElementById('prof-password').value;
    
    const userIndex = collegeData.users.findIndex(u => u.email === currentUser.email);
    
    // Check conflicts
    const conflict = collegeData.users.find((u, idx) => 
        idx !== userIndex && (u.email === newEmail || (u.phone && u.phone === newPhone && newPhone !== ''))
    );
    if (conflict) {
        showToast("Email or Phone is already used by another account.", "error");
        return;
    }
    
    if (userIndex !== -1) {
        // Update regular user
        collegeData.users[userIndex].name = newName;
        collegeData.users[userIndex].email = newEmail;
        collegeData.users[userIndex].phone = newPhone;
        collegeData.users[userIndex].password = newPass;
    } else {
        // Transition Google user to local if they try to save
        collegeData.users.push({
            name: newName,
            email: newEmail,
            phone: newPhone,
            password: newPass
        });
    }
    saveData();
    
    // Update active session
    currentUser.name = newName;
    currentUser.email = newEmail;
    // keep picture if exists
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    closeModal('profileModal');
    checkAuthState();
    showToast("Profile updated successfully!");
}

window.deleteAccount = function() {
    if(confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
        collegeData.users = collegeData.users.filter(u => u.email !== currentUser.email);
        saveData();
        
        currentUser = null;
        localStorage.removeItem('currentUser');
        
        closeModal('profileModal');
        checkAuthState();
        showToast("Account deleted successfully.");
    }
}
