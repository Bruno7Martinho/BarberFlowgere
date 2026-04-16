// Sistema Financeiro - VERSÃO SUPABASE

// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================
const SUPABASE_URL = 'https://opmpodjqdxtpdolvrzln.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RYuRxp9GWjfyEMwE3bjMCg_lYIJOg5a';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let currentBarbeariaId = null;
let currentUser = null;
let revenueExpenseChart = null;
let expensesCategoryChart = null;
let allTransactions = [];
let allCompletedServices = [];

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Iniciando sistema financeiro com Supabase...');
    initializeSupabase();
    document.getElementById('currentYear').textContent = new Date().getFullYear();
});

async function initializeSupabase() {
    try {
        await getCurrentBarbearia();
        
        if (!currentBarbeariaId) {
            console.log('Aguardando barbearia...');
            setTimeout(() => initializeSupabase(), 500);
            return;
        }
        
        updateUserNameDisplay();
        setupEventListeners();
        await loadFinancialData();
        
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showAlert('error', 'Erro ao conectar ao banco de dados');
    }
}

async function getCurrentBarbearia() {
    try {
        const userStr = sessionStorage.getItem('barberflow_user');
        if (!userStr) {
            window.location.href = 'login.html';
            return null;
        }
        
        currentUser = JSON.parse(userStr);
        
        if (currentUser.barbearia_id) {
            const { data: barbearia, error } = await supabase
                .from('barbearias')
                .select('*')
                .eq('id', currentUser.barbearia_id)
                .single();
            
            if (error) throw error;
            
            currentBarbeariaId = barbearia.id;
            sessionStorage.setItem('currentBarbeariaId', barbearia.id);
            sessionStorage.setItem('currentBarbeariaName', barbearia.nome);
            
            const badge = document.getElementById('barbershopBadge');
            const nameSpan = document.getElementById('barbershopName');
            if (barbearia.nome && badge && nameSpan) {
                nameSpan.textContent = barbearia.nome;
                badge.style.display = 'inline-flex';
            }
        }
        
        return currentBarbeariaId;
    } catch (error) {
        console.error('Erro ao buscar barbearia:', error);
        return null;
    }
}

function updateUserNameDisplay() {
    const userNameElement = document.getElementById('userName');
    if (userNameElement && currentUser) {
        let text = currentUser.email || currentUser.nome || 'Usuário';
        const barbershopName = sessionStorage.getItem('currentBarbershopName');
        if (barbershopName) {
            text = `🏢 ${barbershopName} | ${text}`;
        }
        userNameElement.textContent = text;
        userNameElement.style.color = '#3498db';
        userNameElement.style.fontWeight = 'bold';
    }
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    const periodSelect = document.getElementById('periodSelect');
    const applyCustomDate = document.getElementById('applyCustomDate');
    const typeFilter = document.getElementById('typeFilter');
    const addRevenueBtn = document.getElementById('addRevenueBtn');
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    const viewTransactionsBtn = document.getElementById('viewTransactionsBtn');
    const closeTransactionsBtn = document.getElementById('closeTransactionsBtn');
    const transactionForm = document.getElementById('transactionForm');
    const cancelTransactionBtn = document.getElementById('cancelTransactionBtn');
    const transactionType = document.getElementById('transactionType');
    
    if (periodSelect) periodSelect.addEventListener('change', () => loadFinancialData());
    if (applyCustomDate) applyCustomDate.addEventListener('click', () => loadFinancialData());
    if (typeFilter) typeFilter.addEventListener('change', () => loadFinancialData());
    if (addRevenueBtn) addRevenueBtn.addEventListener('click', () => showTransactionForm('receita'));
    if (addExpenseBtn) addExpenseBtn.addEventListener('click', () => showTransactionForm('despesa'));
    if (viewTransactionsBtn) viewTransactionsBtn.addEventListener('click', showTransactionsList);
    if (closeTransactionsBtn) closeTransactionsBtn.addEventListener('click', hideTransactionsList);
    if (transactionForm) transactionForm.addEventListener('submit', saveTransaction);
    if (cancelTransactionBtn) cancelTransactionBtn.addEventListener('click', hideTransactionForm);
    if (transactionType) transactionType.addEventListener('change', populateCategorySelect);
    
    // Configurar data padrão
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate) startDate.value = firstDay.toISOString().split('T')[0];
    if (endDate) endDate.value = today.toISOString().split('T')[0];
}

