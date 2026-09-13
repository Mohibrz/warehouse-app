// ماسح الباركود - يستخدم html5-qrcode لمسح الباركود من الكاميرا

// التحقق من تحميل المكتبات
if (typeof Html5Qrcode === 'undefined') {
    console.error('html5-qrcode library not loaded!');
}
if (typeof Html5QrcodeSupportedFormats === 'undefined') {
    console.error('Html5QrcodeSupportedFormats not defined!');
}

// استخدام API_BASE_URL و getAuthHeaders و escapeHtml المُعرّفة في api.js
let html5QrcodeScanner = null;
let lastScannedCode = null;
let lastScannedItem = null;

function showBarcodeMessage(message, type = 'success') {
    const resultDiv = document.getElementById('barcode-result');
    // Convert message to safe string
    if (message && typeof message === 'object') {
        if (message instanceof Error) {
            message = message.message || message.name || String(message);
        } else if (message.detail) {
            message = typeof message.detail === 'string' ? message.detail : JSON.stringify(message.detail);
        } else if (message.message) {
            message = message.message;
        } else {
            message = JSON.stringify(message);
        }
    }
    message = String(message || '');

    if (resultDiv.style.display === 'none' || !resultDiv.style.display) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:15px 25px;border-radius:8px;font-size:16px;min-width:250px;text-align:center;';
        toast.style.background = type === 'error' ? '#e74c3c' : '#27ae60';
        toast.style.color = '#fff';
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 3500);
    } else {
        const content = document.getElementById('result-content');
        content.innerHTML = `<div class="message message-${type}">${escapeHtml(message)}</div>`;
    }
}

function showQuickMessage(message, type) {
    // Convert message to safe string
    if (message && typeof message === 'object') {
        if (message instanceof Error) {
            message = message.message || message.name || String(message);
        } else if (message.detail) {
            message = typeof message.detail === 'string' ? message.detail : JSON.stringify(message.detail);
        } else if (message.message) {
            message = message.message;
        } else {
            message = JSON.stringify(message);
        }
    }
    message = String(message || '');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3500);
}

async function startBarcodeScanner() {
    try {
        const startBtn = document.getElementById('start-scanner-btn');
        const stopBtn = document.getElementById('stop-scanner-btn');
        const container = document.getElementById('scanner-container');
        const result = document.getElementById('barcode-result');
        const scannerSection = document.getElementById('scanner');

        // التحقق من تحميل المكتبة
        if (typeof Html5Qrcode === 'undefined') {
            showBarcodeMessage('خطأ: مكتبة المسح لم تحمل. يرجى تحديث الصفحة.', 'error');
            return;
        }

        // تنظيف النتيجة السابقة
        result.style.display = 'none';
        document.getElementById('quick-transaction-form').style.display = 'none';
        container.style.display = 'block';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        document.getElementById('scanner-status').textContent = 'جاري تشغيل الكاميرا...';

        // التمرير لقسم المسح على الهاتف
        if (scannerSection) {
            scannerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // تنظيف reader div
        const readerDiv = document.getElementById('reader');
        readerDiv.innerHTML = '';

        // إنشاء ماسح جديد
        html5QrcodeScanner = new Html5Qrcode("reader");

        // إعدادات الكاميرا
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
        };

        // استخدام الكاميرا الخلفية
        const cameraConfig = { facingMode: "environment" };

        await html5QrcodeScanner.start(
            cameraConfig,
            config,
            onScanSuccess,
            (errorMessage) => {
                // خطأ مستمر - لا نريد إظهاره
            }
        );

        // إعادة تعيين حالة المسح
        lastScannedCode = null;

        document.getElementById('scanner-status').textContent = '🎯 وجّه الكاميرا نحو الباركود...';
    } catch (err) {
        console.error('Camera start error:', err);
        let errorMsg = 'تعذّر تشغيل الكاميرا';

        const errStr = String(err);

        if (errStr.includes('Permission') || errStr.includes('NotAllowed') || errStr.includes('PermissionDenied')) {
            errorMsg = '⚠️ يرجى السماح بالوصول إلى الكاميرا في المتصفح';
        } else if (errStr.includes('NotFound') || errStr.includes('DevicesNotFound')) {
            errorMsg = '❌ لا توجد كاميرا متاحة في هذا الجهاز';
        } else if (errStr.includes('NotReadable') || errStr.includes('TrackStartError')) {
            errorMsg = '❌ الكاميرا مستخدمة من تطبيق آخر';
        } else if (errStr.includes('InsecureContext')) {
            errorMsg = '⚠️ الكاميرا تحتاج اتصال آمن (HTTPS)';
        } else if (errStr.includes('OverconstrainedError')) {
            errorMsg = '⚠️ الكاميرا لا تدعم هذا التنسيق';
        } else {
            errorMsg = '❌ ' + (err.message || errStr).substring(0, 100);
        }

        showBarcodeMessage(errorMsg, 'error');

        // إعادة الأزرار لحالتها الأصلية
        document.getElementById('scanner-container').style.display = 'none';
        document.getElementById('start-scanner-btn').style.display = 'inline-block';
        document.getElementById('stop-scanner-btn').style.display = 'none';

        // إعادة تعيين الماسح عند الفشل
        html5QrcodeScanner = null;
    }
}

