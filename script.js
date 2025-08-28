// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-analytics.js";

// Import Firebase Configuration
import firebaseConfig from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// DOM Elements
// Auth elements
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userName = document.getElementById('user-name');
const authForms = document.getElementById('auth-forms');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const loginFormElement = document.getElementById('login-form-element');
const signupFormElement = document.getElementById('signup-form-element');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');

// App content elements
const appContent = document.getElementById('app-content');
const studentView = document.getElementById('student-view');
const teacherView = document.getElementById('teacher-view');

// Student view elements
const teacherSelect = document.getElementById('teacher-select');
const appointmentDate = document.getElementById('appointment-date');
const appointmentTime = document.getElementById('appointment-time');
const appointmentReason = document.getElementById('appointment-reason');
const bookAppointmentForm = document.getElementById('book-appointment-form');
const studentAppointments = document.getElementById('student-appointments');

// Teacher view elements
const availabilityForm = document.getElementById('availability-form');
const availabilityDate = document.getElementById('availability-date');
const teacherAppointments = document.getElementById('teacher-appointments');

// Notification element
const notificationElement = document.getElementById('notification');

// Current user state
let currentUser = null;
let userRole = null;

// Helper functions
function showNotification(message, type = 'default') {
    notificationElement.textContent = message;
    notificationElement.className = `notification ${type} show`;
    setTimeout(() => {
        notificationElement.classList.remove('show');
    }, 3000);
}

function showLoadingIndicator(element, message = 'Loading...') {
    const originalContent = element.innerHTML;
    element.innerHTML = `<div class="loading-indicator">${message}</div>`;
    return originalContent;
}

function hideLoadingIndicator(element, originalContent) {
    element.innerHTML = originalContent;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function setMinDate(dateInput) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    dateInput.min = yyyy + '-' + mm + '-' + dd;
}

// Set min date for all date inputs
document.addEventListener('DOMContentLoaded', () => {
    setMinDate(appointmentDate);
    setMinDate(availabilityDate);
});

// Auth State Change
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        
        // Hide login/signup buttons, show logout button
        loginBtn.classList.add('hidden');
        signupBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        userInfo.classList.remove('hidden');
        authForms.classList.add('hidden');
        
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        // Update UI based on user role
        userRole = userData.role;
        userName.textContent = userData.name;
        
        // Show appropriate view based on role
        appContent.classList.remove('hidden');
        if (userRole === 'student') {
            studentView.classList.remove('hidden');
            teacherView.classList.add('hidden');
            // Load teachers for student view
            loadTeachers();
            // Load student's appointments
            loadStudentAppointments();
        } else {
            teacherView.classList.remove('hidden');
            studentView.classList.add('hidden');
            // Load teacher's appointments
            loadTeacherAppointments();
        }
    } else {
        // User is signed out
        currentUser = null;
        userRole = null;
        
        // Show login/signup buttons, hide logout button
        loginBtn.classList.remove('hidden');
        signupBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        userInfo.classList.add('hidden');
        authForms.classList.remove('hidden');
        appContent.classList.add('hidden');
        
        // Show login form by default
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    }
});

// Auth UI event listeners
loginBtn.addEventListener('click', () => {
    authForms.classList.remove('hidden');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
});

signupBtn.addEventListener('click', () => {
    authForms.classList.remove('hidden');
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
});

logoutBtn.addEventListener('click', () => {
    signOut(auth)
        .then(() => {
            showNotification('Logged out successfully', 'success');
        })
        .catch(error => {
            console.error('Error signing out:', error);
            showNotification('Error logging out: ' + error.message, 'error');
        });
});

// Login form submission
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const role = document.querySelector('input[name="login-user-type"]:checked').value;
    
    const originalButtonText = loginFormElement.querySelector('button[type="submit"]').textContent;
    loginFormElement.querySelector('button[type="submit"]').textContent = 'Logging in...';
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Check if user role matches
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        const userData = userDoc.data();
        
        if (userData.role !== role) {
            await signOut(auth);
            showNotification(`You're not registered as a ${role}. Please choose the correct role.`, 'error');
            return;
        }
        
        showNotification('Logged in successfully', 'success');
    } catch (error) {
        console.error('Error signing in:', error);
        showNotification('Error logging in: ' + error.message, 'error');
    } finally {
        loginFormElement.querySelector('button[type="submit"]').textContent = originalButtonText;
    }
});

