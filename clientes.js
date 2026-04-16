// Sistema de gerenciamento de clientes - VERSÃO SUPABASE

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
let currentClientId = null;
let allClients = [];

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initializeSupabaseAndClients();
});

async function initializeSupabaseAndClients() {
    console.log('Iniciando sistema de clientes com Supabase...');
    
    try {
        await getCurrentBarbearia();
        await initializeClients();
        updateUserNameDisplay();
    } catch (error) {
        console.error('Erro ao inicializar:', error);
        showAlert('error', 'Erro ao conectar com o banco de dados');
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
// FUNÇÕES PRINCIPAIS
// ============================================

async function initializeClients() {
    if (!currentBarbeariaId) {
        console.error('Barbearia não identificada');
        showAlert('error', 'Erro: Barbearia não identificada');
        return;
    }
    
    console.log('Inicializando sistema de clientes...');
    console.log('🏢 Barbearia atual:', sessionStorage.getItem('currentBarbershopName'));
    
    const newClientBtn = document.getElementById('newClientBtn');
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    const clientForm = document.getElementById('clientForm');
    
    if (newClientBtn) {
        newClientBtn.addEventListener('click', showClientForm);
    }
    
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', hideClientForm);
    }
    
    if (clientForm) {
        clientForm.addEventListener('submit', saveClient);
    }
    
    const searchClient = document.getElementById('searchClient');
    if (searchClient) {
        searchClient.addEventListener('input', searchClients);
    }
    
    await loadClients();
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        showClientForm();
    }
    
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }
    
    console.log('✅ Sistema de clientes inicializado com sucesso!');
}

// ============================================
// CRUD DE CLIENTES
// ============================================

async function loadClients() {
    if (!currentBarbeariaId) {
        console.log('Aguardando barbearia ser carregada...');
        setTimeout(() => loadClients(), 500);
        return;
    }
    
    try {
        console.log(`Carregando clientes da barbearia: ${sessionStorage.getItem('currentBarbershopName')}`);
        
        const tableBody = document.querySelector('#clientsTable tbody');
        if (!tableBody) {
            console.error('Tabela de clientes não encontrada');
            return;
        }
        
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Carregando...</td></tr>';
        
        const { data, error } = await supabase
            .from('clientes')
            .select('*')
            .eq('barbearia_id', currentBarbeariaId)
            .order('nome', { ascending: true });
        
        if (error) throw error;
        
        allClients = data || [];
        tableBody.innerHTML = '';
        
        if (allClients.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center">Nenhum cliente cadastrado</td></tr>`;
            console.log('Nenhum cliente encontrado');
            updateStats();
            return;
        }
        
        console.log(`${allClients.length} cliente(s) encontrado(s)`);
        
        allClients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${escapeHtml(client.nome)}</strong></td>
                <td>${escapeHtml(client.telefone || '-')}</td>
                <td>${escapeHtml(client.email || '-')}</td>
                <td>${client.data_nascimento ? formatDate(client.data_nascimento) : '-'}</td>
                <td>${formatMoney(client.total_gasto || 0)}</td>
                <td>${client.ultima_visita ? formatDateTime(client.ultima_visita) : '-'}</td>
                <td><span class="status-badge ${client.status === 'ativo' ? 'status-active' : 'status-inactive'}">${client.status === 'ativo' ? 'Ativo' : 'Inativo'}</span></td>
                <td class="action-buttons">
                    <button class="btn-action" onclick="editClient('${client.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-danger" onclick="deleteClient('${client.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-action btn-info" onclick="viewClientHistory('${client.id}')" title="Histórico">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        updateStats();
        
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        showAlert('error', 'Erro ao carregar clientes: ' + error.message);
        
        const tableBody = document.querySelector('#clientsTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Erro ao carregar dados. Tente recarregar a página.</td></tr>';
        }
    }
}