// ============================================
// FUNÇÕES DE CARREGAMENTO DE DADOS
// ============================================

async function loadFinancialData() {
    if (!currentBarbeariaId) {
        console.log('Aguardando barbearia...');
        setTimeout(() => loadFinancialData(), 500);
        return;
    }
    
    try {
        const barbershopName = sessionStorage.getItem('currentBarbershopName');
        console.log(`Carregando dados financeiros da barbearia: ${barbershopName}`);
        
        const { startDate, endDate } = getDateRange();
        
        // Carregar transações financeiras
        await loadTransactions(startDate, endDate);
        
        // Carregar serviços concluídos
        await loadCompletedServices(startDate, endDate);
        
        // Atualizar UI
        updateSummaryCards();
        updateCharts();
        updateServicesReport();
        updateBarberPerformance();
        
    } catch (error) {
        console.error('Erro ao carregar dados financeiros:', error);
        showAlert('error', 'Erro ao carregar dados financeiros: ' + error.message);
    }
}

function getDateRange() {
    const period = document.getElementById('periodSelect')?.value || 'month';
    const today = new Date();
    let startDate, endDate;
    
    switch (period) {
        case 'week':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - today.getDay());
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            break;
        case 'month':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'lastMonth':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'year':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            break;
        case 'custom':
            startDate = new Date(document.getElementById('startDate')?.value);
            endDate = new Date(document.getElementById('endDate')?.value);
            break;
        default:
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
}

async function loadTransactions(startDate, endDate) {
    try {
        let query = supabase
            .from('financeiro')
            .select('*')
            .eq('barbearia_id', currentBarbeariaId)
            .gte('data_movimento', startDate)
            .lte('data_movimento', endDate);
        
        const typeFilter = document.getElementById('typeFilter')?.value;
        if (typeFilter && typeFilter !== 'all') {
            query = query.eq('tipo', typeFilter);
        }
        
        const { data, error } = await query.order('data_movimento', { ascending: false });
        
        if (error) throw error;
        
        allTransactions = data || [];
        console.log(`✅ ${allTransactions.length} transações carregadas`);
        
        return allTransactions;
    } catch (error) {
        console.error('Erro ao carregar transações:', error);
        return [];
    }
}

async function loadCompletedServices(startDate, endDate) {
    try {
        const { data, error } = await supabase
            .from('agendamentos')
            .select(`
                *,
                clientes (nome),
                barbeiros (nome),
                servicos (nome, preco)
            `)
            .eq('barbearia_id', currentBarbeariaId)
            .eq('status', 'concluido')
            .gte('data_hora', `${startDate}T00:00:00`)
            .lte('data_hora', `${endDate}T23:59:59`)
            .order('data_hora', { ascending: false });
        
        if (error) throw error;
        
        allCompletedServices = data || [];
        console.log(`✅ ${allCompletedServices.length} serviços concluídos carregados`);
        
        return allCompletedServices;
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        return [];
    }
}

// ============================================
// FUNÇÕES DE UI - CARDS E GRÁFICOS
// ============================================

