// Sistema de gerenciamento de serviços - VERSÃO SUPABASE

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
let allServices = [];
let editingServiceId = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Iniciando sistema de serviços com Supabase...');
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
        await loadServices();
        
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
    const newServiceBtn = document.getElementById('newServiceBtn');
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    const serviceForm = document.getElementById('serviceForm');
    const searchService = document.getElementById('searchService');
    
    if (newServiceBtn) {
        newServiceBtn.addEventListener('click', showServiceForm);
    }
    
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', hideServiceForm);
    }
    
    if (serviceForm) {
        serviceForm.addEventListener('submit', saveService);
    }
    
    if (searchService) {
        searchService.addEventListener('input', searchServices);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('action') === 'new') {
        showServiceForm();
    }
}

// ============================================
// CRUD DE SERVIÇOS
// ============================================

async function loadServices() {
    if (!currentBarbeariaId) {
        console.log('Aguardando barbearia...');
        setTimeout(() => loadServices(), 500);
        return;
    }
    
    try {
        const barbershopName = sessionStorage.getItem('currentBarbershopName');
        console.log(`Carregando serviços da barbearia: ${barbershopName}`);
        
        const tableBody = document.getElementById('servicesTableBody');
        if (!tableBody) {
            console.error('Tabela de serviços não encontrada');
            return;
        }
        
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Carregando...</td></tr>';
        
        const { data, error } = await supabase
            .from('servicos')
            .select('*')
            .eq('barbearia_id', currentBarbeariaId)
            .order('nome', { ascending: true });
        
        if (error) throw error;
        
        allServices = data || [];
        tableBody.innerHTML = '';
        
        if (allServices.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center">Nenhum serviço cadastrado</td></tr>`;
            console.log('Nenhum serviço encontrado');
            return;
        }
        
        console.log(`${allServices.length} serviço(s) encontrado(s)`);
        
        allServices.forEach(service => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${escapeHtml(service.nome)}</strong></td>
                <td>${escapeHtml(service.descricao || '-')}</td>
                <td class="text-success">${formatMoney(service.preco)}</td>
                <td>${service.duracao_minutos} min</td>
                <td>${service.categoria || '-'}</td>
                <td>${service.comissao_barbeiro || 50}%</td>
                <td>
                    <span class="status-badge ${service.status === 'ativo' ? 'status-active' : 'status-inactive'}">
                        ${service.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="action-buttons">
                    <button class="btn-action" onclick="editService('${service.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-danger" onclick="deleteService('${service.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                    <button class="btn-action btn-info" onclick="toggleServiceStatus('${service.id}', '${service.status}')" title="${service.status === 'ativo' ? 'Desativar' : 'Ativar'}">
                        <i class="fas fa-${service.status === 'ativo' ? 'ban' : 'check-circle'}"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        showAlert('error', 'Erro ao carregar serviços: ' + error.message);
        
        const tableBody = document.getElementById('servicesTableBody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center">Erro ao carregar dados. Tente recarregar a página.</td></tr>';
        }
    }
}

async function saveService(e) {
    e.preventDefault();
    
    if (!currentBarbeariaId) {
        showAlert('error', 'Erro: Barbearia não identificada');
        return;
    }
    
    try {
        const serviceData = {
            nome: document.getElementById('serviceName').value.trim(),
            descricao: document.getElementById('serviceDescription').value.trim() || null,
            preco: parseFloat(document.getElementById('servicePrice').value),
            duracao_minutos: parseInt(document.getElementById('serviceDuration').value),
            categoria: document.getElementById('serviceCategory').value,
            comissao_barbeiro: parseFloat(document.getElementById('serviceCommission').value) || 50,
            status: document.getElementById('serviceActive').checked ? 'ativo' : 'inativo',
            barbearia_id: currentBarbeariaId
        };
        
        if (!serviceData.nome) {
            showAlert('error', 'Nome do serviço é obrigatório');
            return;
        }
        
        if (!serviceData.preco || serviceData.preco <= 0) {
            showAlert('error', 'Preço deve ser maior que zero');
            return;
        }
        
        if (!serviceData.duracao_minutos || serviceData.duracao_minutos < 5) {
            showAlert('error', 'Duração deve ser de pelo menos 5 minutos');
            return;
        }
        
        const submitBtn = document.querySelector('#serviceForm button[type="submit"]');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        }
        
        let result;
        if (editingServiceId) {
            // Atualizar serviço existente
            result = await supabase
                .from('servicos')
                .update({
                    ...serviceData,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingServiceId)
                .eq('barbearia_id', currentBarbeariaId);
            
            if (result.error) throw result.error;
            showAlert('success', 'Serviço atualizado com sucesso!');
        } else {
            // Criar novo serviço
            result = await supabase
                .from('servicos')
                .insert([{
                    ...serviceData,
                    created_at: new Date().toISOString()
                }]);
            
            if (result.error) throw result.error;
            showAlert('success', 'Serviço cadastrado com sucesso!');
        }
        
        hideServiceForm();
        await loadServices();
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
        
    } catch (error) {
        console.error('Erro ao salvar serviço:', error);
        showAlert('error', 'Erro ao salvar serviço: ' + error.message);
        
        const submitBtn = document.querySelector('#serviceForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Serviço';
        }
    }
}

async function editService(id) {
    try {
        console.log('Editando serviço ID:', id);
        
        const service = allServices.find(s => s.id === id);
        if (!service) {
            showAlert('error', 'Serviço não encontrado');
            return;
        }
        
        editingServiceId = id;
        
        document.getElementById('serviceName').value = service.nome || '';
        document.getElementById('serviceDescription').value = service.descricao || '';
        document.getElementById('servicePrice').value = service.preco || 0;
        document.getElementById('serviceDuration').value = service.duracao_minutos || 30;
        document.getElementById('serviceCategory').value = service.categoria || 'Corte';
        document.getElementById('serviceCommission').value = service.comissao_barbeiro || 50;
        document.getElementById('serviceActive').checked = service.status === 'ativo';
        
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Serviço';
        }
        
        showServiceForm();
        
    } catch (error) {
        console.error('Erro ao carregar serviço:', error);
        showAlert('error', 'Erro ao carregar serviço: ' + error.message);
    }
}

async function deleteService(id) {
    if (!confirm('Tem certeza que deseja excluir este serviço?\n\nEsta ação não poderá ser desfeita.')) {
        return;
    }
    
    try {
        // Verificar se o serviço tem agendamentos
        const { count, error: countError } = await supabase
            .from('agendamentos')
            .select('*', { count: 'exact', head: true })
            .eq('servico_id', id)
            .eq('barbearia_id', currentBarbeariaId);
        
        if (countError) throw countError;
        
        if (count > 0) {
            if (!confirm('Este serviço possui agendamentos. Deseja excluí-lo mesmo assim?\n\nOs agendamentos serão afetados.')) {
                return;
            }
        }
        
        const { error } = await supabase
            .from('servicos')
            .delete()
            .eq('id', id)
            .eq('barbearia_id', currentBarbeariaId);
        
        if (error) throw error;
        
        showAlert('success', 'Serviço excluído com sucesso!');
        await loadServices();
        
    } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        showAlert('error', 'Erro ao excluir serviço: ' + error.message);
    }
}