function updateStats() {
    const total = allClients.length;
    const active = allClients.filter(c => c.status !== 'inativo').length;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const newThisMonth = allClients.filter(c => {
        if (!c.created_at) return false;
        const createdDate = new Date(c.created_at);
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
    }).length;
    
    const totalElement = document.getElementById('totalClients');
    const activeElement = document.getElementById('activeClients');
    const newElement = document.getElementById('newThisMonth');
    
    if (totalElement) totalElement.textContent = total;
    if (activeElement) activeElement.textContent = active;
    if (newElement) newElement.textContent = newThisMonth;
}

async function saveClient(e) {
    e.preventDefault();
    
    if (!currentBarbeariaId) {
        showAlert('error', 'Erro: Barbearia não identificada');
        return;
    }
    
    try {
        const clientData = {
            nome: document.getElementById('clientName').value.trim(),
            telefone: document.getElementById('clientPhone').value.trim(),
            email: document.getElementById('clientEmail').value.trim() || null,
            cpf: document.getElementById('clientCpf')?.value.trim() || null,
            data_nascimento: document.getElementById('clientBirthdate').value || null,
            observacoes: document.getElementById('clientNotes').value.trim() || null,
            status: document.getElementById('clientStatus')?.value || 'ativo',
            barbearia_id: currentBarbeariaId
        };
        
        if (!clientData.nome) {
            showAlert('error', 'Nome é obrigatório');
            return;
        }
        
        if (!clientData.telefone) {
            showAlert('error', 'Telefone é obrigatório');
            return;
        }
        
        const submitBtn = document.querySelector('#clientForm button[type="submit"]');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        }
        
        let result;
        if (currentClientId) {
            // Atualizar cliente existente
            result = await supabase
                .from('clientes')
                .update({
                    ...clientData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentClientId)
                .eq('barbearia_id', currentBarbeariaId);
            
            if (result.error) throw result.error;
            showAlert('success', 'Cliente atualizado com sucesso!');
        } else {
            // Criar novo cliente
            result = await supabase
                .from('clientes')
                .insert([{
                    ...clientData,
                    total_gasto: 0,
                    created_at: new Date().toISOString()
                }]);
            
            if (result.error) throw result.error;
            showAlert('success', 'Cliente cadastrado com sucesso!');
        }
        
        hideClientForm();
        await loadClients();
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
        
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
        showAlert('error', 'Erro ao salvar cliente: ' + error.message);
        
        const submitBtn = document.querySelector('#clientForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Cliente';
        }
    }
}

async function editClient(id) {
    try {
        console.log('Editando cliente ID:', id);
        
        const client = allClients.find(c => c.id === id);
        if (!client) {
            showAlert('error', 'Cliente não encontrado');
            return;
        }
        
        currentClientId = id;
        
        document.getElementById('clientName').value = client.nome || '';
        document.getElementById('clientPhone').value = client.telefone || '';
        document.getElementById('clientEmail').value = client.email || '';
        document.getElementById('clientCpf').value = client.cpf || '';
        document.getElementById('clientBirthdate').value = client.data_nascimento || '';
        document.getElementById('clientStatus').value = client.status || 'ativo';
        document.getElementById('clientNotes').value = client.observacoes || '';
        
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-user-edit"></i> Editar Cliente';
        }
        
        showClientForm();
        
    } catch (error) {
        console.error('Erro ao carregar cliente:', error);
        showAlert('error', 'Erro ao carregar cliente: ' + error.message);
    }
}

async function deleteClient(id) {
    if (!confirm('Tem certeza que deseja excluir este cliente?\n\nEsta ação não poderá ser desfeita.')) {
        return;
    }
    
    try {
        // Verificar se o cliente tem agendamentos
        const { count, error: countError } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', id)
            .eq('barbearia_id', currentBarbeariaId);
        
        if (countError) throw countError;
        
        if (count > 0) {
            if (!confirm('Este cliente possui agendamentos. Deseja excluí-lo mesmo assim?')) {
                return;
            }
        }
        
        const { error } = await supabase
            .from('clientes')
            .delete()
            .eq('id', id)
            .eq('barbearia_id', currentBarbeariaId);
        
        if (error) throw error;
        
        showAlert('success', 'Cliente excluído com sucesso!');
        await loadClients();
        
    } catch (error) {
        console.error('Erro ao excluir cliente:', error);
        showAlert('error', 'Erro ao excluir cliente: ' + error.message);
    }
}

