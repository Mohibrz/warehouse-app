// الواجهة الأمامية - منطق التطبيق
// API_BASE_URL و getAuthHeaders و escapeHtml و extractApiError معرَّفة في js/api.js
document.addEventListener('DOMContentLoaded', function() {
    let userData = null;

    const elements = {
        loginModal: document.getElementById('login-modal'),
        appContainer: document.getElementById('app-container'),
        usernameField: document.getElementById('username'),
        passwordField: document.getElementById('password'),
        loginBtn: document.getElementById('login-btn'),
        loginForm: document.getElementById('login-form'),
        loginError: document.getElementById('login-error'),
        usernameDisplay: document.getElementById('current-username'),
        logoutBtn: document.getElementById('logout-btn'),
        navButtons: document.querySelectorAll('.nav-btn'),
        contentSections: document.querySelectorAll('.content-section'),

        // Notifications
        notificationsBtn: document.getElementById('notifications-btn'),
        notificationsModal: document.getElementById('notifications-modal'),
        notificationsBody: document.getElementById('notifications-body'),
        notificationCount: document.getElementById('notification-count'),
        markAllReadBtn: document.getElementById('mark-all-read'),
        dismissAllBtn: document.getElementById('dismiss-all'),
        closeNotificationsModal: document.getElementById('close-notifications-modal'),

        // Items
        itemsTableBody: document.getElementById('items-table-body'),
        itemForm: document.getElementById('item-form'),
        itemId: document.getElementById('item-id'),
        itemSku: document.getElementById('item-sku'),
        itemName: document.getElementById('item-name'),
        itemCategory: document.getElementById('item-category'),
        itemUnit: document.getElementById('item-unit'),
        itemMinStock: document.getElementById('item-min-stock'),
        itemPrice: document.getElementById('item-price'),
        itemWarehouse: document.getElementById('item-warehouse'),
        itemShelf: document.getElementById('item-shelf'),
        showAddItemBtn: document.getElementById('show-add-item-btn'),
        cancelItemBtn: document.getElementById('cancel-item-btn'),

        // Warehouses
        warehousesTableBody: document.getElementById('warehouses-table-body'),
        warehouseForm: document.getElementById('warehouse-form'),
        warehouseId: document.getElementById('warehouse-id'),
        warehouseName: document.getElementById('warehouse-name'),
        warehouseLocation: document.getElementById('warehouse-location'),
        showAddWarehouseBtn: document.getElementById('show-add-warehouse-btn'),

        // Shelves
        shelvesTableBody: document.getElementById('shelves-table-body'),
        shelfForm: document.getElementById('shelf-form'),
        shelfId: document.getElementById('shelf-id'),
        shelfName: document.getElementById('shelf-name'),
        shelfWarehouse: document.getElementById('shelf-warehouse'),
        showAddShelfBtn: document.getElementById('show-add-shelf-btn'),

        // Transactions
        transactionsTableBody: document.getElementById('transactions-table-body'),
        transactionForm: document.getElementById('transaction-form'),
        transactionItem: document.getElementById('transaction-item'),
        transactionWarehouse: document.getElementById('transaction-warehouse'),
        transactionType: document.getElementById('transaction-type'),
        transactionQuantity: document.getElementById('transaction-quantity'),
        transactionTargetWarehouse: document.getElementById('transaction-target-warehouse'),
        cancelTransactionBtn: document.getElementById('cancel-transaction-btn'),
        transactionNotes: document.getElementById('transaction-notes'),
        showAddTransactionBtn: document.getElementById('show-add-transaction-btn'),
        cancelTransactionBtn: document.getElementById('cancel-transaction-btn'),
        transferTargetRow: document.getElementById('transfer-target-row'),

        // Stock
        stockTableBody: document.getElementById('stock-table-body'),

        // Alerts
        alertsList: document.getElementById('alerts-list'),

        // Dashboard
        totalItems: document.getElementById('total-items'),
        totalStock: document.getElementById('total-stock'),
        lowStockCount: document.getElementById('low-stock-count'),
        totalTransactions: document.getElementById('total-transactions'),
        recentMovementsBody: document.getElementById('recent-movements-body')
    };

    let state = {
        items: [],
        warehouses: [],
        shelves: [],
        categories: [],
        transactions: [],
        stock: [],
        alerts: [],
        users: [],
        activityLogs: [],
        notifications: [],
        creditList: [],
        damagedList: []
    };

    // --- Utilities ---

    // --- User Preferences ---

    const DEFAULT_PREFERENCES = {
        refreshInterval: 30,
        defaultWarehouseId: null,
        notificationsEnabled: true,
        darkModeDefault: false,
        itemsPerPage: 50,
        showStockZero: true
    };

    function loadUserPreferences() {
        try {
            const saved = localStorage.getItem('warehouse_preferences');
            if (saved) {
                return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Error loading preferences:', e);
        }
        return DEFAULT_PREFERENCES;
    }

    function saveUserPreferences(preferences) {
        try {
            localStorage.setItem('warehouse_preferences', JSON.stringify(preferences));
            showMessage('تم حفظ الإعدادات بنجاح');
        } catch (e) {
            console.error('Error saving preferences:', e);
            showMessage('فشل في حفظ الإعدادات', 'error');
        }
    }

    function applyPreferences(preferences) {
        // Apply dark mode if set
        if (preferences.darkModeDefault || preferences.darkMode) {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('theme-toggle').textContent = '☀️';
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.getElementById('theme-toggle').textContent = '🌙';
        }

        // Apply auto-refresh
        if (window.notificationInterval) {
            clearInterval(window.notificationInterval);
            window.notificationInterval = null;
        }

        if (preferences.refreshInterval > 0 && preferences.notificationsEnabled) {
            window.notificationInterval = setInterval(async () => {
                if (userData && !document.hidden) {
                    await loadNotifications();
                }
            }, preferences.refreshInterval * 1000);
        }
    }

    function openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        const preferences = loadUserPreferences();

        // Fill form with current preferences
        document.getElementById('setting-refresh-interval').value = preferences.refreshInterval;
        document.getElementById('setting-notifications-enabled').checked = preferences.notificationsEnabled;
        document.getElementById('setting-dark-mode-default').checked = preferences.darkModeDefault;

        // Populate warehouses dropdown
        const warehouseSelect = document.getElementById('setting-default-warehouse');
        warehouseSelect.innerHTML = '<option value="">-- لا يوجد --</option>';
        state.warehouses.forEach(wh => {
            const opt = document.createElement('option');
            opt.value = wh.id;
            opt.textContent = wh.name;
            warehouseSelect.appendChild(opt);
        });
        warehouseSelect.value = preferences.defaultWarehouseId || '';

        modal.style.display = 'flex';
    }

    function closeSettingsModal() {
        document.getElementById('settings-modal').style.display = 'none';
    }

    function handleSaveSettings() {
        const preferences = {
            refreshInterval: parseInt(document.getElementById('setting-refresh-interval').value) || 30,
            defaultWarehouseId: parseInt(document.getElementById('setting-default-warehouse').value) || null,
            notificationsEnabled: document.getElementById('setting-notifications-enabled').checked,
            darkModeDefault: document.getElementById('setting-dark-mode-default').checked,
            itemsPerPage: 50,
            showStockZero: true
        };

        saveUserPreferences(preferences);
        applyPreferences(preferences);
        closeSettingsModal();
    }

    // Settings event listeners
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
        const preferences = loadUserPreferences();
        preferences.darkModeDefault = !preferences.darkModeDefault;
        saveUserPreferences(preferences);
        applyPreferences(preferences);
    });

    document.getElementById('close-settings-modal')?.addEventListener('click', closeSettingsModal);
    document.getElementById('cancel-settings-btn')?.addEventListener('click', closeSettingsModal);
    document.getElementById('save-settings-btn')?.addEventListener('click', handleSaveSettings);

    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') closeSettingsModal();
    });

    document.getElementById('settings-btn')?.addEventListener('click', () => {
        openSettingsModal();
    });

    // Apply saved preferences on load
    const initialPreferences = loadUserPreferences();
    applyPreferences(initialPreferences);

    function showMessage(message, type = 'success') {
        try {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;

            // أيقونات حسب النوع
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            const icon = icons[type] || 'ℹ';

            // Convert message to string safely
            if (message === null || message === undefined) {
                message = '';
            } else if (typeof message === 'object') {
                if (message instanceof Error) {
                    message = message.message || message.name || String(message);
                } else if (Array.isArray(message)) {
                    message = message.join(' ، ');
                } else if (message.detail) {
                    if (typeof message.detail === 'string') {
                        message = message.detail;
                    } else if (Array.isArray(message.detail)) {
                        message = message.detail.map(e => e.msg || e).join(' ، ');
                    } else {
                        message = JSON.stringify(message.detail);
                    }
                } else if (message.message) {
                    message = message.message;
                } else {
                    message = JSON.stringify(message);
                }
            } else {
                message = String(message);
            }

            // Ensure it's a string
            message = '' + message;

            // Set content with icon
            toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;

            // Add and auto-remove
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.animation = 'slideDown 0.3s ease';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, 4000);

            console.log('Toast shown:', type, message);
        } catch (e) {
            console.error('showMessage error:', e);
            alert('رسالة: ' + message);
        }
    }

    function formatArabicNumber(num) {
        if (typeof num === 'undefined' || num === null) return '0';
        return Number(num).toLocaleString('ar-SA');
    }

    // تهريب النصوص قبل إدراجها في HTML - يمنع كسر الجدول أو حقن سكربتات
    // عبر أسماء أصناف/مستودعات تحتوي على < > & " ' (التطبيق في js/api.js)
    const esc = escapeHtml;

    function formatCurrency(amount) {
        if (typeof amount === 'undefined' || amount === null) return '0.00';
        return new Intl.NumberFormat('ar-IQ', {
            style: 'currency', currency: 'IQD'
        }).format(amount);
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleString('ar-SA');
    }

    function getStatusClass(status) {
        return {
            'نفاد': 'status-empty',
            'منخفض': 'status-low',
            'متوفر': 'status-ok'
        }[status] || '';
    }

    function getTransactionTypeArabic(type) {
        return {
            'in': 'دخول', 'out': 'خروج',
            'transfer': 'نقل', 'adjustment': 'تعديل'
        }[type] || type;
    }

    function getRoleArabic(role) {
        const roles = {
            'admin': 'مدير',
            'staff': 'موظف',
            'viewer': 'مشاهد'
        };
        return roles[role] || role;
    }

    function getNotificationTypeIcon(type) {
        const icons = {
            'low_stock': '⚠️',
            'system': '🔔',
            'info': 'ℹ️'
        };
        return icons[type] || '🔔';
    }

    function formatRelativeTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);

        if (diff < 60) return 'الآن';
        if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
        if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
        if (diff < 604800) return `منذ ${Math.floor(diff / 86400)} يوم`;
        return date.toLocaleDateString('ar-IQ');
    }

    // --- Authentication ---

    async function checkAuth() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            showLogin();
            return false;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/api/users/me`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error();
            userData = await response.json();
            elements.usernameDisplay.textContent = userData.username;
            showMainApp();
            return true;
        } catch {
            localStorage.removeItem('auth_token');
            showLogin();
            return false;
        }
    }

    function showLogin() {
        elements.loginModal.style.display = 'flex';
        elements.appContainer.style.display = 'none';
        elements.usernameField.focus();
    }

    function showMainApp() {
        elements.loginModal.style.display = 'none';
        elements.appContainer.style.display = 'block';
    }

    async function loginUser(username, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username, password})
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل تسجيل الدخول'));
            }
            const data = await response.json();
            localStorage.setItem('auth_token', data.access_token);
            userData = data.user;
            elements.usernameDisplay.textContent = userData.username;
            showMainApp();
            showMessage('تم تسجيل الدخول بنجاح');
            await loadInitialData();
        } catch (error) {
            elements.loginError.textContent = (error && error.message) ? error.message : String(error);
        }
    }

    function logoutUser() {
        localStorage.removeItem('auth_token');
        userData = null;
        window.location.reload();
    }

    // --- Event Handlers ---

    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        elements.loginError.textContent = '';
        const username = elements.usernameField.value.trim();
        const password = elements.passwordField.value;
        if (!username || !password) {
            elements.loginError.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
            return;
        }
        elements.loginBtn.disabled = true;
        elements.loginBtn.textContent = 'جاري التسجيل...';
        await loginUser(username, password);
        elements.loginBtn.disabled = false;
        elements.loginBtn.textContent = 'تسجيل الدخول';
    });

    elements.logoutBtn.addEventListener('click', logoutUser);

// Password validation feedback
const pwField = document.getElementById('itemPassword');
const pwFeedback = document.getElementById('pw-feedback');

function validatePasswordStrength(password) {
    const rules = [
        { regex: /.{8,}/, msg: 'على الأقل 8 أحرف' },
        { regex: /[A-Z]/, msg: 'حرف كبير' },
        { regex: /[a-z]/, msg: 'حرف صغير' },
        { regex: /[0-9]/, msg: 'رقم' },
        { regex: /[!@#$%^&*(),.?\":{}|<>]/, msg: 'رمز خاص' }
    ];
    const passed = rules.filter((r, i) => r.regex.test(password)).length;
    return {
        passed,
        total: rules.length,
        messages: rules.map((r, i) => `${r.msg} ${i < passed ? '✓' : '✘'}`)
    };
}

if (pwField) {
    pwField.addEventListener('input', (e) => {
        const { passed, total, messages } = validatePasswordStrength(e.target.value);
        pwFeedback.innerHTML = `
            <small style="color: ${passed === total ? 'var(--success)' : 'var(--danger)'}">
                ${passed}/${total} قواعد متوفقة<br>
                ${messages.join(' • ')}
            </small>
        `;
    });
}

// Dark Mode Toggle
const themeToggle = document.getElementById('theme-toggle');
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
}
themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        themeToggle.textContent = '🌙';
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeToggle.textContent = '☀️';
        localStorage.setItem('theme', 'dark');
    }
});
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            themeToggle.textContent = '🌙';
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            themeToggle.textContent = '☀️';
            localStorage.setItem('theme', 'dark');
        }
    });

    // --- Notifications ---

    async function loadNotifications() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('فشل تحميل الإشعارات');
            const data = await response.json();
            state.notifications = data;
            renderNotifications();
            updateNotificationCount();
        } catch (error) {
            console.error('Error loading notifications:', error);
            showMessage('فشل تحميل الإشعارات', 'error');
        }
    }

    function renderNotifications() {
        const body = elements.notificationsBody;
        if (!body) return;

        if (state.notifications.length === 0) {
            body.innerHTML = `
                <div class="notifications-empty">
                    <div class="icon">ℹ</div>
                    <p style="margin: 0;">لا توجد إشعارات جديدة</p>
                </div>
            `;
            return;
        }

        let html = '';
        state.notifications.forEach(notif => {
            const icon = getNotificationTypeIcon(notif.type);
            const time = formatRelativeTime(notif.created_at);
            const isUnread = notif.is_read === 0;

            html += `
                <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${notif.id}">
                    <div class="notification-item-header">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span style="font-size: 1.2rem;">${icon}</span>
                            <span class="notification-item-title">${notif.title}</span>
                        </div>
                        <span class="notification-item-time">${time}</span>
                    </div>
                    <div class="notification-item-message">${notif.message}</div>
                    <div class="notification-item-actions">
                        <button class="mark-read" data-id="${notif.id}">تعويم</button>
                        <button class="dismiss" data-id="${notif.id}">إلغاء</button>
                    </div>
                </div>
            `;
        });

        body.innerHTML = html;

        // ربط الأحداث بالأزرار
        body.querySelectorAll('.mark-read').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                markNotificationRead(btn.dataset.id);
            });
        });

        body.querySelectorAll('.dismiss').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                markNotificationDismissed(btn.dataset.id);
            });
        });
    }

    function updateNotificationCount() {
        const unread = state.notifications.filter(n => n.is_read === 0).length;
        const badge = elements.notificationCount;

        if (badge) {
            badge.textContent = unread;
            badge.classList.toggle('hidden', unread === 0);
        }
    }

    async function markNotificationRead(notificationId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('فشل في تعويم الإشعار');

            const notif = state.notifications.find(n => n.id == notificationId);
            if (notif) {
                notif.is_read = 1;
                notif.read_at = new Date().toISOString();
            }

            renderNotifications();
            updateNotificationCount();
        } catch (error) {
            console.error('Error marking notification read:', error);
            showMessage('فشل في تعويم الإشعار', 'error');
        }
    }

    async function markNotificationDismissed(notificationId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/dismiss`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('فشل في إلغاء الإشعار');

            // إزالة الإشعار من القائمة المحلية
            state.notifications = state.notifications.filter(n => n.id != notificationId);

            renderNotifications();
            updateNotificationCount();
        } catch (error) {
            console.error('Error dismissing notification:', error);
            showMessage('فشل في إلغاء الإشعار', 'error');
        }
    }

    async function markAllNotificationsRead() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/mark-all-read`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('فشل في تعويم الكل');

            state.notifications.forEach(notif => {
                notif.is_read = 1;
                notif.read_at = new Date().toISOString();
            });

            renderNotifications();
            updateNotificationCount();
            showMessage('تم تعويم جميع الإشعارات');
        } catch (error) {
            console.error('Error marking all read:', error);
            showMessage('فشل في تعويم جميع الإشعارات', 'error');
        }
    }

    async function dismissAllNotifications() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/notifications/dismiss-all`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('فشل في إلغاء الكل');

            state.notifications = [];
            renderNotifications();
            updateNotificationCount();
            showMessage('تم إلغاء جميع الإشعارات');
        } catch (error) {
            console.error('Error dismissing all:', error);
            showMessage('فشل في إلغاء جميع الإشعارات', 'error');
        }
    }

    // --- Notification Event Listeners ---

    if (elements.notificationsBtn) {
        elements.notificationsBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (!userData) {
                showMessage('يجب تسجيل الدخول أولاً', 'error');
                return;
            }

            await loadNotifications();
            elements.notificationsModal.style.display = 'flex';
        });
    }

    if (elements.closeNotificationsModal) {
        elements.closeNotificationsModal.addEventListener('click', () => {
            elements.notificationsModal.style.display = 'none';
        });
    }

    if (elements.markAllReadBtn) {
        elements.markAllReadBtn.addEventListener('click', markAllNotificationsRead);
    }

    if (elements.dismissAllBtn) {
        elements.dismissAllBtn.addEventListener('click', dismissAllNotifications);
    }

    if (elements.notificationsModal) {
        elements.notificationsModal.addEventListener('click', (e) => {
            if (e.target === elements.notificationsModal) {
                elements.notificationsModal.style.display = 'none';
            }
        });
    }

    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const sectionId = btn.dataset.section;
            elements.contentSections.forEach(section => {
                section.style.display = section.id === sectionId ? 'block' : 'none';
            });
            const loaders = {
                items: loadItems,
                transactions: loadTransactions,
                stock: loadStock,
                alerts: loadAlerts,
                warehouses: loadWarehouses,
                shelves: loadShelves,
                dashboard: loadDashboard,
                users: loadUsers,
                activity: loadActivityLogs,
                reports: loadReports,
                barcodes: async () => { await loadItems(); renderBarcodesGrid(); },
                credit: loadCredits,
                damaged: loadDamaged
            };
            if (loaders[sectionId]) loaders[sectionId]();
        });
    });

    // Items form (using modal)
    elements.showAddItemBtn.addEventListener('click', () => {
        openItemModal(false);
    });
    const cancelItemBtn = document.getElementById('cancel-item-btn');
    if (cancelItemBtn) {
        cancelItemBtn.addEventListener('click', closeItemModal);
    }
    const closeItemModalBtn = document.getElementById('close-item-modal');
    if (closeItemModalBtn) {
        closeItemModalBtn.addEventListener('click', closeItemModal);
    }
    const generateSkuBtn = document.getElementById('generate-sku-btn');
    if (generateSkuBtn) {
        generateSkuBtn.addEventListener('click', generateSku);
    }
    elements.itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const itemName = elements.itemName.value.trim();
            if (!itemName) {
                showMessage('اسم الصنف مطلوب', 'error');
                return;
            }

            // التحقق من تكرار اسم المادة قبل الإرسال
            const normalizedName = itemName.toLowerCase().trim();
            const duplicateItem = state.items.find(item =>
                item.name && item.name.trim().toLowerCase() === normalizedName
            );
            if (duplicateItem && (!elements.itemId.value || parseInt(elements.itemId.value) !== duplicateItem.id)) {
                showMessage(`⚠️ الصنف "${itemName}" موجود مسبقاً في النظام (رقمه ${duplicateItem.id}). استخدم تعديل الصنف لتحديث بياناته.`, 'warning');
                return;
            }

            const id = elements.itemId.value;
            const categoryValue = elements.itemCategory.value;
            const shelfValue = elements.itemShelf.value;
            const data = {
                name: itemName,
                category_id: categoryValue ? parseInt(categoryValue) : null,
                unit: elements.itemUnit.value.trim() || 'وحدة',
                min_stock: parseFloat(elements.itemMinStock.value) || 0,
                price: parseFloat(elements.itemPrice.value) || 0,
                warehouse_id: parseInt(elements.itemWarehouse.value) || null,
                shelf_id: shelfValue ? parseInt(shelfValue) : null
            };

            // إضافة الكمية الابتدائية فقط عند إضافة صنف جديد (وليس تعديل)
            if (!id) {
                const initialQtyInput = document.getElementById('item-initial-quantity');
                const initialQty = parseFloat(initialQtyInput?.value) || 0;
                if (initialQty > 0) {
                    data.initial_quantity = initialQty;
                    const notesInput = document.getElementById('item-transaction-notes');
                    const notes = notesInput?.value?.trim();
                    if (notes) {
                        data.transaction_notes = notes;
                    }

                    // تنبيه المستخدم بأن حركة ستُنشأ
                    console.log(`سيتم إنشاء حركة دخول بـ ${initialQty} وحدة للصنف`);
                }
            }

            // إرسال SKU فقط إذا تم إدخاله يدوياً
            const sku = elements.itemSku.value.trim();
            if (sku) {
                data.sku = sku;
            }

            // التحقق من أن المستودع محدد إذا تم إدخال كمية ابتدائية
            if (!id && data.initial_quantity > 0 && !data.warehouse_id) {
                showMessage('يجب تحديد المستودع عند إدخال كمية ابتدائية', 'error');
                return;
            }

            const url = id ? `${API_BASE_URL}/api/items/${id}` : `${API_BASE_URL}/api/items`;
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                body: JSON.stringify(data)
            });
                if (!response.ok) {
                    throw new Error(await extractApiError(response, 'فشل الحفظ'));
                }
                
                // ✅ الحصول على بيانات الصنف المحفوظ (للاستخدام في رفع الصورة)
                const savedItem = await response.json();
                const savedItemId = savedItem.id;

                // رسالة نجاح مخصصة عند وجود كمية ابتدائية
                if (!id && data.initial_quantity > 0) {
                    showMessage(`تم إضافة الصنف مع رصيد افتتاحي ${data.initial_quantity} في المخزون`);
                } else {
                    showMessage(id ? 'تم تحديث الصنف' : 'تم إضافة الصنف بنجاح');
                }

                // ✅ معالجة رفع أو حذف الصورة
                const imageInput = document.getElementById('item-image-input');
                const existingImagePath = document.getElementById('item-existing-image-path')?.value;
                const currentImagePath = savedItem.image_path;

                if (imageInput && imageInput.files.length > 0) {
                    // رفع صورة جديدة
                    await uploadItemImageToBackend(savedItemId, imageInput.files[0]);
                } else if (!currentImagePath && existingImagePath) {
                    // المستخدم أزال الصورة (حقل الملف فارغ، لكن كان هناك مسار سابق)
                    await deleteItemImageFromBackend(savedItemId);
                }

                closeItemModal();
                await loadItems();
                await loadStock();
                await loadTransactions();
                await loadDashboard();
            // تحديث قوائم المستودعات في النماذج المنبثقة للذمة والتالف والمعاملات
            updateCreditSelects();
            updateDamagedSelects();
            // إذا كان نموذج المعاملة مفتوحًا، قوّي حدث التغيير على تحديث قائمة المستودعات
            const transactionModal = document.getElementById('transaction-modal');
            if (transactionModal && transactionModal.style.display === 'flex') {
                elements.transactionItem.dispatchEvent(new Event('change'));
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // إغلاق modal عند الضغط خارجه
    const itemModal = document.getElementById('item-modal');
    if (itemModal) {
        itemModal.addEventListener('click', (e) => {
            if (e.target === itemModal) closeItemModal();
        });
    }
    const barcodeModal = document.getElementById('barcode-modal');
    if (barcodeModal) {
        barcodeModal.addEventListener('click', (e) => {
            if (e.target === barcodeModal) closeBarcodeModal();
        });
    }

    // Barcode modal buttons
    const closeBarcodeModalBtn = document.getElementById('close-barcode-modal');
    if (closeBarcodeModalBtn) closeBarcodeModalBtn.addEventListener('click', closeBarcodeModal);
    const closeBarcodeBtn = document.getElementById('close-barcode-btn');
    if (closeBarcodeBtn) closeBarcodeBtn.addEventListener('click', closeBarcodeModal);
    const printBarcodeBtn = document.getElementById('print-barcode-btn');
    if (printBarcodeBtn) printBarcodeBtn.addEventListener('click', printBarcode);
    const downloadBarcodeBtn = document.getElementById('download-barcode-btn');
    if (downloadBarcodeBtn) downloadBarcodeBtn.addEventListener('click', downloadBarcode);

    // Tab switching
    const tabBarcode = document.getElementById('tab-barcode');
    if (tabBarcode) tabBarcode.addEventListener('click', () => switchCodeTab('barcode'));
    const tabQrcode = document.getElementById('tab-qrcode');
    if (tabQrcode) tabQrcode.addEventListener('click', () => switchCodeTab('qrcode'));

    // تعديل editItem و deleteItem لاستخدام modal + barcode
    window.openBarcodeModal = openBarcodeModal;

    // Warehouses form (using modal)
    elements.showAddWarehouseBtn.addEventListener('click', () => {
        openWarehouseModal(false);
    });
    const cancelWarehouseBtn = document.getElementById('cancel-warehouse-btn');
    if (cancelWarehouseBtn) {
        cancelWarehouseBtn.addEventListener('click', closeWarehouseModal);
    }
    const closeWarehouseModalBtn = document.getElementById('close-warehouse-modal');
    if (closeWarehouseModalBtn) {
        closeWarehouseModalBtn.addEventListener('click', closeWarehouseModal);
    }

    // إغلاق modal عند الضغط خارجه
    const warehouseModal = document.getElementById('warehouse-modal');
    if (warehouseModal) {
        warehouseModal.addEventListener('click', (e) => {
            if (e.target === warehouseModal) closeWarehouseModal();
        });
    }

    elements.warehouseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const id = elements.warehouseId.value;
            const data = {
                name: elements.warehouseName.value.trim(),
                location: elements.warehouseLocation.value.trim() || null
            };
            const url = id ? `${API_BASE_URL}/api/warehouses/${id}` : `${API_BASE_URL}/api/warehouses`;
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل الحفظ'));
            }
            showMessage(id ? 'تم تحديث المستودع' : 'تم إضافة المستودع');
            closeWarehouseModal();
            await loadWarehouses();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // Shelves form (using modal)
    elements.showAddShelfBtn.addEventListener('click', () => {
        openShelfModal(false);
    });
    const cancelShelfBtn = document.getElementById('cancel-shelf-btn');
    if (cancelShelfBtn) {
        cancelShelfBtn.addEventListener('click', closeShelfModal);
    }
    const closeShelfModalBtn = document.getElementById('close-shelf-modal');
    if (closeShelfModalBtn) {
        closeShelfModalBtn.addEventListener('click', closeShelfModal);
    }

    // إغلاق modal عند الضغط خارجه
    const shelfModal = document.getElementById('shelf-modal');
    if (shelfModal) {
        shelfModal.addEventListener('click', (e) => {
            if (e.target === shelfModal) closeShelfModal();
        });
    }

    elements.shelfForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const id = elements.shelfId.value;
            const data = {
                name: elements.shelfName.value.trim(),
                warehouse_id: parseInt(elements.shelfWarehouse.value)
            };
            const url = id ? `${API_BASE_URL}/api/shelves/${id}` : `${API_BASE_URL}/api/shelves`;
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل الحفظ'));
            }
            showMessage(id ? 'تم تحديث الرف' : 'تم إضافة الرف');
            closeShelfModal();
            await loadShelves();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // Category modal handlers
    const showAddCategoryBtn = document.getElementById('show-add-category-btn');
    if (showAddCategoryBtn) {
        showAddCategoryBtn.addEventListener('click', () => openCategoryModal(false));
    }
    const cancelCategoryBtn = document.getElementById('cancel-category-btn');
    if (cancelCategoryBtn) {
        cancelCategoryBtn.addEventListener('click', () => {
            closeCategoryModal();
            resetCategoryForm();
        });
    }
    const closeCategoryModalBtn = document.getElementById('close-category-modal');
    if (closeCategoryModalBtn) {
        closeCategoryModalBtn.addEventListener('click', () => {
            closeCategoryModal();
            resetCategoryForm();
        });
    }
    const categoryModal = document.getElementById('category-modal');
    if (categoryModal) {
        categoryModal.addEventListener('click', (e) => {
            if (e.target === categoryModal) {
                closeCategoryModal();
                resetCategoryForm();
            }
        });
    }
    const categoryForm = document.getElementById('category-form');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const id = document.getElementById('category-id').value;
                const data = {
                    name: document.getElementById('category-name').value.trim(),
                    description: document.getElementById('category-description').value.trim() || null
                };
                const url = id ? `${API_BASE_URL}/api/categories/${id}` : `${API_BASE_URL}/api/categories`;
                const method = id ? 'PUT' : 'POST';
                const response = await fetch(url, {
                    method,
                    headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                    body: JSON.stringify(data)
                });
                if (!response.ok) {
                    throw new Error(await extractApiError(response, 'فشل الحفظ'));
                }
                showMessage(id ? 'تم تحديث الفئة' : 'تم إضافة الفئة بنجاح');
                closeCategoryModal();
                resetCategoryForm();
                await loadCategories();
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    // Category table actions (event delegation)
    const categoriesTbody = document.getElementById('categories-table-body');
    if (categoriesTbody) {
        categoriesTbody.addEventListener('click', async (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id);
            if (action === 'edit-category') {
                const cat = state.categories.find(c => c.id === id);
                if (cat) openCategoryModal(true, cat);
            } else if (action === 'delete-category') {
                if (!confirm('هل أنت متأكد من حذف هذه الفئة؟')) return;
                try {
                    const response = await fetch(`${API_BASE_URL}/api/categories/${id}`, {
                        method: 'DELETE',
                        headers: getAuthHeaders()
                    });
                    if (!response.ok) {
                        throw new Error(await extractApiError(response, 'فشل الحذف'));
                    }
                    showMessage('تم حذف الفئة بنجاح');
                    await loadCategories();
                } catch (error) {
                    showMessage(error.message, 'error');
                }
            }
        });
    }

    // Transaction type change
    elements.transactionType.addEventListener('change', function() {
        elements.transferTargetRow.style.display = this.value === 'transfer' ? 'block' : 'none';
    });

    // Item search button - opens modal with searchable items list
    const transactionItemSearchBtn = document.getElementById('transaction-item-search-btn');
    if (transactionItemSearchBtn) {
        transactionItemSearchBtn.addEventListener('click', function() {
            openItemSearchModal();
        });
    }

    function openItemSearchModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById('transaction-item-search-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'transaction-item-search-modal';
            modal.className = 'modal-overlay';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-container" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 id="item-search-modal-title">🔍 البحث عن الصنف</h3>
                        <button class="modal-close-btn" id="close-item-search-modal">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <input type="text" id="modal-item-search-input" placeholder="🔍 ابحث عن الصنف بالاسم أو الرمز..." style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; font-size: 0.95rem;">
                        </div>
                        <div id="modal-item-search-results" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                            <table class="data-table" style="width: 100%;">
                                <thead>
                                    <tr>
                                        <th>الاسم</th>
                                        <th>الرمز</th>
                                        <th>الفئة</th>
                                    </tr>
                                </thead>
                                <tbody id="modal-item-search-tbody">
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Close on click outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeItemSearchModal();
            });

            // Close button
            document.getElementById('close-item-search-modal').addEventListener('click', closeItemSearchModal);

            // Search input
            document.getElementById('modal-item-search-input').addEventListener('input', function() {
                performItemSearch(this.value);
            });

            // Double-click or click on result to select
            document.getElementById('modal-item-search-tbody').addEventListener('click', function(e) {
                const row = e.target.closest('tr');
                if (row && row.dataset.itemId) {
                    selectItemFromSearch(parseInt(row.dataset.itemId));
                }
            });

            // Double-click to select
            document.getElementById('modal-item-search-tbody').addEventListener('dblclick', function(e) {
                const row = e.target.closest('tr');
                if (row && row.dataset.itemId) {
                    selectItemFromSearch(parseInt(row.dataset.itemId));
                }
            });
        } else {
            modal.style.display = 'flex';
        }

        // Load all items and show
        performItemSearch('');
    }

    function closeItemSearchModal() {
        const modal = document.getElementById('transaction-item-search-modal');
        if (modal) modal.style.display = 'none';
    }

    function performItemSearch(searchTerm) {
        const tbody = document.getElementById('modal-item-search-tbody');
        if (!tbody) return;
        const term = (searchTerm || '').toLowerCase().trim();

        const filtered = state.items.filter(item =>
            !term ||
            item.name.toLowerCase().includes(term) ||
            (item.sku || '').toLowerCase().includes(term) ||
            (item.category_name || '').toLowerCase().includes(term)
        );

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 1rem; color: #6c757d;">لا توجد نتائج</td></tr>';
            return;
        }

        const catMap = Object.fromEntries(state.categories.map(c => [c.id, c]));
        tbody.innerHTML = filtered.map(item => {
            const cat = item.category_id ? (catMap[item.category_id]?.name || '-') : '-';
            return `
                <tr data-item-id="${item.id}" style="cursor: pointer;" onmouseover="this.style.backgroundColor='var(--bg-hover)'" onmouseout="this.style.backgroundColor=''">
                    <td>${esc(item.name)}</td>
                    <td>${esc(item.sku)}</td>
                    <td>${esc(cat)}</td>
                </tr>
            `;
        }).join('');
    }

    function selectItemFromSearch(itemId) {
        const itemSelect = elements.transactionItem;
        if (itemSelect) {
            itemSelect.value = itemId;
            // Trigger change to update warehouses based on movement type
            if (elements.transactionType) {
                const txType = elements.transactionType.value;
                filterWarehousesForItem(itemId, txType);
            }
        }
        closeItemSearchModal();
    }

    // Keep original item search input filter (filters the dropdown as you type)
    const transactionItemSearch = document.getElementById('transaction-item-search');
    if (transactionItemSearch) {
        transactionItemSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            const itemSelect = elements.transactionItem;
            const currentValue = itemSelect.value;

            itemSelect.innerHTML = '<option value="">اختر الصنف</option>';
            state.items.forEach(item => {
                const match = !searchTerm ||
                    item.name.toLowerCase().includes(searchTerm) ||
                    (item.sku || '').toLowerCase().includes(searchTerm);
                if (match) {
                    const opt = document.createElement('option');
                    opt.value = item.id;
                    opt.textContent = `${item.name} (${item.sku})`;
                    itemSelect.appendChild(opt);
                }
            });
            itemSelect.value = currentValue;
        });
    }

    // Transaction type change - update warehouse display based on movement type
    elements.transactionType.addEventListener('change', function() {
        elements.transferTargetRow.style.display = this.value === 'transfer' ? 'block' : 'none';
        // If an item is already selected, re-filter warehouses based on new movement type
        if (elements.transactionItem && elements.transactionItem.value) {
            const selectedItemId = parseInt(elements.transactionItem.value) || 0;
            filterWarehousesForItem(selectedItemId, this.value);
        }
    });

    // Function to filter warehouses based on item and movement type
    function filterWarehousesForItem(selectedItemId, txType) {
        const isEntry = txType === 'in';
        const isTransfer = txType === 'transfer';

        // Filter source warehouse
        const warehouseSelect = elements.transactionWarehouse;
        if (warehouseSelect) {
            const currentWhValue = warehouseSelect.value;
            warehouseSelect.innerHTML = '<option value="">اختر المستودع</option>';
            state.warehouses.forEach(wh => {
                // For entry movements, show ALL warehouses
                if (isEntry) {
                    const opt = document.createElement('option');
                    opt.value = wh.id;
                    opt.textContent = wh.name;
                    warehouseSelect.appendChild(opt);
                    return;
                }
                // For transfer source, show all warehouses too
                if (isTransfer) {
                    const opt = document.createElement('option');
                    opt.value = wh.id;
                    opt.textContent = wh.name;
                    warehouseSelect.appendChild(opt);
                    return;
                }
                // For exit and others, only show warehouses with stock
                const stock = state.stock.find(s => s.item_id == selectedItemId && s.warehouse_id == wh.id);
                if (!stock || stock.quantity <= 0) return;
                const opt = document.createElement('option');
                opt.value = wh.id;
                opt.textContent = `${wh.name} (${formatArabicNumber(stock.quantity)})`;
                opt.style.color = 'var(--success-color)';
                warehouseSelect.appendChild(opt);
            });
            warehouseSelect.value = currentWhValue;
        }

        // Filter target warehouse (for transfer) - show ALL warehouses except selected source
        const targetWarehouseSelect = elements.transactionTargetWarehouse;
        if (targetWarehouseSelect) {
            const currentTargetValue = targetWarehouseSelect.value;
            targetWarehouseSelect.innerHTML = '<option value="">اختر مستودع الهدف</option>';
            const sourceWarehouseId = parseInt(elements.transactionWarehouse.value) || 0;
            state.warehouses.forEach(wh => {
                // For transfer, show all warehouses except source
                if (isTransfer && wh.id !== sourceWarehouseId) {
                    const opt = document.createElement('option');
                    opt.value = wh.id;
                    opt.textContent = wh.name;
                    targetWarehouseSelect.appendChild(opt);
                    return;
                }
                // For non-transfer, only show warehouses with stock
                const stock = state.stock.find(s => s.item_id == selectedItemId && s.warehouse_id == wh.id);
                if (!stock || stock.quantity <= 0) return;
                const opt = document.createElement('option');
                opt.value = wh.id;
                opt.textContent = `${wh.name} (${formatArabicNumber(stock.quantity)})`;
                opt.style.color = 'var(--success-color)';
                targetWarehouseSelect.appendChild(opt);
            });
            targetWarehouseSelect.value = currentTargetValue;
        }
    }

    // Source warehouse change - re-filter target warehouse for transfers
    if (elements.transactionWarehouse) {
        elements.transactionWarehouse.addEventListener('change', function() {
            if (elements.transactionType && elements.transactionType.value === 'transfer') {
                const selectedItemId = parseInt(elements.transactionItem.value) || 0;
                filterWarehousesForItem(selectedItemId, 'transfer');
            }
        });
    }

    // Item change event to filter warehouses
    if (elements.transactionItem) {
        elements.transactionItem.addEventListener('change', function() {
            const selectedItemId = parseInt(this.value) || 0;
            const txType = elements.transactionType ? elements.transactionType.value : 'in';
            filterWarehousesForItem(selectedItemId, txType);
        });
    }

    // Transaction modal
    elements.showAddTransactionBtn.addEventListener('click', () => {
        openTransactionModal(false);
    });

    const cancelTransactionBtn = document.getElementById('cancel-transaction-btn');
    if (cancelTransactionBtn) {
        cancelTransactionBtn.addEventListener('click', closeTransactionModal);
    }
    const closeTransactionModalBtn = document.getElementById('close-transaction-modal');
    if (closeTransactionModalBtn) {
        closeTransactionModalBtn.addEventListener('click', closeTransactionModal);
    }

    // إغلاق modal عند الضغط خارجه
    const transactionModal = document.getElementById('transaction-modal');
    if (transactionModal) {
        transactionModal.addEventListener('click', (e) => {
            if (e.target === transactionModal) closeTransactionModal();
        });
    }

    elements.transactionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const editId = document.getElementById('transaction-edit-id')?.value;
            const data = {
                type: elements.transactionType.value,
                quantity: parseFloat(elements.transactionQuantity.value),
                item_id: parseInt(elements.transactionItem.value),
                warehouse_id: parseInt(elements.transactionWarehouse.value),
                notes: elements.transactionNotes.value.trim() || null
            };
            if (data.type === 'transfer') {
                data.target_warehouse_id = parseInt(elements.transactionTargetWarehouse.value);
            }
            const url = editId ? `${API_BASE_URL}/api/transactions/${editId}` : `${API_BASE_URL}/api/transactions`;
            const method = editId ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل الحفظ'));
            }
            showMessage(editId ? 'تم تعديل الحركة بنجاح' : 'تم تسجيل الحركة بنجاح');
            closeTransactionModal();
            await loadTransactions();
            await loadStock();
            await loadDashboard();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    });

    // Search inputs
    const itemSearch = document.getElementById('item-search');
    const transactionSearch = document.getElementById('transaction-search');
    const stockSearch = document.getElementById('stock-search');

    if (itemSearch) {
        itemSearch.addEventListener('input', () => renderItemsTable());
    }
    if (transactionSearch) {
        transactionSearch.addEventListener('input', () => renderTransactionsTable());
    }
    if (stockSearch) {
        stockSearch.addEventListener('input', () => renderStockTable());
    }
    const warehouseSearch = document.getElementById('warehouse-search');
    if (warehouseSearch) {
        warehouseSearch.addEventListener('input', () => renderWarehousesTable());
    }

    // --- Export ---
    const exportItemsExcel = document.getElementById('export-items-excel');
    if (exportItemsExcel) exportItemsExcel.addEventListener('click', () => exportToExcel('items'));
    const exportStockExcel = document.getElementById('export-stock-excel');
    if (exportStockExcel) exportStockExcel.addEventListener('click', () => exportToExcel('stock'));
    const exportTransactionsExcel = document.getElementById('export-transactions-excel');
    if (exportTransactionsExcel) exportTransactionsExcel.addEventListener('click', () => exportToExcel('transactions'));
    const exportCreditExcel = document.getElementById('export-credit-excel');
    if (exportCreditExcel) exportCreditExcel.addEventListener('click', () => exportToExcel('credit'));
    const exportDamagedExcel = document.getElementById('export-damaged-excel');
    if (exportDamagedExcel) exportDamagedExcel.addEventListener('click', () => exportToExcel('damaged'));
    const printItemsBtn = document.getElementById('print-items-btn');
    if (printItemsBtn) printItemsBtn.addEventListener('click', () => printTable('items'));
    const printStockBtn = document.getElementById('print-stock-btn');
    if (printStockBtn) printStockBtn.addEventListener('click', () => printTable('stock'));
    const printTransactionsBtn = document.getElementById('print-transactions-btn');
    if (printTransactionsBtn) printTransactionsBtn.addEventListener('click', () => printTable('transactions'));
    const printCreditBtn = document.getElementById('print-credit-btn');
    if (printCreditBtn) printCreditBtn.addEventListener('click', () => printTable('credit'));
    const printDamagedBtn = document.getElementById('print-damaged-btn');
    if (printDamagedBtn) printDamagedBtn.addEventListener('click', () => printTable('damaged'));

    // Barcode print
    const selectAllBarcodes = document.getElementById('select-all-barcodes');
    if (selectAllBarcodes) selectAllBarcodes.addEventListener('click', () => {
        document.querySelectorAll('.barcode-checkbox').forEach(cb => cb.checked = true);
    });
    const deselectAllBarcodes = document.getElementById('deselect-all-barcodes');
    if (deselectAllBarcodes) deselectAllBarcodes.addEventListener('click', () => {
        document.querySelectorAll('.barcode-checkbox').forEach(cb => cb.checked = false);
    });
    const printSelectedBarcodes = document.getElementById('print-selected-barcodes');
    if (printSelectedBarcodes) printSelectedBarcodes.addEventListener('click', printSelectedBarcodesFn);
    const closeBarcodePrintModal = document.getElementById('close-barcode-print-modal');
    if (closeBarcodePrintModal) closeBarcodePrintModal.addEventListener('click', () => {
        document.getElementById('barcode-print-modal').style.display = 'none';
    });
    const cancelPrintBarcodes = document.getElementById('cancel-print-barcodes');
    if (cancelPrintBarcodes) cancelPrintBarcodes.addEventListener('click', () => {
        document.getElementById('barcode-print-modal').style.display = 'none';
    });
    const doPrintBarcodes = document.getElementById('do-print-barcodes');
    if (doPrintBarcodes) doPrintBarcodes.addEventListener('click', printBarcodeSheet);
    const barcodeSearch = document.getElementById('barcode-search');
    if (barcodeSearch) barcodeSearch.addEventListener('input', renderBarcodesGrid);

    // Backup
    const createBackupBtn = document.getElementById('create-backup-btn');
    if (createBackupBtn) createBackupBtn.addEventListener('click', createBackupFn);

    // --- Users ---
    const showAddUserBtn = document.getElementById('show-add-user-btn');
    if (showAddUserBtn) {
        showAddUserBtn.addEventListener('click', () => openUserModal(false));
    }
    const cancelUserBtn = document.getElementById('cancel-user-btn');
    if (cancelUserBtn) cancelUserBtn.addEventListener('click', closeUserModal);
    const closeUserModalBtn = document.getElementById('close-user-modal');
    if (closeUserModalBtn) closeUserModalBtn.addEventListener('click', closeUserModal);
    const userModal = document.getElementById('user-modal');
    if (userModal) {
        userModal.addEventListener('click', (e) => {
            if (e.target === userModal) closeUserModal();
        });
    }
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('User form submitted');
            try {
                const id = document.getElementById('user-id').value;
                const data = {
                    username: document.getElementById('user-username').value.trim(),
                    role: document.getElementById('user-role').value
                };
                const password = document.getElementById('user-password').value;
                if (password) data.password = password;
                console.log('User data:', data);

                if (!id && !password) {
                    throw new Error('كلمة المرور مطلوبة للمستخدمين الجدد');
                }
                const url = id ? `${API_BASE_URL}/api/users/${id}` : `${API_BASE_URL}/api/users`;
                const method = id ? 'PUT' : 'POST';
                console.log('Sending request to:', url, 'method:', method);

                const response = await fetch(url, {
                    method,
                    headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                    body: JSON.stringify(data)
                });
                console.log('Response status:', response.status);

                if (!response.ok) {
                    throw new Error(await extractApiError(response, 'فشل الحفظ'));
                }

                const result = await response.json();
                console.log('Success response:', result);

                showMessage(id ? 'تم تحديث المستخدم' : 'تم إضافة المستخدم بنجاح');
                closeUserModal();
                await loadUsers();
            } catch (error) {
                console.error('User form error:', error);
                const msg = (error && error.message) ? error.message : String(error);
                showMessage(msg, 'error');
            }
        });
    }

    // --- Data Loading ---

    // --- Reports Functions ---

    let currentReport = 'inventory-value';

    async function loadReports() {
        // Show reports nav button for admin
        if (userData && userData.role === 'admin') {
            document.getElementById('reports-nav-btn').style.display = 'inline-block';
        }

        // Setup report tabs
        document.querySelectorAll('.report-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentReport = tab.dataset.report;
                fetchReport(currentReport);
            });
        });

        // Load first report
        fetchReport(currentReport);
    }

    async function fetchReport(reportType) {
        const reportData = document.getElementById('report-data');
        const reportFilters = document.getElementById('report-filters');

        reportData.innerHTML = '<div class="report-loading">جاري تحميل البيانات...</div>';

        try {
            let url = `${API_BASE_URL}/api/reports/${reportType}`;

            // Add filters based on report type
            if (reportType === 'top-moving' || reportType === 'daily-movements' || reportType === 'user-activity') {
                const days = document.getElementById('report-days')?.value || '30';
                url += `?days=${days}`;
            }

            const response = await fetch(url, { headers: getAuthHeaders() });
            if (!response.ok) throw new Error('فشل تحميل التقرير');

            const data = await response.json();
            renderReport(reportType, data);
        } catch (error) {
            console.error('Report error:', error);
            reportData.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--danger-color);">فشل تحميل التقرير: ${error.message}</div>`;
        }
    }

    function renderReport(reportType, data) {
        const reportData = document.getElementById('report-data');
        let html = '';

        switch (reportType) {
            case 'inventory-value':
                html = renderInventoryValueReport(data);
                break;
            case 'top-moving':
                html = renderTopMovingReport(data);
                break;
            case 'warehouse-utilization':
                html = renderWarehouseUtilizationReport(data);
                break;
            case 'category-summary':
                html = renderCategorySummaryReport(data);
                break;
            case 'daily-movements':
                html = renderDailyMovementsReport(data);
                break;
            case 'user-activity':
                html = renderUserActivityReport(data);
                break;
            default:
                html = '<p>تقرير غير معروف</p>';
        }

        reportData.innerHTML = html;
    }

    function renderInventoryValueReport(data) {
        return `
            <div class="report-summary">
                <div class="report-summary-card">
                    <div class="label">إجمالي قيمة المخزون</div>
                    <div class="value currency">${formatCurrency(data.total_value)}</div>
                </div>
                <div class="report-summary-card">
                    <div class="label">عدد الأصناف</div>
                    <div class="value">${data.items.length}</div>
                </div>
            </div>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>الصنف</th>
                        <th>الرمز</th>
                        <th>الفئة</th>
                        <th>المستودع</th>
                        <th>الكمية</th>
                        <th>السعر</th>
                        <th>القيمة الإجمالية</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                        <tr>
                            <td>${esc(item.item_name)}</td>
                            <td>${esc(item.sku)}</td>
                            <td>${esc(item.category_name) || '-'}</td>
                            <td>${esc(item.warehouse_name)}</td>
                            <td>${formatArabicNumber(item.quantity)} ${esc(item.unit)}</td>
                            <td>${formatCurrency(item.price)}</td>
                            <td>${formatCurrency(item.total_value)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderTopMovingReport(data) {
        return `
            <div class="report-summary">
                <div class="report-summary-card">
                    <div class="label">عدد الأصناف الأكثر حركة</div>
                    <div class="value">${data.items.length}</div>
                </div>
                <div class="report-summary-card">
                    <div class="label">فترة التقرير</div>
                    <div class="value">${data.period_days} يوم</div>
                </div>
            </div>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>الصنف</th>
                        <th>الرمز</th>
                        <th>الدخول</th>
                        <th>الخروج</th>
                        <th>النقل</th>
                        <th>عدد الحركات</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                        <tr>
                            <td>${esc(item.item_name)}</td>
                            <td>${esc(item.sku)}</td>
                            <td style="color:var(--success-color);">+${formatArabicNumber(item.total_in)}</td>
                            <td style="color:var(--danger-color);">-${formatArabicNumber(item.total_out)}</td>
                            <td style="color:var(--secondary-color);">${formatArabicNumber(item.total_transfers)}</td>
                            <td>${item.transaction_count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderWarehouseUtilizationReport(data) {
        const totalItems = data.warehouses.reduce((sum, w) => sum + w.item_count, 0);
        const totalQty = data.warehouses.reduce((sum, w) => sum + w.total_quantity, 0);

        return `
            <div class="report-summary">
                <div class="report-summary-card">
                    <div class="label">إجمالي المستودعات</div>
                    <div class="value">${data.warehouses.length}</div>
                </div>
                <div class="report-summary-card">
                    <div class="label">إجمالي الأصناف</div>
                    <div class="value">${totalItems}</div>
                </div>
                <div class="report-summary-card">
                    <div class="label">إجمالي الكمية</div>
                    <div class="value">${formatArabicNumber(totalQty)}</div>
                </div>
            </div>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>المستودع</th>
                        <th>الموقع</th>
                        <th>عدد الأصناف</th>
                        <th>الكمية الإجمالية</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.warehouses.map(wh => `
                        <tr>
                            <td>${esc(wh.warehouse_name)}</td>
                            <td>${esc(wh.location) || '-'}</td>
                            <td>${wh.item_count}</td>
                            <td>${formatArabicNumber(wh.total_quantity)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderCategorySummaryReport(data) {
        return `
            <div class="report-summary">
                <div class="report-summary-card">
                    <div class="label">إجمالي قيمة المخزون</div>
                    <div class="value currency">${formatCurrency(data.total_value)}</div>
                </div>
                <div class="report-summary-card">
                    <div class="label">عدد الفئات</div>
                    <div class="value">${data.categories.length}</div>
                </div>
            </div>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>الفئة</th>
                        <th>عدد الأصناف</th>
                        <th>الكمية الإجمالية</th>
                        <th>القيمة الإجمالية</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.categories.map(cat => `
                        <tr>
                            <td>${esc(cat.category)}</td>
                            <td>${cat.item_count}</td>
                            <td>${formatArabicNumber(cat.total_quantity)}</td>
                            <td>${formatCurrency(cat.total_value)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderDailyMovementsReport(data) {
        return `
            <div class="report-summary">
                <div class="report-summary-card">
                    <div class="label">فترة التقرير</div>
                    <div class="value">${data.period_days} يوم</div>
                </div>
            </div>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>الدخول</th>
                        <th>الخروج</th>
                        <th>النقل</th>
                        <th>التعديل</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.daily_data.map(day => `
                        <tr>
                            <td>${day.date}</td>
                            <td style="color:var(--success-color);">${day.in_count} (${formatArabicNumber(day.in_quantity)})</td>
                            <td style="color:var(--danger-color);">${day.out_count} (${formatArabicNumber(day.out_quantity)})</td>
                            <td style="color:var(--secondary-color);">${day.transfer_count} (${formatArabicNumber(day.transfer_quantity)})</td>
                            <td>${day.adjustment_count} (${formatArabicNumber(day.adjustment_quantity)})</td>
                            <td><strong>${day.total_count}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderUserActivityReport(data) {
        return `
            <div class="report-summary">
                <div class="report-summary-card">
                    <div class="label">فترة التقرير</div>
                    <div class="value">${data.period_days} يوم</div>
                </div>
                <div class="report-summary-card">
                    <div class="label">المستخدمون النشطون</div>
                    <div class="value">${data.users.length}</div>
                </div>
            </div>
            <table class="report-table">
                <thead>
                    <tr>
                        <th>المستخدم</th>
                        <th>الإضافات</th>
                        <th>التعديلات</th>
                        <th>الحذف</th>
                        <th>الحركات</th>
                        <th>الإجمالي</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.users.map(user => `
                        <tr>
                            <td><strong>${esc(user.username)}</strong></td>
                            <td style="color:var(--success-color);">${user.creates}</td>
                            <td style="color:var(--secondary-color);">${user.updates}</td>
                            <td style="color:var(--danger-color);">${user.deletes}</td>
                            <td>${user.transactions}</td>
                            <td><strong>${user.total_actions}</strong></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async function loadInitialData() {
        try {
            await Promise.all([loadWarehouses(), loadCategories(), loadItems(), loadTransactions(), loadStock(), loadDashboard()]);
            if (userData && userData.role === 'admin') {
                document.getElementById('users-nav-btn').style.display = 'inline-block';
                document.getElementById('activity-nav-btn').style.display = 'inline-block';
                document.getElementById('backup-nav-btn').style.display = 'inline-block';
                document.getElementById('health-nav-btn').style.display = 'inline-block';
                document.getElementById('reports-nav-btn').style.display = 'inline-block';
                await loadUsers();
                await loadActivityLogs();
            }
        } catch (error) {
            console.error('Initial data load error:', error);
        }
    }

    async function loadWarehouses() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/warehouses`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل المستودعات');
            state.warehouses = await response.json();
            renderWarehousesTable();
            updateWarehouseSelects();
        } catch (error) {
            console.error(error);
            state.warehouses = [];
        }
    }

    async function loadCategories() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/categories`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل الفئات');
            state.categories = await response.json();
            renderCategoriesTable();
            updateCategorySelects();
        } catch (error) {
            console.error(error);
            state.categories = [];
        }
    }

    async function loadShelves() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/shelves`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل الأرفف');
            state.shelves = await response.json();
            renderShelvesTable();
            updateShelfWarehouseSelects();
        } catch (error) {
            console.error(error);
            state.shelves = [];
        }
    }

    function updateCategorySelects() {
        const select = document.getElementById('item-category');
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">اختر الفئة</option>';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
        select.value = currentValue;
    }

    function renderCategoriesTable() {
        const tbody = document.getElementById('categories-table-body');
        if (!tbody) return;
        if (state.categories.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">لا توجد فئات. ابدأ بإضافة فئة جديدة.</td></tr>';
            return;
        }
        tbody.innerHTML = '';

        state.categories.forEach(cat => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cat.id}</td>
                <td>${escapeHtml(cat.name)}</td>
                <td>${escapeHtml(cat.description || '-')}</td>
                <td>${cat.items_count || 0}</td>
                <td>${cat.created_at ? new Date(cat.created_at).toLocaleDateString('ar-EG') : '-'}</td>
                <td>
                    <button class="btn-edit" data-action="edit-category" data-id="${cat.id}" title="تعديل">✏️</button>
                    <button class="btn-delete" data-action="delete-category" data-id="${cat.id}" title="حذف">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function openCategoryModal(isEdit = false, cat = null) {
        const modal = document.getElementById('category-modal');
        const title = document.getElementById('category-modal-title');
        title.textContent = isEdit ? '✏️ تعديل فئة' : '➕ إضافة فئة جديدة';
        document.getElementById('category-id').value = cat ? cat.id : '';
        document.getElementById('category-name').value = cat ? cat.name : '';
        document.getElementById('category-description').value = cat ? (cat.description || '') : '';
        modal.style.display = 'flex';
    }

    function closeCategoryModal() {
        document.getElementById('category-modal').style.display = 'none';
    }

    function resetCategoryForm() {
        document.getElementById('category-id').value = '';
        document.getElementById('category-form').reset();
    }

    async function loadItems() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/items`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل الأصناف');
            state.items = await response.json();
            renderItemsTable();
            updateItemSelect();
        } catch (error) {
            console.error(error);
            state.items = [];
        }
    }

    async function loadTransactions() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل الحركات');
            state.transactions = await response.json();
            renderTransactionsTable();
        } catch (error) {
            console.error(error);
            state.transactions = [];
        }
    }

    async function loadStock() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/stock`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل المخزون');
            state.stock = await response.json();
            renderStockTable();
        } catch (error) {
            console.error(error);
            state.stock = [];
        }
    }

    async function loadAlerts() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/alerts/low-stock`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل التنبيهات');
            state.alerts = await response.json();
            renderAlertsList();
        } catch (error) {
            console.error(error);
            state.alerts = [];
        }
    }

    async function loadUsers() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/users`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل المستخدمين');
            state.users = await response.json();
            renderUsersTable();
        } catch (error) {
            console.error(error);
            state.users = [];
        }
    }

    async function loadActivityLogs() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/activity-logs`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل سجل النشاطات');
            state.activityLogs = await response.json();
            renderActivityLogsTable();
        } catch (error) {
            console.error(error);
            state.activityLogs = [];
        }
    }

    // --- Credit Transactions ---

    async function loadCredits() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions?type=credit`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل سجلات الذمة');
            state.creditList = await response.json();
            renderCreditsTable();
        } catch (error) {
            console.error(error);
            state.creditList = [];
        }
    }

    function renderCreditsTable() {
        const tbody = document.getElementById('credit-table-body');
        if (!tbody) return;

        // Update summary
        const count = state.creditList.length;
        const totalQty = state.creditList.reduce((sum, tx) => sum + parseFloat(tx.quantity || 0), 0);
        const countEl = document.getElementById('credit-count');
        const qtyEl = document.getElementById('credit-quantity');
        if (countEl) countEl.textContent = formatArabicNumber(count);
        if (qtyEl) qtyEl.textContent = formatArabicNumber(totalQty.toFixed(2));

        const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
        const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
        const searchTerm = (document.getElementById('credit-search')?.value || '').toLowerCase();

        const filtered = state.creditList.filter(tx => {
            const item = itemsMap[tx.item_id];
            const wh = whMap[tx.warehouse_id];
            return !searchTerm ||
                (item && item.name.toLowerCase().includes(searchTerm)) ||
                (tx.notes || '').toLowerCase().includes(searchTerm) ||
                (wh && wh.name.toLowerCase().includes(searchTerm));
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">لا توجد سجلات ذمة</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        filtered.forEach(tx => {
            const item = itemsMap[tx.item_id];
            const wh = whMap[tx.warehouse_id];
            // استخراج الجهة/الطرف من الملاحظات أو حقل مخصص
            const party = tx.party || tx.notes?.split('|')[1]?.trim() || '-';
            const notes = tx.notes?.split('|')[0]?.trim() || tx.notes || '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateTime(tx.date)}</td>
                <td>${item ? esc(item.name) : esc(tx.item_id)}</td>
                <td>${wh ? esc(wh.name) : esc(tx.warehouse_id)}</td>
                <td style="color: var(--secondary-color); font-weight: bold;">${formatArabicNumber(tx.quantity)}</td>
                <td>${esc(party)}</td>
                <td>${esc(notes)}</td>
                <td>
                    <button class="btn-action-delete btn-action" data-action="delete-credit" data-id="${tx.id}" title="حذف">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Damaged Transactions ---

    async function loadDamaged() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions?type=damaged`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error('فشل تحميل سجلات التلف');
            state.damagedList = await response.json();
            renderDamagedTable();
        } catch (error) {
            console.error(error);
            state.damagedList = [];
        }
    }

    function renderDamagedTable() {
        const tbody = document.getElementById('damaged-table-body');
        if (!tbody) return;

        // Update summary
        const count = state.damagedList.length;
        const totalQty = state.damagedList.reduce((sum, tx) => sum + parseFloat(tx.quantity || 0), 0);
        const countEl = document.getElementById('damaged-count');
        const qtyEl = document.getElementById('damaged-quantity');
        if (countEl) countEl.textContent = formatArabicNumber(count);
        if (qtyEl) qtyEl.textContent = formatArabicNumber(totalQty.toFixed(2));

        const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
        const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
        const searchTerm = (document.getElementById('damaged-search')?.value || '').toLowerCase();

        const filtered = state.damagedList.filter(tx => {
            const item = itemsMap[tx.item_id];
            const wh = whMap[tx.warehouse_id];
            return !searchTerm ||
                (item && item.name.toLowerCase().includes(searchTerm)) ||
                (tx.notes || '').toLowerCase().includes(searchTerm) ||
                (wh && wh.name.toLowerCase().includes(searchTerm));
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">لا توجد سجلات تلف</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        filtered.forEach(tx => {
            const item = itemsMap[tx.item_id];
            const wh = whMap[tx.warehouse_id];
            // استخراج السبب من الملاحظات
            const reason = tx.reason || tx.notes?.split('|')[0]?.trim() || '-';
            const notes = tx.notes?.split('|')[1]?.trim() || '-';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${formatDateTime(tx.date)}</td>
                <td>${item ? esc(item.name) : esc(tx.item_id)}</td>
                <td>${wh ? esc(wh.name) : esc(tx.warehouse_id)}</td>
                <td style="color: var(--danger-color); font-weight: bold;">${formatArabicNumber(tx.quantity)}</td>
                <td>${esc(reason)}</td>
                <td>${esc(notes)}</td>
                <td>
                    <button class="btn-action-delete btn-action" data-action="delete-damaged" data-id="${tx.id}" title="حذف">🗑️</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderActivityLogsTable() {
        const tbody = document.getElementById('activity-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (state.activityLogs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#6c757d;">لا توجد سجلات</td></tr>';
            return;
        }
        state.activityLogs.forEach(log => {
            const tr = document.createElement('tr');
            const actionIcon = log.action === 'create' ? '➕' : log.action === 'update' ? '✏️' : log.action === 'delete' ? '🗑️' : '📝';
            const entityIcon = log.entity_type === 'item' ? '📦' : log.entity_type === 'warehouse' ? '🏭' : log.entity_type === 'user' ? '👤' : log.entity_type === 'transaction' ? '🔄' : '📋';
            tr.innerHTML = `
                <td>${new Date(log.timestamp).toLocaleString('ar-SA')}</td>
                <td>${esc(log.username) || 'نظام'}</td>
                <td>${actionIcon} ${esc(log.action)}</td>
                <td>${entityIcon} ${esc(log.entity_type)}</td>
                <td>${esc(log.description) || '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    async function loadDashboard() {
        try {
            const [items, stock, transactions, alerts] = await Promise.all([
                fetch(`${API_BASE_URL}/api/items`, {headers: getAuthHeaders()}).then(r => r.json()),
                fetch(`${API_BASE_URL}/api/stock`, {headers: getAuthHeaders()}).then(r => r.json()),
                fetch(`${API_BASE_URL}/api/transactions`, {headers: getAuthHeaders()}).then(r => r.json()),
                fetch(`${API_BASE_URL}/api/alerts/low-stock`, {headers: getAuthHeaders()}).then(r => r.json())
            ]);

            // Load notifications
            await loadNotifications();

            // Auto-refresh notifications every 30 seconds
            if (!window.notificationInterval) {
                window.notificationInterval = setInterval(async () => {
                    if (userData && !document.hidden) {
                        await loadNotifications();
                    }
                }, 30000);
            }

            elements.totalItems.textContent = formatArabicNumber(items.length);
            const totalStock = stock.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
            elements.totalStock.textContent = formatArabicNumber(totalStock.toFixed(2));
            elements.lowStockCount.textContent = formatArabicNumber(alerts.length);
            elements.totalTransactions.textContent = formatArabicNumber(transactions.length);
            // رسم بياني
            renderCharts(transactions, stock);
            // Recent transactions
            const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
            elements.recentMovementsBody.innerHTML = '';
            const itemsMap = Object.fromEntries(items.map(i => [i.id, i]));
            const warehousesMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
            recent.forEach(tx => {
                const tr = document.createElement('tr');
                const item = itemsMap[tx.item_id];
                const wh = warehousesMap[tx.warehouse_id];
                tr.innerHTML = `
                    <td>${formatDateTime(tx.date)}</td>
                    <td>${item ? esc(item.name) : esc(tx.item_id)}</td>
                    <td>${wh ? esc(wh.name) : esc(tx.warehouse_id)}</td>
                    <td>${getTransactionTypeArabic(tx.type)}</td>
                    <td>${formatArabicNumber(tx.quantity)}</td>
                `;
                elements.recentMovementsBody.appendChild(tr);
            });
        } catch (error) {
            console.error('Dashboard load error:', error);
        }
    }

    // --- Rendering ---

    // Chart instances
    let txChart, stockChart, dailyChart;

    function renderCharts(transactions, stock) {
        // Chart 1: Transactions by type
        const txCounts = {in: 0, out: 0, transfer: 0, adjustment: 0};
        transactions.forEach(tx => {
            if (txCounts.hasOwnProperty(tx.type)) txCounts[tx.type]++;
        });
        if (txChart) txChart.destroy();
        const ctx1 = document.getElementById('transactions-chart')?.getContext('2d');
        if (ctx1) {
            txChart = new Chart(ctx1, {
                type: 'doughnut',
                data: {
                    labels: ['دخول', 'خروج', 'نقل', 'تعديل'],
                    datasets: [{
                        data: [txCounts.in, txCounts.out, txCounts.transfer, txCounts.adjustment],
                        backgroundColor: ['#27ae60', '#e74c3c', '#3498db', '#f39c12']
                    }]
                },
                options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
            });
        }

        // Chart 2: Stock by warehouse
        const whTotals = {};
        stock.forEach(s => {
            const wh = state.warehouses.find(w => w.id == s.warehouse_id);
            const whName = wh ? wh.name : 'غير محدد';
            whTotals[whName] = (whTotals[whName] || 0) + s.quantity;
        });
        if (stockChart) stockChart.destroy();
        const ctx2 = document.getElementById('stock-chart')?.getContext('2d');
        if (ctx2) {
            stockChart = new Chart(ctx2, {
                type: 'bar',
                data: {
                    labels: Object.keys(whTotals),
                    datasets: [{
                        label: 'الكمية',
                        data: Object.values(whTotals),
                        backgroundColor: '#3498db'
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        // Chart 3: Daily transactions (last 7 days)
        const dailyData = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().split('T')[0];
            dailyData[key] = 0;
        }
        transactions.forEach(tx => {
            const key = tx.date.split('T')[0];
            if (dailyData.hasOwnProperty(key)) dailyData[key]++;
        });
        if (dailyChart) dailyChart.destroy();
        const ctx3 = document.getElementById('daily-chart')?.getContext('2d');
        if (ctx3) {
            dailyChart = new Chart(ctx3, {
                type: 'line',
                data: {
                    labels: Object.keys(dailyData).map(k => new Date(k).toLocaleDateString('ar-SA', {weekday: 'short'})),
                    datasets: [{
                        label: 'عدد الحركات',
                        data: Object.values(dailyData),
                        borderColor: '#9b59b6',
                        backgroundColor: 'rgba(155,89,182,0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }
    }

function renderItemsTable() {
    elements.itemsTableBody.innerHTML = '';
    const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
    const catMap = Object.fromEntries(state.categories.map(c => [c.id, c]));
    const searchTerm = (document.getElementById('item-search').value || '').toLowerCase();
    const filteredItems = state.items.filter(item =>
        !searchTerm ||
        item.name.toLowerCase().includes(searchTerm) ||
        (item.sku || '').toLowerCase().includes(searchTerm) ||
        (item.category_name || '').toLowerCase().includes(searchTerm)
    );
    filteredItems.forEach(item => {
        const tr = document.createElement('tr');
        const wh = item.warehouse_id ? whMap[item.warehouse_id] : null;
        const cat = item.category_id ? catMap[item.category_id] : null;
        
        // ✅ إضافة عمود الصورة
        const imageCell = item.image_path 
            ? `<td><img src="${item.image_path}" alt="${esc(item.name)}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid #ddd;" onclick="window.showFullImage ? window.showFullImage('${item.image_path}', '${esc(item.name)}') : null"></td>`
            : `<td><div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 1.2rem;">📷</div></td>`;

        tr.innerHTML = `
            ${imageCell}
            <td>${esc(item.sku)}</td>
            <td>${esc(item.name)}</td>
            <td>${cat ? esc(cat.name) : '-'}</td>
            <td>${esc(item.unit)}</td>
            <td>${formatArabicNumber(item.min_stock)}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${wh ? esc(wh.name) : '-'}</td>
            <td>
                <button class="btn-action-barcode btn-action" data-action="show-barcode" data-id="${item.id}" title="عرض الباركود">📷</button>
                <button class="btn-action-edit btn-action" data-action="edit-item" data-id="${item.id}" title="تعديل">✏️</button>
                <button class="btn-action-delete btn-action" data-action="delete-item" data-id="${item.id}" title="حذف">🗑️</button>
            </td>
        `;
        elements.itemsTableBody.appendChild(tr);
    });
}

    function renderWarehousesTable() {
        elements.warehousesTableBody.innerHTML = '';
        const searchTerm = (document.getElementById('warehouse-search').value || '').toLowerCase();
        const filteredWarehouses = state.warehouses.filter(wh =>
            !searchTerm ||
            wh.name.toLowerCase().includes(searchTerm) ||
            (wh.location || '').toLowerCase().includes(searchTerm)
        );
        filteredWarehouses.forEach(wh => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${esc(wh.name)}</td>
                <td>${esc(wh.location) || '-'}</td>
                <td>
                    <button class="btn-warning" data-action="edit-warehouse" data-id="${wh.id}" title="تعديل">✏️</button>
                    <button class="btn-danger" data-action="delete-warehouse" data-id="${wh.id}" title="حذف">🗑️</button>
                </td>
            `;
            elements.warehousesTableBody.appendChild(tr);
        });
    }

    function renderShelvesTable() {
        elements.shelvesTableBody.innerHTML = '';
        const searchTerm = (document.getElementById('shelf-search').value || '').toLowerCase();
        const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
        const filteredShelves = state.shelves.filter(shelf => {
            const wh = whMap[shelf.warehouse_id];
            const whName = wh ? wh.name.toLowerCase() : '';
            return !searchTerm ||
                shelf.name.toLowerCase().includes(searchTerm) ||
                whName.includes(searchTerm);
        });
        filteredShelves.forEach(shelf => {
            const tr = document.createElement('tr');
            const wh = whMap[shelf.warehouse_id];
            tr.innerHTML = `
                <td>${esc(shelf.name)}</td>
                <td>${wh ? esc(wh.name) : '-'}</td>
                <td>
                    <button class="btn-warning" data-action="edit-shelf" data-id="${shelf.id}" title="تعديل">✏️</button>
                    <button class="btn-danger" data-action="delete-shelf" data-id="${shelf.id}" title="حذف">🗑️</button>
                </td>
            `;
            elements.shelvesTableBody.appendChild(tr);
        });
    }

    function renderTransactionsTable() {
        elements.transactionsTableBody.innerHTML = '';
        const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
        const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
        const searchTerm = (document.getElementById('transaction-search').value || '').toLowerCase();
        const filteredTransactions = state.transactions.filter(tx => {
            const item = itemsMap[tx.item_id];
            const wh = whMap[tx.warehouse_id];
            return !searchTerm ||
                (item && item.name.toLowerCase().includes(searchTerm)) ||
                (tx.warehouse_id && wh && wh.name.toLowerCase().includes(searchTerm)) ||
                tx.type.toLowerCase().includes(searchTerm);
        });
        filteredTransactions.forEach(tx => {
            const tr = document.createElement('tr');
            const item = itemsMap[tx.item_id];
            const wh = whMap[tx.warehouse_id];
            const targetWh = tx.target_warehouse_id ? whMap[tx.target_warehouse_id] : null;
            // أزرار التعديل والحذف تظهر للمدراء فقط
            const actions = (userData && userData.role === 'admin')
                ? `<button class="btn-action-edit btn-action" data-action="edit-transaction" data-id="${tx.id}" title="تعديل">✏️</button>
                   <button class="btn-action-delete btn-action" data-action="delete-transaction" data-id="${tx.id}" title="حذف">🗑️</button>`
                : '-';
            const whLabel = wh ? esc(wh.name) : esc(tx.warehouse_id);
            tr.innerHTML = `
                <td>${formatDateTime(tx.date)}</td>
                <td>${item ? esc(item.name) : esc(tx.item_id)}</td>
                <td>${targetWh ? `${whLabel} ← ${esc(targetWh.name)}` : whLabel}</td>
                <td>${getTransactionTypeArabic(tx.type)}</td>
                <td>${formatArabicNumber(tx.quantity)}</td>
                <td>${esc(tx.notes) || '-'}</td>
                <td>${actions}</td>
            `;
            elements.transactionsTableBody.appendChild(tr);
        });
    }

    function renderStockTable() {
        elements.stockTableBody.innerHTML = '';
        const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
        const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
        const searchTerm = (document.getElementById('stock-search').value || '').toLowerCase();
        const filteredStock = state.stock.filter(s => {
            const item = itemsMap[s.item_id];
            const wh = whMap[s.warehouse_id];
            return !searchTerm ||
                (item && item.name.toLowerCase().includes(searchTerm)) ||
                (item && (item.sku || '').toLowerCase().includes(searchTerm)) ||
                (wh && wh.name.toLowerCase().includes(searchTerm));
        });
        filteredStock.forEach(s => {
            const item = itemsMap[s.item_id];
            const wh = whMap[s.warehouse_id];
            const minStock = item ? item.min_stock : 0;
            let status = 'متوفر';
            if (s.quantity <= 0) status = 'نفاد';
            else if (s.quantity <= minStock) status = 'منخفض';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item ? esc(item.name) : esc(s.item_id)}</td>
                <td>${item ? esc(item.sku) : '-'}</td>
                <td>${wh ? esc(wh.name) : esc(s.warehouse_id)}</td>
                <td>${formatArabicNumber(s.quantity)}</td>
                <td>${formatArabicNumber(minStock)}</td>
                <td><span class="status-badge ${getStatusClass(status)}">${status}</span></td>
            `;
            elements.stockTableBody.appendChild(tr);
        });
    }

    function renderAlertsList() {
        if (state.alerts.length === 0) {
            elements.alertsList.innerHTML = '<p style="text-align:center; padding:2rem; color: #6c757d;">لا توجد تنبيهات حالياً</p>';
            return;
        }
        const table = document.createElement('table');
        table.className = 'data-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>الصنف</th>
                    <th>رمز الصنف</th>
                    <th>المستودع</th>
                    <th>الكمية الحالية</th>
                    <th>الحد الأدنى</th>
                    <th>الحالة</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        state.alerts.forEach(alert => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${esc(alert.item_name)}</td>
                <td>${esc(alert.sku)}</td>
                <td>${esc(alert.warehouse_name)}</td>
                <td>${formatArabicNumber(alert.current_stock)}</td>
                <td>${formatArabicNumber(alert.min_stock)}</td>
                <td><span class="status-badge ${alert.status === 'نفاد' ? 'status-empty' : 'status-low'}">${esc(alert.status)}</span></td>
            `;
            tbody.appendChild(tr);
        });
        elements.alertsList.innerHTML = '';
        elements.alertsList.appendChild(table);
    }

    function renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '';
        state.users.forEach((user, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${esc(user.username)}</td>
                <td><span class="status-badge ${user.role === 'admin' ? 'status-low' : user.role === 'staff' ? 'status-ok' : 'status-medium'}">${getRoleArabic(user.role)}</span></td>
                <td>${user.created_at ? new Date(user.created_at).toLocaleDateString('ar-SA') : '-'}</td>
                <td>
                    <button class="btn-action-edit btn-action" data-action="edit-user" data-id="${user.id}" title="تعديل">✏️</button>
                    ${user.id !== userData?.id ? `<button class="btn-action-delete btn-action" data-action="delete-user" data-id="${user.id}" title="حذف">🗑️</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    function updateWarehouseSelects() {
        const selects = [elements.itemWarehouse, elements.transactionWarehouse, elements.transactionTargetWarehouse];
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">اختر المستودع</option>';
            state.warehouses.forEach(wh => {
                const opt = document.createElement('option');
                opt.value = wh.id;
                opt.textContent = wh.name;
                select.appendChild(opt);
            });
            select.value = currentValue;
            
            // إضافة حدث change لتحديث الأرفف عند تغيير المستودع في نموذج الأصناف
            if (select === elements.itemWarehouse) {
                select.onchange = updateShelfSelect;
            }
        });
        // تحديث قائمة الأرفف عند تغيير المستودع
        updateShelfSelect();
    }
    
    function updateShelfSelect() {
        const shelfSelect = elements.itemShelf;
        if (!shelfSelect) return;
        const warehouseId = elements.itemWarehouse.value;
        const currentShelfValue = shelfSelect.value;
        
        shelfSelect.innerHTML = '<option value="">اختر الرف (اختياري)</option>';
        
        if (warehouseId) {
            const filteredShelves = state.shelves.filter(s => s.warehouse_id == warehouseId);
            filteredShelves.forEach(shelf => {
                const opt = document.createElement('option');
                opt.value = shelf.id;
                opt.textContent = shelf.name;
                shelfSelect.appendChild(opt);
            });
        }
        
        shelfSelect.value = currentShelfValue;
    }

    function updateItemSelect() {
        const currentValue = elements.transactionItem.value;
        elements.transactionItem.innerHTML = '<option value="">اختر الصنف</option>';
        state.items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${item.name} (${item.sku})`;
            elements.transactionItem.appendChild(opt);
        });
        elements.transactionItem.value = currentValue;
    }

    // --- Actions ---

    document.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const id = target.dataset.id;
        if (action === 'edit-item') editItem(id);
        if (action === 'delete-item') deleteItem(id);
        if (action === 'show-barcode') {
            const item = state.items.find(i => i.id == id);
            if (item) openBarcodeModal(item.sku, item.name);
        }
        if (action === 'edit-warehouse') editWarehouse(id);
        if (action === 'delete-warehouse') deleteWarehouse(id);
        if (action === 'edit-shelf') editShelf(id);
        if (action === 'delete-shelf') deleteShelf(id);
        if (action === 'delete-transaction') deleteTransaction(id);
        if (action === 'edit-transaction') editTransaction(id);
        if (action === 'edit-user') {
            const user = state.users.find(u => u.id == id);
            openUserModal(true, user);
        }
        if (action === 'delete-user') deleteUser(id);
        if (action === 'delete-credit') deleteCredit(id);
        if (action === 'delete-damaged') deleteDamaged(id);
    });

async function editItem(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/items/${id}`, {headers: getAuthHeaders()});
        if (!response.ok) throw new Error(await extractApiError(response, 'تعذر تحميل الصنف'));
        const item = await response.json();
        elements.itemId.value = item.id;
        elements.itemSku.value = item.sku;
        elements.itemName.value = item.name;
        elements.itemCategory.value = item.category_id || '';
        elements.itemUnit.value = item.unit || 'وحدة';
        elements.itemMinStock.value = item.min_stock || 0;
        elements.itemPrice.value = item.price || 0;
        elements.itemWarehouse.value = item.warehouse_id || '';
        elements.itemShelf.value = item.shelf_id || '';
        
        // ✅ عرض الصورة الحالية إن وجدت
        const imagePreview = document.getElementById('item-image-preview');
        const previewImg = document.getElementById('item-preview-img');
        const existingImagePath = document.getElementById('item-existing-image-path');
        const imageInput = document.getElementById('item-image-input');
        
        if (item.image_path) {
            if (existingImagePath) existingImagePath.value = item.image_path;
            if (previewImg) {
                previewImg.src = item.image_path;
                if (imagePreview) imagePreview.style.display = 'block';
            }
        } else {
            if (existingImagePath) existingImagePath.value = '';
            if (imagePreview) imagePreview.style.display = 'none';
            if (previewImg) previewImg.src = '';
        }
        if (imageInput) imageInput.value = ''; // تفريغ حقل الملف
        
        openItemModal(true);
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

    async function deleteItem(id) {
        const confirmed = await showConfirmDialog(
            '⚠️ تأكيد الحذف',
            'هل أنت متأكد من حذف هذا الصنف؟\n\nسيتم حذف الصنف وجميع سجلات المخزون المرتبطة به. لا يمكن التراجع عن هذا الإجراء.',
            'حذف',
            'إلغاء'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/items/${id}`, {method: 'DELETE', headers: getAuthHeaders()});
            if (!response.ok) {
                const errorMsg = await extractApiError(response, 'فشل الحذف');
                // عرض تنبيه واضح إذا كان السبب وجود حركات
                if (errorMsg.includes('حركة') || errorMsg.includes('حركات')) {
                    showMessage('⚠️ لا يمكن الحذف\n\n' + errorMsg + '\n\nالحل: احذف الحركات المرتبطة بهذا الصنف أولاً من قسم "الحركات".', 'error');
                } else {
                    showMessage(errorMsg, 'error');
                }
                return;
            }
            showMessage('تم حذف الصنف بنجاح');
            await loadItems();
            await loadStock();
            await loadDashboard();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    async function deleteWarehouse(id) {
        const confirmed = await showConfirmDialog(
            '⚠️ تأكيد حذف المستودع',
            'هل أنت متأكد من حذف هذا المستودع؟\n\nسيتم حذف جميع الأصناف وحركات المخزون المرتبطة بهذا المستودع. لا يمكن التراجع عن هذا الإجراء.',
            'حذف',
            'إلغاء'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/warehouses/${id}`, {method: 'DELETE', headers: getAuthHeaders()});
            if (!response.ok) {
                const errorMsg = await extractApiError(response, 'فشل الحذف');
                // عرض تنبيه واضح إذا كان السبب وجود حركات
                if (errorMsg.includes('حركة') || errorMsg.includes('حركات')) {
                    showMessage('⚠️ لا يمكن الحذف\n\n' + errorMsg + '\n\nالحل: احذف الحركات المرتبطة بهذا المستودع أولاً من قسم "الحركات".', 'error');
                } else {
                    showMessage(errorMsg, 'error');
                }
                return;
            }
            showMessage('تم حذف المستودع بنجاح');
            await loadWarehouses();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    async function deleteTransaction(id) {
        const confirmed = await showConfirmDialog(
            '⚠️ تأكيد حذف الحركة',
            'هل أنت متأكد من حذف هذه الحركة؟\n\nسيتم عكس تأثيرها على المخزون (سيتم إعادة الكمية إلى الحالة السابقة). لا يمكن التراجع عن هذا الإجراء.',
            'حذف',
            'إلغاء'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل الحذف'));
            }
            showMessage('تم حذف الحركة وعكس تأثيرها على المخزون');
            await loadTransactions();
            await loadStock();
            await loadDashboard();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    async function deleteUser(id) {
        if (id == userData?.id) {
            showMessage('لا يمكنك حذف حسابك الخاص.', 'error');
            return;
        }

        const confirmed = await showConfirmDialog(
            '⚠️ تأكيد حذف المستخدم',
            'هل أنت متأكد من حذف هذا المستخدم؟\n\nسيتم حذف حساب المستخدم وجميع البيانات المرتبطة به.',
            'حذف',
            'إلغاء'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/users/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل الحذف'));
            }
            showMessage('تم حذف المستخدم');
            await loadUsers();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    async function deleteCredit(id) {
        const confirmed = await showConfirmDialog(
            '⚠️ تأكيد حذف سجل الذمة',
            'هل أنت متأكد من حذف هذا السجل؟\n\nسيتم حذف سجل الذمة نهائياً.',
            'حذف',
            'إلغاء'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل الحذف'));
            }
            showMessage('تم حذف سجل الذمة بنجاح');
            await loadCredits();
            await loadDashboard();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    async function deleteDamaged(id) {
        const confirmed = await showConfirmDialog(
            '⚠️ تأكيد حذف سجل التلف',
            'هل أنت متأكد من حذف هذا السجل؟\n\nسيتم حذف سجل التلف وإرجاع الكمية إلى المخزون.',
            'حذف',
            'إلغاء'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/transactions/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل الحذف'));
            }
            showMessage('تم حذف سجل التلف وإرجاع الكمية للمخزون');
            await loadDamaged();
            await loadStock();
            await loadDashboard();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    function showConfirmDialog(title, message, confirmText, cancelText) {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); z-index: 2000;
                display: flex; align-items: center; justify-content: center;
            `;

            const modal = document.createElement('div');
            modal.style.cssText = `
                background: var(--bg-card);
                padding: 2rem;
                border-radius: 12px;
                max-width: 500px;
                width: 90%;
                box-shadow: var(--shadow-md);
            `;

            modal.innerHTML = `
                <h3 style="margin-top: 0;">${title}</h3>
                <p style="line-height: 1.6; margin-bottom: 1.5rem;">${message}</p>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                    <button id="confirm-btn" style="
                        background: var(--danger-color);
                        color: white;
                        border: none;
                        padding: 0.5rem 1rem;
                        border-radius: 6px;
                        cursor: pointer;
                    ">${confirmText}</button>
                    <button id="cancel-btn" style="
                        background: transparent;
                        border: 1px solid var(--border-color);
                        padding: 0.5rem 1rem;
                        border-radius: 6px;
                        cursor: pointer;
                    ">${cancelText}</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const confirmBtn = modal.querySelector('#confirm-btn');
            const cancelBtn = modal.querySelector('#cancel-btn');

            const cleanup = () => {
                document.body.removeChild(overlay);
            };

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve(true);
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve(false);
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve(false);
                }
            });
        });
    }

    async function editWarehouse(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/warehouses/${id}`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error(await extractApiError(response, 'تعذر تحميل المستودع'));
            const wh = await response.json();
            elements.warehouseId.value = wh.id;
            elements.warehouseName.value = wh.name;
            elements.warehouseLocation.value = wh.location || '';
            openWarehouseModal(true);
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    async function editShelf(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/shelves/${id}`, {headers: getAuthHeaders()});
            if (!response.ok) throw new Error(await extractApiError(response, 'تعذر تحميل الرف'));
            const shelf = await response.json();
            elements.shelfId.value = shelf.id;
            elements.shelfName.value = shelf.name;
            elements.shelfWarehouse.value = shelf.warehouse_id || '';
            openShelfModal(true);
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    async function deleteShelf(id) {
        const confirmed = await showConfirmDialog(
            '⚠️ تأكيد الحذف',
            'هل أنت متأكد من حذف هذا الرف؟',
            'حذف',
            'إلغاء'
        );
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/shelves/${id}`, {method: 'DELETE', headers: getAuthHeaders()});
            if (!response.ok) {
                const errorMsg = await extractApiError(response, 'فشل الحذف');
                if (errorMsg.includes('حركة') || errorMsg.includes('حركات') || errorMsg.includes('صنف') || errorMsg.includes('أصناف')) {
                    showMessage('⚠️ لا يمكن الحذف\\n\\n' + errorMsg + '\\n\\nالحل: احذف الأصناف أو الحركات المرتبطة بهذا الرف أولاً.', 'error');
                } else {
                    showMessage(errorMsg, 'error');
                }
                return;
            }
            showMessage('تم حذف الرف بنجاح');
            await loadShelves();
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }

    // --- Form Reset ---

function resetItemForm() {
    elements.itemId.value = '';
    elements.itemForm.reset();
    elements.itemUnit.value = 'وحدة';
    
    // ✅ إعادة تعيين حقل الصورة والمعاينة
    const imagePreview = document.getElementById('item-image-preview');
    const previewImg = document.getElementById('item-preview-img');
    const imageInput = document.getElementById('item-image-input');
    const existingImagePath = document.getElementById('item-existing-image-path');
    
    if (imagePreview) imagePreview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (imageInput) imageInput.value = '';
    if (existingImagePath) existingImagePath.value = '';
}

    function resetWarehouseForm() {
        elements.warehouseId.value = '';
        elements.warehouseForm.reset();
    }

    function resetTransactionForm() {
        elements.transactionForm.reset();
        elements.transferTargetRow.style.display = 'none';
        const searchInput = document.getElementById('transaction-item-search');
        if (searchInput) searchInput.value = '';
    }

    // --- Item Modal Functions ---

    // --- Transaction Modal Functions ---

    function openTransactionModal(isEdit = false) {
        const modal = document.getElementById('transaction-modal');
        const title = document.getElementById('transaction-modal-title');
        title.textContent = isEdit ? '✏️ تعديل حركة' : '➕ تسجيل حركة جديدة';
        if (!isEdit) {
            resetTransactionForm();
            // إزالة معرّف التعديل فقط عند فتح نموذج جديد
            const editIdField = document.getElementById('transaction-edit-id');
            if (editIdField) editIdField.remove();
        }
        modal.style.display = 'flex';
    }

    function closeTransactionModal() {
        const modal = document.getElementById('transaction-modal');
        modal.style.display = 'none';
        resetTransactionForm();
        const editIdField = document.getElementById('transaction-edit-id');
        if (editIdField) editIdField.remove();
    }

    async function editTransaction(id) {
        const tx = state.transactions.find(t => t.id == id);
        if (!tx) return;
        // إضافة حقل مخفي للمعرف قبل التعبئة
        let editIdField = document.getElementById('transaction-edit-id');
        if (!editIdField) {
            editIdField = document.createElement('input');
            editIdField.type = 'hidden';
            editIdField.id = 'transaction-edit-id';
            document.getElementById('transaction-form').appendChild(editIdField);
        }
        editIdField.value = id;

        // تعبئة النموذج
        elements.transactionItem.value = tx.item_id;
        elements.transactionWarehouse.value = tx.warehouse_id;
        elements.transactionType.value = tx.type;
        elements.transactionQuantity.value = tx.quantity;
        elements.transactionNotes.value = tx.notes || '';
        if (tx.target_warehouse_id) {
            elements.transactionTargetWarehouse.value = tx.target_warehouse_id;
        }
        elements.transactionType.dispatchEvent(new Event('change'));

        openTransactionModal(true);
    }

    // --- Item Modal Functions ---

    function openItemModal(isEdit = false) {
        const modal = document.getElementById('item-modal');
        const title = document.getElementById('item-modal-title');
        title.textContent = isEdit ? '✏️ تعديل صنف' : '➕ إضافة صنف جديد';
        modal.style.display = 'flex';
        if (!isEdit) {
            resetItemForm();
        }
        // Ensure dropdowns are always up-to-date
        updateWarehouseSelects();
        updateCategorySelects();
        updateShelfSelect();
    }

    function closeItemModal() {
        const modal = document.getElementById('item-modal');
        modal.style.display = 'none';
        resetItemForm();
    }

    async function generateSku() {
        const skuInput = document.getElementById('item-sku');
        const category = document.getElementById('item-category').value.trim();
        try {
            const response = await fetch(`${API_BASE_URL}/api/items/generate-sku`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                body: JSON.stringify({category: category || null})
            });
            if (response.ok) {
                const data = await response.json();
                skuInput.value = data.sku;
                showMessage('تم توليد رمز SKU', 'success');
            }
        } catch (error) {
            showMessage('فشل توليد SKU', 'error');
        }
    }

    // --- Barcode Modal Functions ---

    let currentCodeType = 'barcode';

    // --- Warehouse Modal Functions ---

    function openWarehouseModal(isEdit = false) {
        const modal = document.getElementById('warehouse-modal');
        const title = document.getElementById('warehouse-modal-title');
        title.textContent = isEdit ? '✏️ تعديل مستودع' : '➕ إضافة مستودع جديد';
        modal.style.display = 'flex';
        if (!isEdit) {
            resetWarehouseForm();
        }
    }

    function closeWarehouseModal() {
        const modal = document.getElementById('warehouse-modal');
        modal.style.display = 'none';
        resetWarehouseForm();
    }

    // --- Shelf Modal Functions ---

    function openShelfModal(isEdit = false) {
        const modal = document.getElementById('shelf-modal');
        const title = document.getElementById('shelf-modal-title');
        title.textContent = isEdit ? '✏️ تعديل رف' : '➕ إضافة رف جديد';
        modal.style.display = 'flex';
        if (!isEdit) {
            resetShelfForm();
        } else {
            // سيتم ملء النموذج عند معالجة حدث النقر على زر التعديل
        }
    }

    function closeShelfModal() {
        const modal = document.getElementById('shelf-modal');
        modal.style.display = 'none';
        resetShelfForm();
    }

    function resetShelfForm() {
        elements.shelfId.value = '';
        elements.shelfName.value = '';
        elements.shelfWarehouse.value = '';
        updateShelfWarehouseSelects();
    }

    function updateShelfWarehouseSelects() {
        const select = elements.shelfWarehouse;
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">اختر المستودع</option>';
        state.warehouses.forEach(wh => {
            const option = document.createElement('option');
            option.value = wh.id;
            option.textContent = wh.name;
            select.appendChild(option);
        });
        if (currentValue) {
            select.value = currentValue;
        }
    }

    function openUserModal(isEdit = false, user = null) {
        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const passwordLabel = document.getElementById('password-required');
        title.textContent = isEdit ? '✏️ تعديل مستخدم' : '➕ إضافة مستخدم جديد';
        // في التعديل: كلمة المرور اختيارية. في الإضافة: مطلوبة.
        passwordLabel.style.display = 'inline';
        passwordLabel.textContent = isEdit ? '(اتركها فارغة لعدم التغيير)' : '*';
        if (user) {
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-password').value = '';
            document.getElementById('user-role').value = user.role;
        } else {
            document.getElementById('user-id').value = '';
            document.getElementById('user-username').value = '';
            document.getElementById('user-password').value = '';
            document.getElementById('user-role').value = 'staff';
        }
        modal.style.display = 'flex';
    }

    function closeUserModal() {
        const modal = document.getElementById('user-modal');
        modal.style.display = 'none';
        document.getElementById('user-form').reset();
        document.getElementById('user-id').value = '';
    }

    function openBarcodeModal(sku, itemName) {
        const modal = document.getElementById('barcode-modal');
        document.getElementById('barcode-item-name').textContent = itemName;
        document.getElementById('barcode-item-sku').textContent = sku;
        modal.style.display = 'flex';

        // Generate barcode (1D)
        const svg = document.getElementById('barcode-svg');
        try {
            JsBarcode(svg, sku, {
                format: 'CODE128',
                width: 2,
                height: 80,
                displayValue: true,
                fontSize: 14,
                margin: 10,
                background: '#ffffff'
            });
        } catch (e) {
            svg.innerHTML = '<text x="50%" y="50" text-anchor="middle" fill="red">خطأ في الباركود</text>';
        }

        // Generate QR Code (2D) باستخدام qrcodejs2
        const qrContainer = document.getElementById('qrcode-canvas');
        qrContainer.innerHTML = '';  // تنظيف المحتوى السابق

        // qrcodejs2 يستخدم API مختلف: new QRCode(element, options)
        try {
            const qr = new QRCode(qrContainer, {
                text: sku,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M  // Medium error correction
            });
            // QRCode يُنشئ img أو canvas داخلياً
        } catch (err) {
            qrContainer.innerHTML = '<p style="color:red;">خطأ في توليد QR Code</p>';
            console.error('QR Code error:', err);
        }

        // عرض تبويب الباركود افتراضياً
        switchCodeTab('barcode');
    }

    function switchCodeTab(tab) {
        currentCodeType = tab;
        const barcodeDisplay = document.getElementById('barcode-display');
        const qrcodeDisplay = document.getElementById('qrcode-display');
        const tabBarcode = document.getElementById('tab-barcode');
        const tabQrcode = document.getElementById('tab-qrcode');

        if (tab === 'barcode') {
            barcodeDisplay.style.display = 'inline-block';
            qrcodeDisplay.style.display = 'none';
            tabBarcode.classList.add('active');
            tabQrcode.classList.remove('active');
        } else {
            barcodeDisplay.style.display = 'none';
            qrcodeDisplay.style.display = 'inline-block';
            tabBarcode.classList.remove('active');
            tabQrcode.classList.add('active');
        }
    }

    function closeBarcodeModal() {
        document.getElementById('barcode-modal').style.display = 'none';
    }

    function printBarcode() {
        window.print();
    }

    function downloadBarcode() {
        const sku = document.getElementById('barcode-item-sku').textContent;
        const filename = `code-${sku}.png`;

        if (currentCodeType === 'barcode') {
            // تحميل الباركود
            const svg = document.getElementById('barcode-svg');
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                const pngUrl = canvas.toDataURL('image/png');
                triggerDownload(pngUrl, filename);
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        } else {
            // تحميل QR Code (qrcodejs2 تُنشئ canvas أو img)
            const qrCanvas = document.querySelector('#qrcode-canvas canvas');
            const qrImg = document.querySelector('#qrcode-canvas img');
            if (qrCanvas) {
                const pngUrl = qrCanvas.toDataURL('image/png');
                triggerDownload(pngUrl, filename);
            } else if (qrImg) {
                triggerDownload(qrImg.src, filename);
            }
        }
    }

    function triggerDownload(url, filename) {
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.click();
    }

    // ✅ دوال مساعدة لإدارة صور الأصناف
async function uploadItemImageToBackend(itemId, file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/items/${itemId}/image`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        if (!response.ok) {
            const err = await response.json();
            showMessage(err.detail || 'فشل رفع الصورة', 'error');
        } else {
            showMessage('تم رفع الصورة بنجاح', 'success');
        }
    } catch (error) {
        console.error('خطأ في رفع الصورة:', error);
        showMessage('حدث خطأ أثناء رفع الصورة', 'error');
    }
}

