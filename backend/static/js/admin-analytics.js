function formatNumber(value) {
    return Number(value || 0).toLocaleString('en-IN');
}

function formatCurrency(value, symbol = '₹') {
    return `${symbol}${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function formatDateTime(value) {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    });
}

let currentWindow = 'daily';
let currentTrendMode = 'bar';
let analyticsInitialized = false;

function isAdminPinUnlocked() {
    return !window.adminPinLock || window.adminPinLock.isUnlocked();
}

async function parseJsonResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
        const error = new Error(data.message || 'Unable to load analytics data');
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

function setLoadingState(isLoading, title = 'Loading analytics', text = 'Fetching live data and preparing charts...') {
    const banner = document.getElementById('analytics-loading-banner');
    const titleNode = document.getElementById('analytics-loading-title');
    const textNode = document.getElementById('analytics-loading-text');

    if (titleNode) titleNode.textContent = title;
    if (textNode) textNode.textContent = text;
    if (banner) banner.classList.toggle('is-hidden', !isLoading);

    document.querySelectorAll('.trend-chart, .rank-chart, .data-table').forEach(node => {
        node.classList.toggle('chart-loading', isLoading);
    });
}

function formatMetric(card) {
    if (card.format === 'currency') {
        return formatCurrency(card.value, card.currency_symbol || '₹');
    }
    return formatNumber(card.value);
}

function renderCards(cards) {
    const container = document.getElementById('analytics-cards');
    container.innerHTML = cards.map(card => `
        <article class="metric-card">
            <span class="metric-label">${card.title}</span>
            <div class="metric-value">${formatMetric(card)}</div>
            <p class="metric-context">${card.context || ''}</p>
        </article>
    `).join('');
}

function renderFeeCards(cards) {
    const container = document.getElementById('analytics-fee-cards');
    container.innerHTML = cards.map(card => `
        <article class="metric-card fee-metric-card">
            <span class="metric-label">${card.title}</span>
            <div class="metric-value">${formatMetric(card)}</div>
            <p class="metric-context">${card.context || ''}</p>
        </article>
    `).join('');
}

function renderBarTrendChart(labels, values, formatter) {
    const maxValue = Math.max(...values, 0);
    const labelStep = labels.length > 10 ? 2 : 1;
    const bars = labels.map((label, index) => {
        const value = values[index] || 0;
        const height = maxValue > 0 ? Math.max((value / maxValue) * 150, value > 0 ? 12 : 8) : 8;
        const showLabel = index % labelStep === 0 || index === labels.length - 1;
        return `
            <div class="trend-bar-wrap">
                <div class="trend-bar-zone">
                    <div class="trend-hover-value">${label}: ${formatter(value)}</div>
                    <div class="trend-bar" style="height:${height}px"></div>
                </div>
                <div class="trend-label">${showLabel ? label : '&nbsp;'}</div>
            </div>
        `;
    }).join('');

    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);
    return `
        <div class="trend-summary">
            <span class="metric-label">Total</span>
            <strong>${formatter(total)}</strong>
        </div>
        <div class="trend-bars" style="--bars:${labels.length}">
            ${bars}
        </div>
    `;
}

function renderLineTrendChart(labels, values, formatter) {
    const width = 640;
    const height = 220;
    const paddingX = 18;
    const paddingTop = 20;
    const paddingBottom = 34;
    const chartHeight = height - paddingTop - paddingBottom;
    const chartWidth = width - paddingX * 2;
    const maxValue = Math.max(...values, 0);
    const points = values.map((value, index) => {
        const x = paddingX + (labels.length === 1 ? chartWidth / 2 : (chartWidth / Math.max(labels.length - 1, 1)) * index);
        const ratio = maxValue > 0 ? value / maxValue : 0;
        const y = paddingTop + chartHeight - (ratio * chartHeight);
        return { x, y, value, label: labels[index] };
    });
    const linePoints = points.map(point => `${point.x},${point.y}`).join(' ');
    const areaPoints = [
        `${points[0]?.x || paddingX},${height - paddingBottom}`,
        linePoints,
        `${points[points.length - 1]?.x || paddingX},${height - paddingBottom}`
    ].join(' ');
    const labelStep = labels.length > 10 ? 2 : 1;
    const xLabels = points.map((point, index) => {
        const showLabel = index % labelStep === 0 || index === labels.length - 1;
        return `
            <div class="line-x-label" style="left:${(point.x / width) * 100}%;">
                ${showLabel ? point.label : ''}
            </div>
        `;
    }).join('');
    const total = values.reduce((sum, value) => sum + Number(value || 0), 0);

    return `
        <div class="trend-summary">
            <span class="metric-label">Total</span>
            <strong>${formatter(total)}</strong>
        </div>
        <div class="line-chart-shell">
            <svg class="line-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
                <path class="line-chart-area" d="M ${areaPoints}" fill="rgba(29,108,83,0.15)"></path>
                <polyline class="line-chart-path" points="${linePoints}"></polyline>
                ${points.map(point => `
                    <g class="line-point-group">
                        <circle class="line-point-hit" cx="${point.x}" cy="${point.y}" r="14"></circle>
                        <circle class="line-point-dot" cx="${point.x}" cy="${point.y}" r="4"></circle>
                        <g class="line-point-tooltip">
                            <rect x="${Math.max(point.x - 46, 6)}" y="${Math.max(point.y - 42, 6)}" width="92" height="28" rx="8"></rect>
                            <text x="${point.x}" y="${Math.max(point.y - 24, 20)}" text-anchor="middle">${formatter(point.value)}</text>
                        </g>
                    </g>
                `).join('')}
            </svg>
            <div class="line-x-axis">
                ${xLabels}
            </div>
        </div>
    `;
}

function renderTrendChart(elementId, chart, formatter = value => formatNumber(value), seriesKey = null) {
    const container = document.getElementById(elementId);
    const labels = chart?.labels || [];
    const seriesName = seriesKey || Object.keys(chart?.series || {})[0];
    const values = chart?.series?.[seriesName] || [];

    if (!labels.length) {
        container.innerHTML = '<div class="empty-state">No data available for this period.</div>';
        return;
    }

    container.innerHTML = currentTrendMode === 'line'
        ? renderLineTrendChart(labels, values, formatter)
        : renderBarTrendChart(labels, values, formatter);
}

function renderRankChart(elementId, items, valueKey, formatter = value => formatNumber(value), warm = false) {
    const container = document.getElementById(elementId);
    if (!items?.length) {
        container.innerHTML = '<div class="empty-state">No data available for this widget.</div>';
        return;
    }

    const maxValue = Math.max(...items.map(item => Number(item[valueKey] || 0)), 0);
    container.innerHTML = `
        <div class="rank-list">
            ${items.map(item => {
                const value = Number(item[valueKey] || 0);
                const width = maxValue > 0 ? (value / maxValue) * 100 : 0;
                return `
                    <div class="rank-item">
                        <div class="rank-row">
                            <strong>${item.label}</strong>
                            <span>${formatter(value)}</span>
                        </div>
                        <div class="rank-track">
                            <div class="rank-fill${warm ? ' warm' : ''}" style="width:${width}%"></div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderTable(elementId, rows, rowRenderer) {
    const container = document.getElementById(elementId);
    if (!rows?.length) {
        container.innerHTML = '<div class="empty-state">No rows to show right now.</div>';
        return;
    }

    container.innerHTML = `<div class="table-list">${rows.map(rowRenderer).join('')}</div>`;
}

function renderTables(tables) {
    renderTable('table-users-no-account', tables.users_no_account, row => `
        <div class="table-row">
            <div class="table-row-top">
                <strong>${row.name}</strong>
                <div class="table-pills">
                    <span class="table-pill">${row.country}</span>
                </div>
            </div>
            <small>${row.email}</small>
            <small>Joined ${formatDateTime(row.created_at)}</small>
        </div>
    `);

    renderTable('table-awaiting-mt', tables.awaiting_mt_setup, row => `
        <div class="table-row">
            <div class="table-row-top">
                <strong>${row.nickname}</strong>
                <div class="table-pills">
                    <span class="table-pill">${row.account_type}</span>
                    <span class="table-pill">${row.platform}</span>
                </div>
            </div>
            <small>${row.user_email}</small>
            <small>${row.currency} account created ${formatDateTime(row.created_at)}</small>
        </div>
    `);

    renderTable('table-aging-approvals', tables.aging_pending_approvals, row => `
        <div class="table-row">
            <div class="table-row-top">
                <strong>${row.account_nickname}</strong>
                <div class="table-pills">
                    <span class="table-pill warm">${row.type}</span>
                    <span class="table-pill">${row.currency} ${formatNumber(row.amount)}</span>
                </div>
            </div>
            <small>${row.user_email}</small>
            <small>${row.age_minutes} minutes old · created ${formatDateTime(row.created_at)}</small>
        </div>
    `);

    renderTable('table-unread-support', tables.unread_support_threads, row => `
        <div class="table-row">
            <div class="table-row-top">
                <strong>${row.user_name}</strong>
                <div class="table-pills">
                    <span class="table-pill">${row.unread_count} unread</span>
                </div>
            </div>
            <small>${row.user_email}</small>
            <small>Last message ${formatDateTime(row.last_message_at)}</small>
        </div>
    `);
}

function renderGeneratedAt(value) {
    const target = document.getElementById('analytics-generated-at');
    target.textContent = formatDateTime(value);
}

function setActiveWindow(window, label) {
    currentWindow = window;
    document.querySelectorAll('.window-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.window === window);
    });
    const labelNode = document.getElementById('analytics-window-label');
    if (labelNode) {
        labelNode.textContent = label || '';
    }
}

function setTrendMode(mode) {
    currentTrendMode = mode;
    document.querySelectorAll('.mode-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });
}

function renderAnalytics(summary, tables) {
    renderCards(summary.cards || []);
    renderFeeCards(summary.fee_cards || []);
    renderGeneratedAt(summary.generated_at);
    setActiveWindow(summary.window || currentWindow, summary.window_label || '');

    renderTrendChart('chart-user-growth', summary.charts.user_growth, value => formatNumber(value), 'users');
    renderTrendChart('chart-fee-growth', summary.charts.fee_growth, value => formatCurrency(value), 'fee');
    renderRankChart('chart-users-country', summary.charts.users_by_country, 'users');
    renderRankChart('chart-accounts-type', summary.charts.accounts_by_type, 'accounts');
    renderRankChart('chart-accounts-platform', summary.charts.accounts_by_platform_currency, 'accounts');
    renderTrendChart('chart-deposit-volume', summary.charts.deposit_volume, value => formatCurrency(value), 'amount');
    renderRankChart('chart-deposits-method', summary.charts.deposits_by_method, 'amount', value => formatCurrency(value), true);
    renderTrendChart('chart-withdrawal-volume', summary.charts.withdrawal_volume, value => formatCurrency(value, '$'), 'amount');
    renderRankChart('chart-withdrawals-method', summary.charts.withdrawals_by_method, 'amount', value => formatCurrency(value, '$'), true);

    renderTables(tables.tables || {});
}

function showAnalyticsError(message) {
    const shell = document.querySelector('.analytics-shell');
    const block = document.createElement('div');
    block.className = 'analytics-error';
    block.textContent = message;
    shell.prepend(block);
}

async function loadAnalytics(window = currentWindow) {
    if (!isAdminPinUnlocked()) return;
    document.querySelectorAll('.analytics-error').forEach(node => node.remove());
    setLoadingState(true, 'Loading analytics', 'Fetching live data from the dashboard collections...');
    try {
        const [summaryResponse, tablesResponse] = await Promise.all([
            fetch(`/api/admin/analytics/summary?window=${encodeURIComponent(window)}`),
            fetch('/api/admin/analytics/tables')
        ]);

        const [summary, tables] = await Promise.all([
            parseJsonResponse(summaryResponse),
            parseJsonResponse(tablesResponse)
        ]);

        setLoadingState(true, 'Rendering charts', 'Drawing cards, charts, and action tables...');
        renderAnalytics(summary, tables);
        setLoadingState(false);
    } catch (error) {
        console.error('Analytics load error:', error);
        setLoadingState(false);
        if (error.status === 423 || error.data?.pin_required) {
            return;
        }
        showAnalyticsError(error.message || 'Unable to load analytics data');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    function initializeAnalytics() {
        if (analyticsInitialized || !isAdminPinUnlocked()) return;
        analyticsInitialized = true;
        loadAnalytics();
    }

    document.getElementById('analytics-refresh-btn')?.addEventListener('click', () => loadAnalytics(currentWindow));
    document.querySelectorAll('.window-btn').forEach(button => {
        button.addEventListener('click', () => loadAnalytics(button.dataset.window));
    });
    document.querySelectorAll('.mode-btn').forEach(button => {
        button.addEventListener('click', () => {
            setTrendMode(button.dataset.mode);
            loadAnalytics(currentWindow);
        });
    });
    setTrendMode(currentTrendMode);
    initializeAnalytics();
    document.addEventListener('admin-pin:locked', () => {
        analyticsInitialized = false;
        setLoadingState(false);
        document.querySelectorAll('.analytics-error').forEach(node => node.remove());
    });
    document.addEventListener('admin-pin:unlocked', initializeAnalytics);
});