async function stopBarcodeScanner() {
    try {
        if (html5QrcodeScanner) {
            try {
                await html5QrcodeScanner.stop();
            } catch (e) {
                console.log('Scanner already stopped');
            }
            try {
                html5QrcodeScanner.clear();
            } catch (e) {
                console.log('Scanner already cleared');
            }
        }
    } catch (err) {
        console.error('Stop scanner error:', err);
    }

    // إعادة تعيين الماسح بالكامل
    html5QrcodeScanner = null;
    lastScannedCode = null;
    lastScannedItem = null;

    document.getElementById('scanner-container').style.display = 'none';
    document.getElementById('start-scanner-btn').style.display = 'inline-block';
    document.getElementById('stop-scanner-btn').style.display = 'none';
    document.getElementById('barcode-result').style.display = 'none';
    document.getElementById('quick-transaction-form').style.display = 'none';
    document.getElementById('scanner-status').textContent = '';
}

function onScanSuccess(decodedText, decodedResult) {
    if (lastScannedCode === decodedText) return;
    lastScannedCode = decodedText;
    document.getElementById('scanner-status').textContent = `✅ تم مسح: ${decodedText}`;

    // إيقاف الكاميرا مؤقتاً
    if (html5QrcodeScanner) {
        html5QrcodeScanner.pause(true);
    }

    // إظهار رسالة جاري البحث
    document.getElementById('barcode-result').style.display = 'block';
    document.getElementById('result-content').innerHTML = '<p style="text-align:center;">جاري البحث عن الصنف...</p>';

    // البحث عن الصنف
    lookupItemByBarcode(decodedText);
}