async function viewClientHistory(id) {
    const client = allClients.find(c => c.id === id);
    if (!client) return;
    
    try {
        const { data: appointments, error } = await supabase
            .from('agendamentos')
            .select(`
                *,
                servicos (nome, preco),
                barbeiros (nome)
            `)
            .eq('cliente_id', id)
            .eq('barbearia_id', currentBarbeariaId)
            .order('data_hora', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        // Criar modal de histórico
        const modalHtml = `
            <div id="historyModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-history"></i> Histórico de ${escapeHtml(client.nome)}</h3>
                        <button class="modal-close" onclick="closeHistoryModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="detail-row">
                            <strong>Total gasto:</strong> ${formatMoney(client.total_gasto || 0)}
                        </div>
                        <div class="detail-row">
                            <strong>Última visita:</strong> ${client.ultima_visita ? formatDateTime(client.ultima_visita) : '-'}
                        </div>
                        <hr>
                        <h4>Últimos agendamentos:</h4>
                        ${appointments && appointments.length > 0 ? appointments.map(apt => `
                            <div class="history-item">
                                <div><strong>${formatDateTime(apt.data_hora)}</strong></div>
                                <div>✂️ ${apt.servicos?.nome || 'Serviço'} - ${formatMoney(apt.valor_total)}</div>
                                <div>👨 ${apt.barbeiros?.nome || 'Barbeiro'}</div>
                                <div>📋 ${getStatusText(apt.status)}</div>
                            </div>
                            <hr>
                        `).join('') : '<p>Nenhum agendamento encontrado</p>'}
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeHistoryModal()">Fechar</button>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal existente se houver
        const existingModal = document.getElementById('historyModal');
        if (existingModal) existingModal.remove();
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        const modal = document.getElementById('historyModal');
        if (modal) modal.classList.remove('hidden');
        
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showAlert('error', 'Erro ao carregar histórico');
    }
}

function closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    if (modal) modal.remove();
}

// ============================================
// FUNÇÕES DE UI
// ============================================

function showClientForm() {
    const formContainer = document.getElementById('clientFormContainer');
    if (formContainer) {
        formContainer.classList.remove('hidden');
        formContainer.scrollIntoView({ behavior: 'smooth' });
        
        const nameField = document.getElementById('clientName');
        if (nameField) nameField.focus();
        
        console.log('Formulário de cliente aberto');
    }
}

function hideClientForm() {
    const formContainer = document.getElementById('clientFormContainer');
    if (formContainer) {
        formContainer.classList.add('hidden');
        currentClientId = null;
        
        const clientForm = document.getElementById('clientForm');
        if (clientForm) clientForm.reset();
        
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-user-plus"></i> Novo Cliente';
        }
        
        document.getElementById('clientStatus').value = 'ativo';
        
        console.log('Formulário de cliente fechado');
    }
}

function searchClients() {
    const searchTerm = document.getElementById('searchClient').value.toLowerCase();
    const rows = document.querySelectorAll('#clientsTable tbody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return '-';
    }
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
        return '-';
    }
}

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function getStatusText(status) {
    const statusMap = {
        'agendado': 'Agendado',
        'confirmado': 'Confirmado',
        'concluido': 'Concluído',
        'cancelado': 'Cancelado'
    };
    return statusMap[status] || status;
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
        const newAlert = document.createElement('div');
        newAlert.id = 'alertMessage';
        newAlert.className = 'alert';
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.prepend(newAlert);
        } else {
            document.body.prepend(newAlert);
        }
        alertDiv = document.getElementById('alertMessage');
    }
    
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.classList.remove('hidden');
        
        setTimeout(() => {
            alertDiv.classList.add('hidden');
        }, 5000);
    }
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
window.editClient = editClient;
window.deleteClient = deleteClient;
window.viewClientHistory = viewClientHistory;
window.closeHistoryModal = closeHistoryModal;
window.logout = logout;

console.log('✅ Módulo de clientes carregado - VERSÃO SUPABASE');