async function deleteItemImageFromBackend(itemId) {
    try {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/api/items/${itemId}/image`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            const err = await response.json();
            showMessage(err.detail || 'فشل حذف الصورة', 'error');
        }
    } catch (error) {
        console.error('خطأ في حذف الصورة:', error);
    }
}

// دالة لعرض الصورة بحجم كامل عند النقر عليها
window.showFullImage = function(src, name) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
    modal.innerHTML = `
        <div style="text-align:center; max-width: 90%;">
            <img src="${src}" alt="${name}" style="max-width:100%;max-height:80vh;border-radius:12px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
            <p style="color:white;margin-top:15px;font-size:1.2rem; font-weight: bold;">${name}</p>
            <p style="color:#ccc; font-size: 0.9rem;">انقر في أي مكان للإغلاق</p>
        </div>
    `;
    modal.onclick = () => modal.remove();
    document.body.appendChild(modal);
};
    // --- Init ---

    (async function init() {
        const auth = await checkAuth();
        if (auth) await loadInitialData();
    })();

    // --- Credit Event Handlers ---

    const showAddCreditBtn = document.getElementById('show-add-credit-btn');
    if (showAddCreditBtn) showAddCreditBtn.addEventListener('click', openCreditModal);

    const closeCreditModalBtn = document.getElementById('close-credit-modal');
    if (closeCreditModalBtn) closeCreditModalBtn.addEventListener('click', closeCreditModal);

    const cancelCreditBtn = document.getElementById('cancel-credit-btn');
    if (cancelCreditBtn) cancelCreditBtn.addEventListener('click', closeCreditModal);

    const creditModal = document.getElementById('credit-modal');
    if (creditModal) {
        creditModal.addEventListener('click', (e) => {
            if (e.target === creditModal) closeCreditModal();
        });
    }

    const creditForm = document.getElementById('credit-form');
    if (creditForm) {
        creditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const data = {
                    type: 'credit',
                    quantity: parseFloat(document.getElementById('credit-quantity-input').value),
                    item_id: parseInt(document.getElementById('credit-item').value),
                    warehouse_id: parseInt(document.getElementById('credit-warehouse').value),
                    notes: (document.getElementById('credit-party').value.trim() + '|' + document.getElementById('credit-notes').value.trim()).replace(/^\|/, '')
                };
                const response = await fetch(`${API_BASE_URL}/api/transactions`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(await extractApiError(response, 'فشل الحفظ'));
                showMessage('تم تسجيل الذمة بنجاح');
                closeCreditModal();
                await loadCredits();
                await loadStock();
                await loadDashboard();
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    function openCreditModal() {
        const modal = document.getElementById('credit-modal');
        const title = document.getElementById('credit-modal-title');
        title.textContent = '📋 تسجيل ذمة جديدة';
        document.getElementById('credit-id').value = '';
        document.getElementById('credit-form').reset();
        updateCreditSelects();
        modal.style.display = 'flex';
    }

    function closeCreditModal() {
        document.getElementById('credit-modal').style.display = 'none';
    }

    function updateCreditSelects() {
        const itemSelect = document.getElementById('credit-item');
        const whSelect = document.getElementById('credit-warehouse');
        if (!itemSelect || !whSelect) return;

        itemSelect.innerHTML = '<option value="">اختر الصنف</option>';
        state.items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${item.name} (${item.sku})`;
            itemSelect.appendChild(opt);
        });

        // Event: when item changes, filter warehouses
        itemSelect.addEventListener('change', function() {
            const selectedItemId = parseInt(this.value) || 0;
            whSelect.innerHTML = '<option value="">اختر المستودع</option>';
            state.warehouses.forEach(wh => {
                // Check if this warehouse has stock for this item
                const stock = state.stock.find(s => s.item_id == selectedItemId && s.warehouse_id == wh.id);
                if (!stock || stock.quantity <= 0) return; // فقط المستودعات التي يوجد بها الصنف
                const opt = document.createElement('option');
                opt.value = wh.id;
                opt.textContent = `${wh.name} (${formatArabicNumber(stock.quantity)})`;
                opt.style.color = 'var(--success-color)';
                whSelect.appendChild(opt);
            });
        });
    }

    // --- Damaged Event Handlers ---

    const showAddDamagedBtn = document.getElementById('show-add-damaged-btn');
    if (showAddDamagedBtn) showAddDamagedBtn.addEventListener('click', openDamagedModal);

    const closeDamagedModalBtn = document.getElementById('close-damaged-modal');
    if (closeDamagedModalBtn) closeDamagedModalBtn.addEventListener('click', closeDamagedModal);

    const cancelDamagedBtn = document.getElementById('cancel-damaged-btn');
    if (cancelDamagedBtn) cancelDamagedBtn.addEventListener('click', closeDamagedModal);

    const damagedModal = document.getElementById('damaged-modal');
    if (damagedModal) {
        damagedModal.addEventListener('click', (e) => {
            if (e.target === damagedModal) closeDamagedModal();
        });
    }

    // Show/hide other reason input
    const damagedReasonSelect = document.getElementById('damaged-reason');
    if (damagedReasonSelect) {
        damagedReasonSelect.addEventListener('change', function() {
            const otherRow = document.getElementById('damaged-other-reason-row');
            if (otherRow) {
                otherRow.style.display = this.value === 'أخرى' ? 'block' : 'none';
            }
        });
    }

    // Note: updateCreditSelects and updateDamagedSelects are called from openCreditModal/openDamagedModal

    const damagedForm = document.getElementById('damaged-form');
    if (damagedForm) {
        damagedForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const reasonSelect = document.getElementById('damaged-reason');
                let reason = reasonSelect.value;
                if (reason === 'أخرى') {
                    reason = document.getElementById('damaged-other-reason').value.trim() || 'أخرى';
                }
                const data = {
                    type: 'damaged',
                    quantity: parseFloat(document.getElementById('damaged-quantity-input').value),
                    item_id: parseInt(document.getElementById('damaged-item').value),
                    warehouse_id: parseInt(document.getElementById('damaged-warehouse').value),
                    notes: reason + '|' + document.getElementById('damaged-notes').value.trim()
                };
                const response = await fetch(`${API_BASE_URL}/api/transactions`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json', ...getAuthHeaders()},
                    body: JSON.stringify(data)
                });
                if (!response.ok) throw new Error(await extractApiError(response, 'فشل الحفظ'));
                showMessage('تم تسجيل التلف بنجاح');
                closeDamagedModal();
                await loadDamaged();
                await loadStock();
                await loadDashboard();
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    function openDamagedModal() {
        const modal = document.getElementById('damaged-modal');
        const title = document.getElementById('damaged-modal-title');
        title.textContent = '⚠️ تسجيل تلف جديد';
        document.getElementById('damaged-id').value = '';
        document.getElementById('damaged-form').reset();
        document.getElementById('damaged-other-reason-row').style.display = 'none';
        updateDamagedSelects();
        modal.style.display = 'flex';
    }

    function closeDamagedModal() {
        document.getElementById('damaged-modal').style.display = 'none';
    }

    function updateDamagedSelects() {
        const itemSelect = document.getElementById('damaged-item');
        const whSelect = document.getElementById('damaged-warehouse');
        if (!itemSelect || !whSelect) return;

        itemSelect.innerHTML = '<option value="">اختر الصنف</option>';
        state.items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${item.name} (${item.sku})`;
            itemSelect.appendChild(opt);
        });

        // Event: when item changes, filter warehouses
        itemSelect.addEventListener('change', function() {
            const selectedItemId = parseInt(this.value) || 0;
            whSelect.innerHTML = '<option value="">اختر المستودع</option>';
            state.warehouses.forEach(wh => {
                const stock = state.stock.find(s => s.item_id == selectedItemId && s.warehouse_id == wh.id);
                if (!stock || stock.quantity <= 0) return; // فقط المستودعات التي يوجد بها الصنف
                const opt = document.createElement('option');
                opt.value = wh.id;
                opt.textContent = `${wh.name} (${formatArabicNumber(stock.quantity)})`;
                opt.style.color = 'var(--success-color)';
                whSelect.appendChild(opt);
            });
        });
    }

    // Search inputs for credit and damaged
    const creditSearch = document.getElementById('credit-search');
    if (creditSearch) creditSearch.addEventListener('input', renderCreditsTable);

    const damagedSearch = document.getElementById('damaged-search');
    if (damagedSearch) damagedSearch.addEventListener('input', renderDamagedTable);

    // --- Export Functions ---

    function exportToExcel(type) {
        let data, headers, title;
        if (type === 'items') {
            title = 'الأصناف';
            headers = ['رمز الصنف', 'الاسم', 'الفئة', 'الوحدة', 'الحد الأدنى', 'السعر'];
            const catMap = Object.fromEntries(state.categories.map(c => [c.id, c]));
            data = state.items.map(item => [
                item.sku, item.name,
                item.category_id && catMap[item.category_id] ? catMap[item.category_id].name : '',
                item.unit,
                item.min_stock, item.price
            ]);
        } else if (type === 'stock') {
            title = 'المخزون';
            headers = ['الصنف', 'رمز الصنف', 'المستودع', 'الكمية', 'الحد الأدنى', 'الحالة'];
            const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
            const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
            data = state.stock.map(s => {
                const item = itemsMap[s.item_id];
                const wh = whMap[s.warehouse_id];
                const minStock = item ? item.min_stock : 0;
                let status = 'متوفر';
                if (s.quantity <= 0) status = 'نفاد';
                else if (s.quantity <= minStock) status = 'منخفض';
                return [item ? item.name : '', item ? item.sku : '', wh ? wh.name : '',
                    s.quantity, minStock, status];
            });
        } else if (type === 'transactions') {
            title = 'الحركات';
            headers = ['التاريخ', 'الصنف', 'المستودع', 'النوع', 'الكمية', 'الملاحظات'];
            const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
            const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
            data = state.transactions.map(tx => {
                const item = itemsMap[tx.item_id];
                const wh = whMap[tx.warehouse_id];
                return [
                    new Date(tx.date).toLocaleDateString('ar-SA'),
                    item ? item.name : '', wh ? wh.name : '',
                    getTransactionTypeArabic(tx.type), tx.quantity, tx.notes || ''
                ];
            });
        } else if (type === 'credit') {
            title = 'المواد بالذمة';
            headers = ['التاريخ', 'الصنف', 'المستودع', 'الكمية', 'الجهة/الطرف', 'الملاحظات'];
            const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
            const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
            data = state.creditList.map(tx => {
                const item = itemsMap[tx.item_id];
                const wh = whMap[tx.warehouse_id];
                const party = tx.party || tx.notes?.split('|')[1]?.trim() || '-';
                const notes = tx.notes?.split('|')[0]?.trim() || tx.notes || '-';
                return [
                    new Date(tx.date).toLocaleDateString('ar-SA'),
                    item ? item.name : '', wh ? wh.name : '',
                    tx.quantity, party, notes
                ];
            });
        } else if (type === 'damaged') {
            title = 'المواد التالفة';
            headers = ['التاريخ', 'الصنف', 'المستودع', 'الكمية', 'السبب', 'الملاحظات'];
            const itemsMap = Object.fromEntries(state.items.map(i => [i.id, i]));
            const whMap = Object.fromEntries(state.warehouses.map(w => [w.id, w]));
            data = state.damagedList.map(tx => {
                const item = itemsMap[tx.item_id];
                const wh = whMap[tx.warehouse_id];
                const reason = tx.reason || tx.notes?.split('|')[0]?.trim() || '-';
                const notes = tx.notes?.split('|')[1]?.trim() || '-';
                return [
                    new Date(tx.date).toLocaleDateString('ar-SA'),
                    item ? item.name : '', wh ? wh.name : '',
                    tx.quantity, reason, notes
                ];
            });
        } else {
            return;
        }

        // إضافة العنوان والـ headers
        const wsData = [
            [`تقرير ${title} - ${new Date().toLocaleDateString('ar-SA')}`],
            headers,
            ...data
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title);
        XLSX.writeFile(wb, `warehouse-${type}-${new Date().toISOString().split('T')[0]}.xlsx`);
        showMessage(`تم تصدير ${title} بنجاح`);
    }

    function renderBarcodesGrid() {
        const container = document.getElementById('barcode-cards-container');
        if (!container) return;
        const searchTerm = (document.getElementById('barcode-search')?.value || '').toLowerCase();
        container.innerHTML = '';
        state.items.filter(item =>
            !searchTerm ||
            item.name.toLowerCase().includes(searchTerm) ||
            (item.sku || '').toLowerCase().includes(searchTerm)
        ).forEach(item => {
            const card = document.createElement('div');
            card.style.cssText = 'background: white; padding: 1rem; border-radius: 8px; border: 1px solid var(--border-color);';
            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <input type="checkbox" class="barcode-checkbox" value="${esc(item.sku)}" checked style="width: 18px; height: 18px;">
                    <strong>${esc(item.name)}</strong>
                </div>
                <div style="text-align: center;">
                    <svg class="barcode-svg" data-sku="${esc(item.sku)}"></svg>
                    <p style="font-family: monospace; margin: 0.5rem 0 0; font-size: 0.85rem;">${esc(item.sku)}</p>
                </div>
            `;
            container.appendChild(card);
        });
        // توليد الباركودات
        container.querySelectorAll('.barcode-svg').forEach(svg => {
            try {
                JsBarcode(svg, svg.dataset.sku, {format: "CODE128", width: 1.5, height: 50, displayValue: false});
            } catch (e) { console.error(e); }
        });
    }

    function printSelectedBarcodesFn() {
        const selected = Array.from(document.querySelectorAll('.barcode-checkbox:checked')).map(cb => cb.value);
        if (selected.length === 0) {
            showMessage('اختر صنفاً واحداً على الأقل', 'error');
            return;
        }
        const preview = document.getElementById('barcode-print-preview');
        // بناء المحتوى كاملاً ثم إسناده مرة واحدة - الإسناد التدريجي يغلق الوسوم تلقائياً
        const cards = selected.map(sku => `
            <div style="text-align: center; padding: 0.5rem; border: 1px dashed #ccc;">
                <svg class="print-barcode" data-sku="${esc(sku)}"></svg>
                <p style="font-family: monospace; font-size: 0.9rem;">${esc(sku)}</p>
            </div>
        `).join('');
        preview.innerHTML = `<div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">${cards}</div>`;
        document.getElementById('barcode-print-modal').style.display = 'flex';
        preview.querySelectorAll('.print-barcode').forEach(svg => {
            try {
                JsBarcode(svg, svg.dataset.sku, {format: "CODE128", width: 1.5, height: 60, displayValue: false});
            } catch (e) { console.error(e); }
        });
    }

    function printBarcodeSheet() {
        const preview = document.getElementById('barcode-print-preview');
        if (!preview || !preview.innerHTML.trim()) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            showMessage('تعذر فتح نافذة الطباعة - تأكد من السماح بالنوافذ المنبثقة', 'error');
            return;
        }
        printWindow.document.write(`
            <html dir="rtl">
            <head>
                <meta charset="utf-8">
                <title>طباعة الباركود</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 10px; }
                    @media print { @page { margin: 8mm; } }
                </style>
            </head>
            <body>${preview.innerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        // مهلة قصيرة حتى ترسم النافذة الجديدة عناصر SVG قبل الطباعة
        setTimeout(() => printWindow.print(), 300);
        document.getElementById('barcode-print-modal').style.display = 'none';
    }

    async function createBackupFn() {
        const resultDiv = document.getElementById('backup-result');
        const btn = document.getElementById('create-backup-btn');
        btn.disabled = true;
        btn.textContent = '⏳ جاري الإنشاء...';
        try {
            const response = await fetch(`${API_BASE_URL}/api/backup`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                throw new Error(await extractApiError(response, 'فشل إنشاء النسخة'));
            }
            const result = await response.json();
            resultDiv.innerHTML = `
                <div style="background: #d4edda; color: #155724; padding: 1rem; border-radius: 8px;">
                    <strong>✅ ${result.message}</strong><br>
                    اسم الملف: <code>${result.filename}</code>
                </div>
            `;
            showMessage('تم إنشاء النسخة الاحتياطية');
        } catch (error) {
            resultDiv.innerHTML = `
                <div style="background: #f8d7da; color: #721c24; padding: 1rem; border-radius: 8px;">
                    <strong>❌ ${error.message}</strong>
                </div>
            `;
            showMessage(error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = '📦 إنشاء نسخة احتياطية';
        }
    }

    function printTable(type) {
        let tableId;
        if (type === 'items') tableId = 'items-table-body';
        else if (type === 'stock') tableId = 'stock-table-body';
        else if (type === 'transactions') tableId = 'transactions-table-body';
        else if (type === 'credit') tableId = 'credit-table-body';
        else if (type === 'damaged') tableId = 'damaged-table-body';
        else return;

        const table = document.querySelector(`#${tableId}`)?.closest('table');
        if (!table) return;

        const printWindow = window.open('', '_blank');
        const titles = {
            items: 'الأصناف',
            stock: 'المخزون',
            transactions: 'الحركات',
            credit: 'المواد بالذمة',
            damaged: 'المواد التالفة'
        };
        printWindow.document.write(`
            <html dir="rtl">
            <head>
                <title>طباعة ${type}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                    th { background: #f5f5f5; }
                    h2 { text-align: center; margin-bottom: 20px; }
                    @media print { button { display: none; } }
                </style>
            </head>
            <body>
                <h2>تقرير ${titles[type] || type}</h2>
                ${table.outerHTML}
                <script>window.print();<\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
});