async function lookupItemByBarcode(code) {
    console.log('Looking up barcode:', code);
    console.log('API URL:', `${API_BASE_URL}/api/items?sku=${encodeURIComponent(code)}`);

    try {
        const response = await fetch(`${API_BASE_URL}/api/items?sku=${encodeURIComponent(code)}`, {
            headers: getAuthHeaders()
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error('فشل البحث في قاعدة البيانات');
        }

        const items = await response.json();
        console.log('Items found:', items.length);

        if (items.length > 0) {
            // تم العثور على الصنف
            const item = items[0];
            lastScannedItem = item;
            showItemFound(item);
        } else {
            // لم يتم العثور على الصنف
            showItemNotFound(code);
        }
    } catch (err) {
        console.error('Lookup error:', err);
        showBarcodeMessage('خطأ: ' + (err.message || 'فشل الاتصال'), 'error');
        if (html5QrcodeScanner) {
            html5QrcodeScanner.resume();
        }
    }
}

async function showItemFound(item) {
    const resultDiv = document.getElementById('barcode-result');
    const content = document.getElementById('result-content');
    const title = document.getElementById('result-title');

    // جلب المخزون الحالي
    let stock = null;
    let warehouseName = '-';
    try {
        const stockResp = await fetch(`${API_BASE_URL}/api/stock?item_id=${item.id}`, {
            headers: getAuthHeaders()
        });
        if (stockResp.ok) {
            const stockList = await stockResp.json();
            const total = stockList.reduce((s, st) => s + parseFloat(st.quantity || 0), 0);
            stock = total;
            if (stockList.length > 0) {
                warehouseName = stockList[0].warehouse_name || '-';
            }
        }
    } catch (e) {
        console.error('Stock fetch error', e);
    }

    // تحديد حالة المخزون
    let stockStatus = 'متوفر';
    let stockClass = 'scan-success';
    if (stock === null || stock === 0) {
        stockStatus = 'نفاد';
        stockClass = 'scan-error';
    } else if (stock <= item.min_stock) {
        stockStatus = 'منخفض';
        stockClass = 'scan-error';
    }

    title.textContent = '✅ تم العثور على الصنف';
    content.innerHTML = `
        <div class="result-info">
            <div class="result-info-item">
                <label>اسم الصنف</label>
                <span>${escapeHtml(item.name)}</span>
            </div>
            <div class="result-info-item">
                <label>رمز SKU</label>
                <span>${escapeHtml(item.sku)}</span>
            </div>
            <div class="result-info-item">
                <label>الفئة</label>
                <span>${escapeHtml(item.category) || '-'}</span>
            </div>
            <div class="result-info-item">
                <label>الوحدة</label>
                <span>${escapeHtml(item.unit)}</span>
            </div>
            <div class="result-info-item">
                <label>المستودع</label>
                <span>${escapeHtml(warehouseName)}</span>
            </div>
            <div class="result-info-item">
                <label>السعر</label>
                <span>${parseFloat(item.price || 0).toFixed(2)} د.ع</span>
            </div>
        </div>
        <div class="quick-stock-info">
            <div class="quick-stock-item ${stockClass}">
                <label>المخزون الحالي</label>
                <span>${stock !== null ? stock : '0'}</span>
            </div>
            <div class="quick-stock-item">
                <label>الحد الأدنى</label>
                <span>${item.min_stock}</span>
            </div>
            <div class="quick-stock-item">
                <label>الحالة</label>
                <span style="color: ${stockStatus === 'متوفر' ? 'var(--success-color)' : 'var(--danger-color)'};">${stockStatus}</span>
            </div>
        </div>
    `;

    resultDiv.style.display = 'block';
    resultDiv.className = 'barcode-result';

    // تخزين معلومات الصنف لإجراءات لاحقة
    document.getElementById('quick-item-id').value = item.id;
    document.getElementById('quick-item-warehouse-id').value = item.warehouse_id || '';
    document.getElementById('quick-item-name').textContent = item.name;
}

function showItemNotFound(code) {
    const resultDiv = document.getElementById('barcode-result');
    const content = document.getElementById('result-content');
    const title = document.getElementById('result-title');

    title.textContent = '⚠️ لم يتم العثور على الصنف';
    content.innerHTML = `
        <div class="message message-error">
            لا يوجد صنف برمز الباركود هذا في النظام:<br>
            <strong style="font-size: 1.2rem;">${escapeHtml(code)}</strong>
        </div>
        <p style="margin-top: 1rem;">يمكنك إضافة صنف جديد بهذا الرمز من قسم "الأصناف".</p>
    `;
    resultDiv.style.display = 'block';
    resultDiv.className = 'barcode-result';
    lastScannedItem = null;
}

function showQuickTransactionForm() {
    if (!lastScannedItem) {
        showBarcodeMessage('يرجى مسح صنف أولاً', 'error');
        return;
    }
    document.getElementById('quick-transaction-form').style.display = 'block';
    document.getElementById('quick-transaction-quantity').value = '1';
    document.getElementById('quick-transaction-quantity').focus();
}

async function submitQuickTransaction(e) {
    e.preventDefault();
    if (!lastScannedItem) return;

    const type = document.getElementById('quick-transaction-type').value;
    const quantity = parseFloat(document.getElementById('quick-transaction-quantity').value);
    const notes = document.getElementById('quick-transaction-notes').value;
    const warehouseId = parseInt(document.getElementById('quick-item-warehouse-id').value);

    if (!warehouseId) {
        showQuickMessage('❌ الصنف غير مرتبط بمستودع. يرجى تعديله من قسم الأصناف أولاً', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({
                type: type,
                quantity: quantity,
                item_id: lastScannedItem.id,
                warehouse_id: warehouseId,
                notes: notes || `حركة سريعة - ${type === 'in' ? 'دخول' : 'خروج'} من الباركود`
            })
        });

        if (!response.ok) {
            throw new Error(await extractApiError(response, 'فشل تسجيل الحركة'));
        }

        await response.json();
        showQuickMessage(`✅ تم تسجيل ${type === 'in' ? 'الدخول' : 'الخروج'} بنجاح`, 'success');
        document.getElementById('quick-transaction-form').style.display = 'none';
        document.getElementById('quick-transaction-notes').value = '';

        // إعادة تشغيل المسح
        scanAgain();
    } catch (err) {
        showQuickMessage('❌ ' + err.message, 'error');
    }
}