// Signup form submission
signupFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const role = document.querySelector('input[name="signup-user-type"]:checked').value;
    
    // Password validation
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    const originalButtonText = signupFormElement.querySelector('button[type="submit"]').textContent;
    signupFormElement.querySelector('button[type="submit"]').textContent = 'Signing up...';
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Add user data to Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
            name: name,
            email: email,
            role: role,
            createdAt: serverTimestamp()
        });
        showNotification('Account created successfully', 'success');
    } catch (error) {
        console.error('Error signing up:', error);
        showNotification('Error creating account: ' + error.message, 'error');
    } finally {
        signupFormElement.querySelector('button[type="submit"]').textContent = originalButtonText;
    }
});

// Load Teachers function
async function loadTeachers() {
    const originalContent = showLoadingIndicator(teacherSelect, 'Loading teachers...');
    
    try {
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnapshot = await getDocs(teachersQuery);
        
        // Clear previous options
        while (teacherSelect.options.length > 1) {
            teacherSelect.remove(1);
        }
        
        // Add teacher options
        teachersSnapshot.forEach(doc => {
            const teacherData = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = teacherData.name;
            teacherSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading teachers:', error);
        showNotification('Error loading teachers: ' + error.message, 'error');
    } finally {
        hideLoadingIndicator(teacherSelect, originalContent);
    }
}

// Handle date change to load available time slots
appointmentDate.addEventListener('change', async () => {
    const teacherId = teacherSelect.value;
    const selectedDate = appointmentDate.value;
    
    if (!teacherId || !selectedDate) {
        appointmentTime.disabled = true;
        appointmentTime.innerHTML = '<option value="">-- Select Date First --</option>';
        return;
    }
    
    try {
        // Get teacher's availability for the selected date
        const availabilityQuery = query(
            collection(db, 'availability'),
            where('teacherId', '==', teacherId),
            where('date', '==', selectedDate)
        );
        const availabilitySnapshot = await getDocs(availabilityQuery);
        
        // Clear previous options
        appointmentTime.innerHTML = '<option value="">-- Select Time Slot --</option>';
        
        if (availabilitySnapshot.empty) {
            showNotification('No availability found for this date', 'warning');
            appointmentTime.disabled = true;
            return;
        }
        
        // Get booked appointments for this teacher and date to filter out
        const bookedAppointmentsQuery = query(
            collection(db, 'appointments'),
            where('teacherId', '==', teacherId),
            where('date', '==', selectedDate)
        );
        const bookedAppointmentsSnapshot = await getDocs(bookedAppointmentsQuery);
        
        const bookedTimeSlots = new Set();
        bookedAppointmentsSnapshot.forEach(doc => {
            bookedTimeSlots.add(doc.data().timeSlot);
        });
        
        // Add available time slots that are not booked yet
        availabilitySnapshot.forEach(doc => {
            const availabilityData = doc.data();
            const availableSlots = availabilityData.timeSlot || [];
            
            availableSlots.forEach(slot => {
                if (!bookedTimeSlots.has(slot)) {
                    const option = document.createElement('option');
                    option.value = slot;
                    option.textContent = slot;
                    appointmentTime.appendChild(option);
                }
            });
        });
        
        appointmentTime.disabled = false;
    } catch (error) {
        console.error('Error loading time slots:', error);
        showNotification('Error loading time slots: ' + error.message, 'error');
    }
});

// Book appointment form submission
bookAppointmentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const teacherId = teacherSelect.value;
    const date = appointmentDate.value;
    const timeSlot = appointmentTime.value;
    const reason = appointmentReason.value;
    
    if (!teacherId || !date || !timeSlot) {
        showNotification('Please fill all required fields', 'warning');
        return;
    }
    
    const originalButtonText = bookAppointmentForm.querySelector('button[type="submit"]').textContent;
    bookAppointmentForm.querySelector('button[type="submit"]').textContent = 'Booking...';
    
    try {
        // Get teacher data
        const teacherDoc = await getDoc(doc(db, 'users', teacherId));
        const teacherData = teacherDoc.data();
        
        // Add appointment to Firestore
        await addDoc(collection(db, 'appointments'), {
            studentId: currentUser.uid,
            studentName: currentUser.displayName || userName.textContent,
            teacherId: teacherId,
            teacherName: teacherData.name,
            date: date,
            timeSlot: timeSlot,
            reason: reason,
            status: 'scheduled', // scheduled, completed, cancelled
            createdAt: serverTimestamp()
        });
        
        showNotification('Appointment booked successfully', 'success');
        bookAppointmentForm.reset();
        loadStudentAppointments();
    } catch (error) {
        console.error('Error booking appointment:', error);
        showNotification('Error booking appointment: ' + error.message, 'error');
    } finally {
        bookAppointmentForm.querySelector('button[type="submit"]').textContent = originalButtonText;
    }
});

