// إعدادات مشتركة بين ملفات الواجهة (app.js و barcode.js)
// يُحمَّل قبلهما في index.html

// اكتشاف عنوان الخادم تلقائياً: localhost أثناء التطوير، ونفس الأصل في الإنتاج (Tailscale HTTPS)
var API_BASE_URL = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:9000"
    : `${location.protocol}//${location.host}`;

// ترويسة المصادقة المشتركة
function getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return token ? {'Authorization': `Bearer ${token}`} : {};
}

// تهريب النصوص قبل إدراجها في HTML - يمنع كسر الصفحة أو حقن سكربتات
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// استخراج رسالة خطأ مقروءة من استجابة FastAPI
// {detail: "نص"} أو {detail: [{msg: "..."}]}
async function extractApiError(response, fallback) {
    try {
        const data = await response.json();
        if (typeof data.detail === 'string') return data.detail;
        if (Array.isArray(data.detail)) {
            const parts = data.detail
                .map(e => (typeof e === 'string' ? e : e.msg))
                .filter(Boolean);
            if (parts.length) return parts.join('، ');
        }
        if (typeof data.message === 'string') return data.message;
    } catch (e) {
        // الاستجابة ليست JSON
    }
    return `${fallback} (HTTP ${response.status})`;
}