function scanAgain() {
    lastScannedCode = null;
    lastScannedItem = null;
    document.getElementById('barcode-result').style.display = 'none';
    document.getElementById('quick-transaction-form').style.display = 'none';

    if (html5QrcodeScanner) {
        html5QrcodeScanner.resume();
        document.getElementById('scanner-status').textContent = '🎯 وجّه الكاميرا نحو الباركود...';
    } else {
        startBarcodeScanner();
    }
}

function viewScannedItemDetails() {
    if (!lastScannedItem) return;
    // الانتقال لقسم الأصناف والبحث
    document.querySelector('[data-section="items"]').click();
    // يمكن إضافة منطق البحث عن الصنف هنا
    showQuickMessage('تم الانتقال لقسم الأصناف', 'success');
}

// أحداث عند فتح قسم المسح
function initBarcodeScanner() {
    const scannerSection = document.getElementById('scanner');
    if (!scannerSection) return;

    // عند تبديل الأقسام: إيقاف الكاميرا
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-section') !== 'scanner') {
                stopBarcodeScanner();
            }
        });
    });

    // عند العودة لقسم المسح: إعادة ضبط الحالة
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.getAttribute('data-section') === 'scanner') {
                // ضمان نظافة الحالة عند العودة
                lastScannedCode = null;
                lastScannedItem = null;
                const startBtn = document.getElementById('start-scanner-btn');
                const stopBtn = document.getElementById('stop-scanner-btn');
                const container = document.getElementById('scanner-container');
                if (container) container.style.display = 'none';
                if (startBtn) startBtn.style.display = 'inline-block';
                if (stopBtn) stopBtn.style.display = 'none';
            }
        });
    });

    document.getElementById('start-scanner-btn').addEventListener('click', startBarcodeScanner);
    document.getElementById('stop-scanner-btn').addEventListener('click', stopBarcodeScanner);
    document.getElementById('quick-transaction-btn').addEventListener('click', showQuickTransactionForm);
    document.getElementById('view-item-btn').addEventListener('click', viewScannedItemDetails);
    document.getElementById('scan-again-btn').addEventListener('click', scanAgain);
    document.getElementById('cancel-quick-tx-btn').addEventListener('click', () => {
        document.getElementById('quick-transaction-form').style.display = 'none';
    });

    document.getElementById('quick-tx-form').addEventListener('submit', submitQuickTransaction);

    // البحث اليدوي
    const manualForm = document.getElementById('manual-lookup-form');
    if (manualForm) {
        manualForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('manual-barcode').value.trim();
            if (!code) {
                showBarcodeMessage('يرجى إدخال رمز الباركود', 'error');
                return;
            }
            lookupItemByBarcode(code);
        });
    }
}