function updateSummaryCards() {
    const totalReceitas = allTransactions
        .filter(t => t.tipo === 'receita')
        .reduce((sum, t) => sum + t.valor, 0);
    
    const totalDespesas = allTransactions
        .filter(t => t.tipo === 'despesa')
        .reduce((sum, t) => sum + t.valor, 0);
    
    const lucro = totalReceitas - totalDespesas;
    const margem = totalReceitas > 0 ? (lucro / totalReceitas) * 100 : 0;
    
    const totalRevenueEl = document.getElementById('totalRevenue');
    const totalExpensesEl = document.getElementById('totalExpenses');
    const netProfitEl = document.getElementById('netProfit');
    const profitMarginEl = document.getElementById('profitMargin');
    
    if (totalRevenueEl) totalRevenueEl.textContent = formatMoney(totalReceitas);
    if (totalExpensesEl) totalExpensesEl.textContent = formatMoney(totalDespesas);
    if (netProfitEl) netProfitEl.textContent = formatMoney(lucro);
    if (profitMarginEl) profitMarginEl.textContent = `${margem.toFixed(1)}%`;
}

function updateCharts() {
    // Gráfico de Receita vs Despesa por dia
    const receitasPorDia = {};
    const despesasPorDia = {};
    
    allTransactions.forEach(t => {
        const date = t.data_movimento;
        if (t.tipo === 'receita') {
            receitasPorDia[date] = (receitasPorDia[date] || 0) + t.valor;
        } else {
            despesasPorDia[date] = (despesasPorDia[date] || 0) + t.valor;
        }
    });
    
    const dates = [...new Set([...Object.keys(receitasPorDia), ...Object.keys(despesasPorDia)])].sort();
    
    const revenueCtx = document.getElementById('revenueExpenseChart');
    if (revenueCtx) {
        if (revenueExpenseChart) revenueExpenseChart.destroy();
        
        revenueExpenseChart = new Chart(revenueCtx, {
            type: 'bar',
            data: {
                labels: dates.map(d => formatDate(d)),
                datasets: [
                    {
                        label: 'Receitas',
                        data: dates.map(d => receitasPorDia[d] || 0),
                        backgroundColor: '#28a745',
                        borderRadius: 5
                    },
                    {
                        label: 'Despesas',
                        data: dates.map(d => despesasPorDia[d] || 0),
                        backgroundColor: '#dc3545',
                        borderRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.raw)}` } }
                }
            }
        });
    }
    
    // Gráfico de Despesas por Categoria
    const despesasPorCategoria = {};
    allTransactions.filter(t => t.tipo === 'despesa').forEach(t => {
        despesasPorCategoria[t.categoria] = (despesasPorCategoria[t.categoria] || 0) + t.valor;
    });
    
    const expensesCtx = document.getElementById('expensesCategoryChart');
    if (expensesCtx) {
        if (expensesCategoryChart) expensesCategoryChart.destroy();
        
        expensesCategoryChart = new Chart(expensesCtx, {
            type: 'pie',
            data: {
                labels: Object.keys(despesasPorCategoria),
                datasets: [{
                    data: Object.values(despesasPorCategoria),
                    backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(ctx.raw)}` } }
                }
            }
        });
    }
}

function updateServicesReport() {
    const tableBody = document.getElementById('servicesTableBody');
    if (!tableBody) return;
    
    if (allCompletedServices.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center">Nenhum serviço concluído no período</td></tr>`;
        document.getElementById('servicesTotal').textContent = formatMoney(0);
        return;
    }
    
    const total = allCompletedServices.reduce((sum, s) => sum + (s.valor_total || 0), 0);
    
    tableBody.innerHTML = allCompletedServices.map(s => `
        <tr>
            <td>${formatDateTime(s.data_hora)}</td>
            <td>${escapeHtml(s.clientes?.nome || '-')}</td>
            <td>${escapeHtml(s.servicos?.nome || '-')}</td>
            <td>${escapeHtml(s.barbeiros?.nome || '-')}</td>
            <td class="text-success">${formatMoney(s.valor_total)}</td>
            <td><span class="status-badge status-concluido">Concluído</span></td>
        </tr>
    `).join('');
    
    document.getElementById('servicesTotal').textContent = formatMoney(total);
}