// Load student appointments
async function loadStudentAppointments() {
    if (!currentUser) return;
    
    try {
        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('studentId', '==', currentUser.uid),
            orderBy('date', 'desc')
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        
        // Clear previous appointments
        studentAppointments.innerHTML = '';
        
        if (appointmentsSnapshot.empty) {
            studentAppointments.innerHTML = '<p class="empty-state">No appointments booked yet.</p>';
            return;
        }
        
        // Add appointments to the list
        appointmentsSnapshot.forEach(doc => {
            const appointmentData = doc.data();
            const appointmentEl = createAppointmentElement(doc.id, appointmentData, 'student');
            studentAppointments.appendChild(appointmentEl);
        });
    } catch (error) {
        console.error('Error loading student appointments:', error);
        showNotification('Error loading appointments: ' + error.message, 'error');
    }
}

// Save teacher availability form submission
availabilityForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const date = availabilityDate.value;
    const selectedTimeSlots = Array.from(document.querySelectorAll('input[name^="time-slot-"]:checked')).map(el => el.value);
    
    if (!date || selectedTimeSlots.length === 0) {
        showNotification('Please select date and at least one time slot', 'warning');
        return;
    }
    
    const originalButtonText = availabilityForm.querySelector('button[type="submit"]').textContent;
    availabilityForm.querySelector('button[type="submit"]').textContent = 'Saving...';
    
    try {
        // Check if availability already exists for this date
        const availabilityRef = query(
            collection(db, 'availability'),
            where('teacherId', '==', currentUser.uid),
            where('date', '==', date)
        );
        const availabilityQuerySnapshot = await getDocs(availabilityRef);
        
        if (!availabilityQuerySnapshot.empty) {
            // Update existing availability
            await updateDoc(doc(db, 'availability', availabilityQuerySnapshot.docs[0].id), {
                timeSlot: selectedTimeSlots,
                updatedAt: serverTimestamp()
            });
        } else {
            // Create new availability
            await addDoc(collection(db, 'availability'), {
                teacherId: currentUser.uid,
                teacherName: userName.textContent,
                date: date,
                timeSlot: selectedTimeSlots,
                createdAt: serverTimestamp()
            });
        }
        
        showNotification('Availability saved successfully', 'success');
        availabilityForm.reset();
        
        // Uncheck all time slot checkboxes
        document.querySelectorAll('input[name^="time-slot-"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    } catch (error) {
        console.error('Error saving availability:', error);
        showNotification('Error saving availability: ' + error.message, 'error');
    } finally {
        availabilityForm.querySelector('button[type="submit"]').textContent = originalButtonText;
    }
});