async function toggleServiceStatus(id, currentStatus) {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    const action = newStatus === 'ativo' ? 'ativar' : 'desativar';
    
    if (!confirm(`Tem certeza que deseja ${action} este serviço?`)) {
        return;
    }
    
    try {
        const { error } = await supabase
            .from('servicos')
            .update({ 
                status: newStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('barbearia_id', currentBarbeariaId);
        
        if (error) throw error;
        
        showAlert('success', `Serviço ${action}do com sucesso!`);
        await loadServices();
        
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        showAlert('error', 'Erro ao alterar status do serviço: ' + error.message);
    }
}

// ============================================
// FUNÇÕES DE UI
// ============================================

function showServiceForm() {
    const formContainer = document.getElementById('serviceFormContainer');
    if (formContainer) {
        formContainer.classList.remove('hidden');
        formContainer.scrollIntoView({ behavior: 'smooth' });
        
        const nameField = document.getElementById('serviceName');
        if (nameField) nameField.focus();
        
        console.log('Formulário de serviço aberto');
    }
}

function hideServiceForm() {
    const formContainer = document.getElementById('serviceFormContainer');
    if (formContainer) {
        formContainer.classList.add('hidden');
        editingServiceId = null;
        
        const serviceForm = document.getElementById('serviceForm');
        if (serviceForm) serviceForm.reset();
        
        const formTitle = document.getElementById('formTitle');
        if (formTitle) {
            formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Novo Serviço';
        }
        
        document.getElementById('serviceDuration').value = '30';
        document.getElementById('serviceCommission').value = '50';
        document.getElementById('serviceActive').checked = true;
        
        console.log('Formulário de serviço fechado');
    }
}

function searchServices() {
    const searchTerm = document.getElementById('searchService').value.toLowerCase();
    const rows = document.querySelectorAll('#servicesTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
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
window.editService = editService;
window.deleteService = deleteService;
window.toggleServiceStatus = toggleServiceStatus;
window.logout = logout;

console.log('✅ Módulo de serviços carregado - VERSÃO SUPABASE');