function updateBarberPerformance() {
    const tableBody = document.getElementById('barberTableBody');
    if (!tableBody) return;
    
    const barberStats = {};
    
    allCompletedServices.forEach(service => {
        const barberId = service.barbeiro_id;
        const barberName = service.barbeiros?.nome || 'Desconhecido';
        if (!barberStats[barberId]) {
            barberStats[barberId] = {
                nome: barberName,
                quantidade: 0,
                total: 0
            };
        }
        barberStats[barberId].quantidade++;
        barberStats[barberId].total += service.valor_total;
    });
    
    const statsArray = Object.values(barberStats);
    
    if (statsArray.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center">Nenhum dado disponível</td></tr>`;
        return;
    }
    
    tableBody.innerHTML = statsArray.map(stat => `
        <tr>
            <td><strong>${escapeHtml(stat.nome)}</strong></td>
            <td>${stat.quantidade}</td>
            <td class="text-success">${formatMoney(stat.total)}</td>
            <td class="text-success">${formatMoney(stat.total * 0.5)}</td>
            <td class="text-success">${formatMoney(stat.total / stat.quantidade)}</td>
        </tr>
    `).join('');
}

// ============================================
// FUNÇÕES DE TRANSAÇÕES
// ============================================

function showTransactionForm(type = 'receita') {
    const formContainer = document.getElementById('transactionFormContainer');
    const formTitle = document.getElementById('transactionFormTitle');
    
    if (!formContainer) return;
    
    if (formTitle) {
        formTitle.innerHTML = type === 'receita' 
            ? '<i class="fas fa-plus-circle"></i> Nova Receita' 
            : '<i class="fas fa-minus-circle"></i> Nova Despesa';
    }
    
    document.getElementById('transactionType').value = type;
    document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
    
    populateCategorySelect();
    loadBarbersForSelect();
    
    formContainer.classList.remove('hidden');
    formContainer.scrollIntoView({ behavior: 'smooth' });
}

function hideTransactionForm() {
    const formContainer = document.getElementById('transactionFormContainer');
    if (formContainer) formContainer.classList.add('hidden');
    document.getElementById('transactionForm')?.reset();
}