// Load availability when teacher selects a date
availabilityDate.addEventListener('change', async () => {
    const selectedDate = availabilityDate.value;
    
    if (!selectedDate || !currentUser) return;
    
    try {
        // Get teacher's availability for the selected date
        const availabilityRef = query(
            collection(db, 'availability'),
            where('teacherId', '==', currentUser.uid),
            where('date', '==', selectedDate)
        );
        const availabilitySnapshot = await getDocs(availabilityRef);
        
        // Uncheck all time slots first
        document.querySelectorAll('input[name^="time-slot-"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        if (!availabilitySnapshot.empty) {
            const availabilityData = availabilitySnapshot.docs[0].data();
            const availableSlots = availabilityData.timeSlot || [];
            
            // Check time slots that are already set as available
            availableSlots.forEach(slot => {
                const checkbox = document.querySelector(`input[name^="time-slot-"][value="${slot}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    } catch (error) {
        console.error('Error loading availability:', error);
        showNotification('Error loading availability: ' + error.message, 'error');
    }
});

// Load teacher appointments
async function loadTeacherAppointments() {
    if (!currentUser) return;
    
    try {
        const appointmentsQuery = query(
            collection(db, 'appointments'),
            where('teacherId', '==', currentUser.uid),
            orderBy('date', 'desc')
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        
        // Clear previous appointments
        teacherAppointments.innerHTML = '';
        
        if (appointmentsSnapshot.empty) {
            teacherAppointments.innerHTML = '<p class="empty-state">No appointments scheduled yet.</p>';
            return;
        }
        
        // Add appointments to the list
        appointmentsSnapshot.forEach(doc => {
            const appointmentData = doc.data();
            const appointmentEl = createAppointmentElement(doc.id, appointmentData, 'teacher');
            teacherAppointments.appendChild(appointmentEl);
        });
    } catch (error) {
        console.error('Error loading teacher appointments:', error);
        showNotification('Error loading appointments: ' + error.message, 'error');
    }
}

// Create appointment element
function createAppointmentElement(id, data, viewType) {
    const appointmentEl = document.createElement('div');
    appointmentEl.className = 'appointment-item';
    appointmentEl.dataset.id = id;
    
    const formattedDate = formatDate(data.date);
    
    const appointmentHeader = document.createElement('div');
    appointmentHeader.className = 'appointment-header';
    
    const appointmentTitle = document.createElement('div');
    appointmentTitle.className = 'appointment-title';
    
    if (viewType === 'student') {
        appointmentTitle.textContent = `Appointment with ${data.teacherName}`;
    } else {
        appointmentTitle.textContent = `Appointment with ${data.studentName}`;
    }
    
    const appointmentTime = document.createElement('div');
    appointmentTime.className = 'appointment-time';
    appointmentTime.textContent = `${formattedDate} at ${data.timeSlot}`;
    
    const appointmentActions = document.createElement('div');
    appointmentActions.className = 'appointment-actions';
    
    // Status badge
    const statusBadge = document.createElement('span');
    statusBadge.className = `badge ${data.status}`;
    statusBadge.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
    
    // Cancel button
    if (data.status === 'scheduled') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-danger btn-sm';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => cancelAppointment(id));
        appointmentActions.appendChild(cancelBtn);
    }
    
    // Complete button (only for teachers)
    if (viewType === 'teacher' && data.status === 'scheduled') {
        const completeBtn = document.createElement('button');
        completeBtn.className = 'btn btn-success btn-sm';
        completeBtn.textContent = 'Mark Complete';
        completeBtn.addEventListener('click', () => completeAppointment(id));
        appointmentActions.appendChild(completeBtn);
    }
    
    const appointmentDetails = document.createElement('div');
    appointmentDetails.className = 'appointment-details';
    
    // Reason section
    const reasonHeading = document.createElement('h4');
    reasonHeading.textContent = 'Reason:';
    
    const reasonText = document.createElement('p');
    reasonText.textContent = data.reason;
    
    appointmentHeader.appendChild(appointmentTitle);
    appointmentHeader.appendChild(appointmentActions);
    
    appointmentDetails.appendChild(statusBadge);
    appointmentDetails.appendChild(document.createElement('br'));
    appointmentDetails.appendChild(appointmentTime);
    appointmentDetails.appendChild(reasonHeading);
    appointmentDetails.appendChild(reasonText);
    
    appointmentEl.appendChild(appointmentHeader);
    appointmentEl.appendChild(appointmentDetails);
    
    return appointmentEl;
}

// Cancel appointment function
async function cancelAppointment(appointmentId) {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    
    try {
        await updateDoc(doc(db, 'appointments', appointmentId), {
            status: 'cancelled',
            updatedAt: serverTimestamp()
        });
        
        showNotification('Appointment cancelled successfully', 'success');
        
        // Reload appointments based on user role
        if (userRole === 'student') {
            loadStudentAppointments();
        } else {
            loadTeacherAppointments();
        }
    } catch (error) {
        console.error('Error cancelling appointment:', error);
        showNotification('Error cancelling appointment: ' + error.message, 'error');
    }
}

// Complete appointment function (for teachers)
async function completeAppointment(appointmentId) {
    if (!confirm('Mark this appointment as completed?')) return;
    
    try {
        await updateDoc(doc(db, 'appointments', appointmentId), {
            status: 'completed',
            updatedAt: serverTimestamp()
        });
        
        showNotification('Appointment marked as completed', 'success');
        loadTeacherAppointments();
    } catch (error) {
        console.error('Error completing appointment:', error);
        showNotification('Error completing appointment: ' + error.message, 'error');
    }
}

// Add CSS class for status badges
document.head.insertAdjacentHTML('beforeend', `
    <style>
        .badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 500;
            margin-bottom: 0.5rem;
        }
        .badge.scheduled {
            background-color: #3498db;
            color: white;
        }
        .badge.completed {
            background-color: #2ecc71;
            color: white;
        }
        .badge.cancelled {
            background-color: #e74c3c;
            color: white;
        }
        .btn-sm {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
        }
    </style>
`);