function populateCategorySelect() {
    const typeSelect = document.getElementById('transactionType');
    const categorySelect = document.getElementById('transactionCategory');
    const type = typeSelect?.value || 'receita';
    
    const revenueCategories = ['Serviços', 'Produtos', 'Comissões', 'Outros'];
    const expenseCategories = ['Aluguel', 'Salários', 'Produtos', 'Água/Luz', 'Internet', 'Marketing', 'Manutenção', 'Impostos', 'Outros'];
    
    const categories = type === 'receita' ? revenueCategories : expenseCategories;
    
    if (categorySelect) {
        categorySelect.innerHTML = '<option value="">Selecione</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

async function loadBarbersForSelect() {
    try {
        const { data, error } = await supabase
            .from('barbeiros')
            .select('id, nome')
            .eq('barbearia_id', currentBarbeariaId)
            .eq('status', 'ativo');
        
        if (error) throw error;
        
        const barberSelect = document.getElementById('transactionBarber');
        if (barberSelect) {
            barberSelect.innerHTML = '<option value="">Selecione um barbeiro</option>' +
                (data || []).map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
        }
    } catch (error) {
        console.error('Erro ao carregar barbeiros:', error);
    }
}

async function saveTransaction(e) {
    e.preventDefault();
    
    const formData = {
        tipo: document.getElementById('transactionType').value,
        categoria: document.getElementById('transactionCategory').value,
        descricao: document.getElementById('transactionDescription').value,
        valor: parseFloat(document.getElementById('transactionValue').value),
        data_movimento: document.getElementById('transactionDate').value,
        forma_pagamento: document.getElementById('transactionPaymentMethod').value || null,
        barbeiro_id: document.getElementById('transactionBarber').value || null,
        status: 'confirmado',
        barbearia_id: currentBarbeariaId
    };
    
    if (!formData.tipo || !formData.categoria || !formData.descricao || !formData.valor || !formData.data_movimento) {
        showAlert('error', 'Preencha todos os campos obrigatórios');
        return;
    }
    
    if (formData.valor <= 0) {
        showAlert('error', 'O valor deve ser maior que zero');
        return;
    }
    
    try {
        const submitBtn = document.querySelector('#transactionForm button[type="submit"]');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        }
        
        const { error } = await supabase
            .from('financeiro')
            .insert([formData]);
        
        if (error) throw error;
        
        showAlert('success', 'Transação salva com sucesso!');
        hideTransactionForm();
        await loadFinancialData();
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showAlert('error', 'Erro ao salvar transação: ' + error.message);
        
        const submitBtn = document.querySelector('#transactionForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
        }
    }
}

async function showTransactionsList() {
    const container = document.getElementById('transactionsListContainer');
    if (!container) return;
    
    await renderTransactionsTable();
    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth' });
}

function hideTransactionsList() {
    const container = document.getElementById('transactionsListContainer');
    if (container) container.classList.add('hidden');
}

async function renderTransactionsTable() {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;
    
    if (allTransactions.length === 0) {
        tbody.innerHTML = '<td><td colspan="8" class="text-center">Nenhuma transação encontrada</td></tr>';
        document.getElementById('transactionsTotal').textContent = formatMoney(0);
        return;
    }
    
    const total = allTransactions.reduce((sum, t) => sum + t.valor, 0);
    
    tbody.innerHTML = allTransactions.map(t => `
        <tr>
            <td>${formatDate(t.data_movimento)}</td>
            <td><span class="status-badge ${t.tipo === 'receita' ? 'status-receita' : 'status-despesa'}">${t.tipo === 'receita' ? 'Receita' : 'Despesa'}</span></td>
            <td>${escapeHtml(t.categoria)}</td>
            <td>${escapeHtml(t.descricao)}</td>
            <td class="${t.tipo === 'receita' ? 'text-success' : 'text-danger'}">${formatMoney(t.valor)}</td>
            <td>${getPaymentMethodText(t.forma_pagamento)}</td>
            <td><span class="status-badge status-confirmado">${t.status}</span></td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteTransaction('${t.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    
    document.getElementById('transactionsTotal').textContent = formatMoney(total);
}

async function deleteTransaction(id) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
    
    try {
        const { error } = await supabase
            .from('financeiro')
            .delete()
            .eq('id', id)
            .eq('barbearia_id', currentBarbeariaId);
        
        if (error) throw error;
        
        showAlert('success', 'Transação excluída!');
        await loadFinancialData();
        
        if (!document.getElementById('transactionsListContainer')?.classList.contains('hidden')) {
            await renderTransactionsTable();
        }
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showAlert('error', 'Erro ao excluir transação: ' + error.message);
    }
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch {
        return '-';
    }
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '-';
    }
}

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function getPaymentMethodText(method) {
    const methods = {
        'dinheiro': 'Dinheiro',
        'cartao_credito': 'Cartão Crédito',
        'cartao_debito': 'Cartão Débito',
        'pix': 'PIX',
        'transferencia': 'Transferência'
    };
    return methods[method] || method || '-';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(type, message) {
    let alertDiv = document.getElementById('alertMessage');
    
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'alertMessage';
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.insertBefore(alertDiv, mainContent.firstChild);
        }
    }
    
    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type}`;
    alertDiv.classList.remove('hidden');
    
    setTimeout(() => {
        alertDiv.classList.add('hidden');
    }, 5000);
}

function logout() {
    if (confirm('Deseja realmente sair do sistema?')) {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// ============================================
// EXPORTAR FUNÇÕES PARA USO GLOBAL
// ============================================
window.logout = logout;
window.loadFinancialData = loadFinancialData;
window.deleteTransaction = deleteTransaction;
window.showTransactionForm = showTransactionForm;
window.hideTransactionForm = hideTransactionForm;

console.log('✅ Módulo financeiro carregado - VERSÃO SUPABASE');