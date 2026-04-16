// Sistema de gerenciamento de agendamentos - VERSÃO SUPABASE

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
let isAdmin = false;
let currentUserBarber = null;
let allAppointments = [];
let filteredAppointments = [];
let clients = [];
let services = [];
let barbers = [];
let currentAppointmentId = null;
let currentWeekStart = null;

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM carregado, inicializando sistema de agendamentos...');
    initializeSupabaseAndAppointments();
});

async function initializeSupabaseAndAppointments() {
    console.log('Iniciando sistema de agendamentos com Supabase...');

    try {
        await getCurrentBarbearia();
        await determineUserType();
        await loadInitialData();
        initializeAppointments();
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
        
        // Se o usuário tem barbearia_id, busca os dados
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

async function determineUserType() {
    try {
        if (currentUser.role === 'admin') {
            isAdmin = true;
            currentUserBarber = null;
            console.log('Usuário identificado como ADMIN');
        } else if (currentUser.role === 'barbeiro') {
            // Buscar dados do barbeiro
            const { data: barbeiro, error } = await supabase
                .from('barbeiros')
                .select('*')
                .eq('id', currentUser.id)
                .single();
            
            if (!error && barbeiro) {
                currentUserBarber = barbeiro.nome;
                isAdmin = false;
                console.log('Usuário identificado como BARBEIRO:', currentUserBarber);
            } else {
                currentUserBarber = null;
                isAdmin = false;
            }
        } else {
            isAdmin = false;
            currentUserBarber = null;
        }
        
        sessionStorage.setItem('isAdmin', isAdmin);
        sessionStorage.setItem('userBarber', currentUserBarber || '');
        
    } catch (error) {
        console.error('Erro ao determinar tipo de usuário:', error);
        isAdmin = false;
        currentUserBarber = null;
    }
}

async function loadInitialData() {
    await Promise.all([
        loadClients(),
        loadServices(),
        loadBarbers(),
        loadAppointments()
    ]);
}

async function loadClients() {
    try {
        const { data, error } = await supabase
            .from('clientes')
            .select('id, nome, telefone')
            .eq('barbearia_id', currentBarbeariaId)
            .eq('status', 'ativo')
            .order('nome');
        
        if (error) throw error;
        
        clients = data || [];
        updateClientSelects();
        console.log(`✅ ${clients.length} cliente(s) carregado(s)`);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function loadServices() {
    try {
        const { data, error } = await supabase
            .from('servicos')
            .select('id, nome, preco, duracao_minutos')
            .eq('barbearia_id', currentBarbeariaId)
            .eq('status', 'ativo')
            .order('nome');
        
        if (error) throw error;
        
        services = data || [];
        updateServiceSelects();
        console.log(`✅ ${services.length} serviço(s) carregado(s)`);
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

async function loadBarbers() {
    try {
        const { data, error } = await supabase
            .from('barbeiros')
            .select('id, nome, especialidade')
            .eq('barbearia_id', currentBarbeariaId)
            .eq('status', 'ativo')
            .order('nome');
        
        if (error) throw error;
        
        barbers = data || [];
        updateBarberSelects();
        updateBarberFilter();
        console.log(`✅ ${barbers.length} barbeiro(s) carregado(s)`);
    } catch (error) {
        console.error('Erro ao carregar barbeiros:', error);
    }
}

async function loadAppointments() {
    try {
        let query = supabase
            .from('agendamentos')
            .select(`
                *,
                clientes!inner (id, nome, telefone),
                barbeiros!inner (id, nome),
                servicos!inner (id, nome, preco)
            `)
            .eq('barbearia_id', currentBarbeariaId);
        
        // Se não for admin, filtrar apenas agendamentos do barbeiro
        if (!isAdmin && currentUserBarber) {
            const barber = barbers.find(b => b.nome === currentUserBarber);
            if (barber) {
                query = query.eq('barbeiro_id', barber.id);
            }
        }
        
        const { data, error } = await query.order('data_hora', { ascending: false });
        
        if (error) throw error;
        
        allAppointments = (data || []).map(apt => ({
            id: apt.id,
            clientId: apt.cliente_id,
            clientName: apt.clientes?.nome || 'Cliente',
            clientPhone: apt.clientes?.telefone || '',
            serviceId: apt.servico_id,
            serviceName: apt.servicos?.nome || 'Serviço',
            servicePrice: apt.servicos?.preco || 0,
            barberId: apt.barbeiro_id,
            barber: apt.barbeiros?.nome || 'Barbeiro',
            date: apt.data_hora?.split('T')[0] || '',
            time: apt.data_hora?.split('T')[1]?.substring(0, 5) || '',
            status: apt.status,
            notes: apt.observacoes || '',
            valor_total: apt.valor_total
        }));
        
        filteredAppointments = [...allAppointments];
        console.log(`✅ ${allAppointments.length} agendamento(s) carregado(s)`);
        
        updateUI();
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        showAlert('error', 'Erro ao carregar agendamentos');
    }
}

// ============================================
// FUNÇÕES DE UI - SELECTS
// ============================================

function updateClientSelects() {
    const selects = document.querySelectorAll('#clientSelect, #appointmentFormContainerClone #clientSelect');
    if (selects.length === 0) return;
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione um cliente</option>';
        
        if (clients.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Nenhum cliente cadastrado';
            option.disabled = true;
            select.appendChild(option);
        } else {
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = `${client.nome}${client.telefone ? ` - ${client.telefone}` : ''}`;
                select.appendChild(option);
            });
        }
        
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

function updateServiceSelects() {
    const selects = document.querySelectorAll('#serviceSelect, #appointmentFormContainerClone #serviceSelect');
    if (selects.length === 0) return;
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione um serviço</option>';
        
        services.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id;
            option.textContent = `${service.nome} - ${formatMoney(service.preco)} (${service.duracao_minutos}min)`;
            option.dataset.price = service.preco;
            select.appendChild(option);
        });
        
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

function updateBarberSelects() {
    const selects = document.querySelectorAll('#barberSelect, #appointmentFormContainerClone #barberSelect');
    if (selects.length === 0) return;
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione um barbeiro</option>';
        
        barbers.forEach(barber => {
            const option = document.createElement('option');
            option.value = barber.id;
            option.textContent = `${barber.nome}${barber.especialidade ? ` - ${barber.especialidade}` : ''}`;
            select.appendChild(option);
        });
        
        if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
            select.value = currentValue;
        }
    });
}

function updateBarberFilter() {
    const filter = document.getElementById('barberFilter');
    if (!filter) return;
    
    if (isAdmin) {
        filter.style.display = 'inline-block';
        filter.innerHTML = '<option value="">Todos os Barbeiros</option>';
        barbers.forEach(barber => {
            const option = document.createElement('option');
            option.value = barber.id;
            option.textContent = barber.nome;
            filter.appendChild(option);
        });
    } else {
        filter.style.display = 'none';
        const label = filter.previousElementSibling;
        if (label && label.tagName === 'STRONG') {
            label.style.display = 'none';
        }
    }
}

function updateUserNameDisplay() {
    const userNameElement = document.getElementById('userName');
    if (userNameElement && currentUser) {
        let text = '';
        if (isAdmin) {
            text = `👑 ADMIN: ${currentUser.email || currentUser.nome}`;
        } else if (currentUserBarber) {
            text = `✂️ ${currentUserBarber}: ${currentUser.email || currentUser.nome}`;
        } else {
            text = currentUser.email || currentUser.nome || 'Usuário';
        }
        
        const barbershopName = sessionStorage.getItem('currentBarbershopName');
        if (barbershopName) {
            text = `🏢 ${barbershopName} | ${text}`;
        }
        
        userNameElement.textContent = text;
        
        if (isAdmin) {
            userNameElement.style.color = '#e74c3c';
            userNameElement.style.fontWeight = 'bold';
        } else if (currentUserBarber) {
            userNameElement.style.color = '#3498db';
            userNameElement.style.fontWeight = 'bold';
        }
    }
}

function updateUI() {
    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }
}

// ============================================
// FUNÇÕES DO FORMULÁRIO
// ============================================

function showAppointmentForm() {
    console.log('📝 Abrindo formulário de agendamento...');
    
    hideAppointmentForm();
    
    const formContainer = document.getElementById('appointmentFormContainer');
    if (!formContainer) {
        console.error('❌ ERRO: Elemento appointmentFormContainer não encontrado!');
        createFormContainer();
        return;
    }
    
    currentAppointmentId = null;

    const overlay = document.createElement('div');
    overlay.id = 'formOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;
    document.body.appendChild(overlay);
    
    const formWrapper = document.createElement('div');
    formWrapper.style.cssText = `
        display: flex;
        justify-content: center;
        align-items: flex-start;
        min-height: 100%;
        width: 100%;
        padding: 20px;
        overflow-y: auto;
    `;
    overlay.appendChild(formWrapper);
    
    const formClone = formContainer.cloneNode(true);
    formClone.id = 'appointmentFormContainerClone';
    formClone.classList.remove('hidden');
    formClone.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 30px;
        width: 100%;
        max-width: 600px;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        position: relative;
        z-index: 1001;
    `;
    
    formWrapper.appendChild(formClone);
    
    // Preencher dados padrão
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
    const timeString = nextHour.getHours().toString().padStart(2, '0') + ':00';
    
    const dateField = formClone.querySelector('#appointmentDate');
    const timeField = formClone.querySelector('#appointmentTime');
    const statusField = formClone.querySelector('#appointmentStatus');
    
    if (dateField) dateField.value = today;
    if (timeField) timeField.value = timeString;
    if (statusField) statusField.value = 'agendado';
    
    // Atualizar selects
    updateClientSelects();
    updateServiceSelects();
    updateBarberSelects();
    
    // Eventos
    const cloneForm = formClone.querySelector('#appointmentForm');
    const cloneCancelBtn = formClone.querySelector('#cancelFormBtn');
    
    if (cloneForm) {
        cloneForm.addEventListener('submit', saveAppointment);
    }
    
    if (cloneCancelBtn) {
        cloneCancelBtn.addEventListener('click', hideAppointmentForm);
    }
    
    // Botão fechar
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        z-index: 1002;
    `;
    closeBtn.onclick = hideAppointmentForm;
    formClone.appendChild(closeBtn);
    
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            hideAppointmentForm();
        }
    });
    
    console.log('✅ Formulário de agendamento aberto');
}

function hideAppointmentForm() {
    const overlay = document.getElementById('formOverlay');
    if (overlay) overlay.remove();
    
    const formClone = document.getElementById('appointmentFormContainerClone');
    if (formClone) formClone.remove();
    
    currentAppointmentId = null;
    console.log('✅ Formulário fechado');
}

function createFormContainer() {
    console.log('🛠️ Criando formulário dinamicamente...');
    
    const overlay = document.createElement('div');
    overlay.id = 'formOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
    `;
    
    const formContainer = document.createElement('div');
    formContainer.id = 'appointmentFormContainer';
    formContainer.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 30px;
        width: 90%;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        position: relative;
        z-index: 1001;
    `;
    
    formContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #2c3e50;">📅 Novo Agendamento</h2>
            <button id="closeFormBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
        </div>
        
        <form id="appointmentForm">
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Cliente *</label>
                <select id="clientSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Selecione um cliente</option>
                </select>
                <small><a href="clientes.html" style="color: #3498db;">Cadastrar novo cliente</a></small>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Serviço *</label>
                <select id="serviceSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Selecione um serviço</option>
                </select>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Barbeiro *</label>
                <select id="barberSelect" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="">Selecione um barbeiro</option>
                </select>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Data *</label>
                    <input type="date" id="appointmentDate" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                </div>
                
                <div>
                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">Horário *</label>
                    <input type="time" id="appointmentTime" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Status</label>
                <select id="appointmentStatus" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <option value="agendado">Agendado</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="concluido">Concluído</option>
                    <option value="cancelado">Cancelado</option>
                </select>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Observações</label>
                <textarea id="appointmentNotes" rows="3" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; resize: vertical;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" id="cancelFormBtn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Cancelar
                </button>
                <button type="submit" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Salvar Agendamento
                </button>
            </div>
        </form>
    `;
    
    overlay.appendChild(formContainer);
    document.body.appendChild(overlay);
    
    document.getElementById('closeFormBtn').addEventListener('click', hideAppointmentForm);
    document.getElementById('cancelFormBtn').addEventListener('click', hideAppointmentForm);
    document.getElementById('appointmentForm').addEventListener('submit', saveAppointment);
    
    setTimeout(() => {
        updateClientSelects();
        updateServiceSelects();
        updateBarberSelects();
        
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const nextHour = new Date(now.getTime() + 60 * 60 * 1000);
        const timeString = nextHour.getHours().toString().padStart(2, '0') + ':00';
        
        const dateField = document.getElementById('appointmentDate');
        const timeField = document.getElementById('appointmentTime');
        
        if (dateField) dateField.value = today;
        if (timeField) timeField.value = timeString;
    }, 100);
    
    console.log('✅ Formulário criado dinamicamente');
}

async function saveAppointment(e) {
    e.preventDefault();
    
    console.log('💾 Salvando agendamento...');
    
    const form = e.target;
    const clientId = form.querySelector('#clientSelect')?.value;
    const serviceId = form.querySelector('#serviceSelect')?.value;
    const barberId = form.querySelector('#barberSelect')?.value;
    const date = form.querySelector('#appointmentDate')?.value;
    const time = form.querySelector('#appointmentTime')?.value;
    const status = form.querySelector('#appointmentStatus')?.value;
    const notes = form.querySelector('#appointmentNotes')?.value;
    
    // Validações
    if (!clientId) {
        showAlert('error', '❌ Selecione um cliente');
        return;
    }
    if (!serviceId) {
        showAlert('error', '❌ Selecione um serviço');
        return;
    }
    if (!barberId) {
        showAlert('error', '❌ Selecione um barbeiro');
        return;
    }
    if (!date) {
        showAlert('error', '❌ Informe a data');
        return;
    }
    if (!time) {
        showAlert('error', '❌ Informe o horário');
        return;
    }
    
    const datetime = `${date}T${time}:00`;
    const service = services.find(s => s.id === serviceId);
    
    if (!service) {
        showAlert('error', '❌ Serviço não encontrado');
        return;
    }
    
    // Verificar conflito de horário
    const isConflict = await checkTimeConflict(barberId, datetime);
    if (isConflict && !currentAppointmentId) {
        showAlert('error', '❌ Horário já ocupado para este barbeiro');
        return;
    }
    
    const appointmentData = {
        cliente_id: clientId,
        servico_id: serviceId,
        barbeiro_id: barberId,
        data_hora: datetime,
        status: status,
        observacoes: notes || null,
        valor_total: service.preco,
        barbearia_id: currentBarbeariaId
    };
    
    try {
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn?.innerHTML;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        }
        
        let result;
        if (currentAppointmentId) {
            // Atualizar agendamento existente
            result = await supabase
                .from('agendamentos')
                .update(appointmentData)
                .eq('id', currentAppointmentId);
        } else {
            // Criar novo agendamento
            result = await supabase
                .from('agendamentos')
                .insert([appointmentData]);
        }
        
        if (result.error) throw result.error;
        
        const client = clients.find(c => c.id === clientId);
        const clientName = client?.nome || 'Cliente';
        
        showAlert('success', 
            `✅ AGENDAMENTO SALVO!\n\n` +
            `👤 Cliente: ${clientName}\n` +
            `✂️ Serviço: ${service.nome}\n` +
            `💰 Valor: ${formatMoney(service.preco)}\n` +
            `📅 Data: ${formatDate(date)}\n` +
            `⏰ Horário: ${time}`
        );
        
        hideAppointmentForm();
        await loadAppointments();
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showAlert('error', '❌ Erro ao salvar agendamento: ' + error.message);
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Agendamento';
        }
    }
}

async function checkTimeConflict(barberId, datetime) {
    try {
        let query = supabase
            .from('agendamentos')
            .select('id')
            .eq('barbeiro_id', barberId)
            .eq('data_hora', datetime)
            .neq('status', 'cancelado');
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        if (currentAppointmentId) {
            return data.filter(a => a.id !== currentAppointmentId).length > 0;
        }
        
        return data.length > 0;
    } catch (error) {
        console.error('Erro ao verificar conflito:', error);
        return false;
    }
}

// ============================================
// FUNÇÕES DE GERENCIAMENTO DE AGENDAMENTOS
// ============================================

async function editAppointment(id) {
    console.log('✏️ Editando agendamento:', id);
    
    const appointment = allAppointments.find(a => a.id === id);
    if (!appointment) {
        showAlert('error', '❌ Agendamento não encontrado');
        return;
    }
    
    currentAppointmentId = id;
    showAppointmentForm();
    
    setTimeout(() => {
        const cloneClientSelect = document.querySelector('#appointmentFormContainerClone #clientSelect');
        const cloneServiceSelect = document.querySelector('#appointmentFormContainerClone #serviceSelect');
        const cloneBarberSelect = document.querySelector('#appointmentFormContainerClone #barberSelect');
        const cloneDateField = document.querySelector('#appointmentFormContainerClone #appointmentDate');
        const cloneTimeField = document.querySelector('#appointmentFormContainerClone #appointmentTime');
        const cloneStatusField = document.querySelector('#appointmentFormContainerClone #appointmentStatus');
        const cloneNotesField = document.querySelector('#appointmentFormContainerClone #appointmentNotes');
        
        if (cloneClientSelect) cloneClientSelect.value = appointment.clientId;
        if (cloneServiceSelect) cloneServiceSelect.value = appointment.serviceId;
        if (cloneBarberSelect) cloneBarberSelect.value = appointment.barberId;
        if (cloneDateField) cloneDateField.value = appointment.date;
        if (cloneTimeField) cloneTimeField.value = appointment.time;
        if (cloneStatusField) cloneStatusField.value = appointment.status;
        if (cloneNotesField) cloneNotesField.value = appointment.notes || '';
        
        console.log('✅ Formulário de edição preenchido');
    }, 200);
}

async function deleteAppointment(id) {
    if (!confirm('🗑️ Tem certeza que deseja EXCLUIR este agendamento?\n\nEsta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const appointment = allAppointments.find(a => a.id === id);
        if (!appointment) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }
        
        const { error } = await supabase
            .from('agendamentos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        showAlert('success', `🗑️ Agendamento de ${appointment.clientName} excluído!`);
        await loadAppointments();
        closeModal();
        
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showAlert('error', '❌ Erro ao excluir agendamento: ' + error.message);
    }
}

async function completeAppointment(id) {
    if (!confirm('✅ Marcar este agendamento como CONCLUÍDO?')) {
        return;
    }
    
    try {
        const appointment = allAppointments.find(a => a.id === id);
        if (!appointment) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }
        
        const { error } = await supabase
            .from('agendamentos')
            .update({ status: 'concluido' })
            .eq('id', id);
        
        if (error) throw error;
        
        showAlert('success', `🎉 Agendamento de ${appointment.clientName} concluído!`);
        await loadAppointments();
        closeModal();
        
    } catch (error) {
        console.error('Erro ao concluir:', error);
        showAlert('error', '❌ Erro ao concluir agendamento: ' + error.message);
    }
}

async function cancelAppointment(id) {
    if (!confirm('🛑 CANCELAR este agendamento?')) {
        return;
    }
    
    try {
        const appointment = allAppointments.find(a => a.id === id);
        if (!appointment) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }
        
        const { error } = await supabase
            .from('agendamentos')
            .update({ status: 'cancelado' })
            .eq('id', id);
        
        if (error) throw error;
        
        showAlert('info', `🛑 Agendamento de ${appointment.clientName} cancelado!`);
        await loadAppointments();
        closeModal();
        
    } catch (error) {
        console.error('Erro ao cancelar:', error);
        showAlert('error', '❌ Erro ao cancelar agendamento: ' + error.message);
    }
}

async function confirmAppointment(id) {
    if (!confirm('✅ CONFIRMAR este agendamento?')) {
        return;
    }
    
    try {
        const appointment = allAppointments.find(a => a.id === id);
        if (!appointment) {
            showAlert('error', '❌ Agendamento não encontrado');
            return;
        }
        
        const { error } = await supabase
            .from('agendamentos')
            .update({ status: 'confirmado' })
            .eq('id', id);
        
        if (error) throw error;
        
        showAlert('success', `✅ Agendamento de ${appointment.clientName} confirmado!`);
        await loadAppointments();
        closeModal();
        
    } catch (error) {
        console.error('Erro ao confirmar:', error);
        showAlert('error', '❌ Erro ao confirmar agendamento: ' + error.message);
    }
}

// ============================================
// FUNÇÕES DA AGENDA VISUAL
// ============================================

function getWeekStart(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    
    const dayOfWeek = d.getDay();
    let daysToMonday;
    if (dayOfWeek === 0) {
        daysToMonday = -6;
    } else if (dayOfWeek === 1) {
        daysToMonday = 0;
    } else {
        daysToMonday = 1 - dayOfWeek;
    }
    
    const monday = new Date(d);
    monday.setDate(d.getDate() + daysToMonday);
    return monday;
}

function updateWeekDisplay() {
    const weekStart = new Date(currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const options = { day: '2-digit', month: 'long' };
    const startStr = weekStart.toLocaleDateString('pt-BR', options);
    const endStr = weekEnd.toLocaleDateString('pt-BR', options);

    const weekRangeElement = document.getElementById('currentWeekRange');
    if (weekRangeElement) {
        weekRangeElement.textContent = `${startStr} - ${endStr}`;
    }

    updateCalendarDays();
    renderCalendar();
}

function updateCalendarDays() {
    const weekStart = new Date(currentWeekStart);
    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    const dayElements = document.querySelectorAll('.calendar-day');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    dayElements.forEach((element, index) => {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + index);
        
        const dayName = days[index];
        const dayNumber = currentDate.getDate();
        const month = currentDate.getMonth() + 1;
        const year = currentDate.getFullYear();

        element.innerHTML = `
            <div style="font-weight: bold; font-size: 0.9rem;">${dayName}</div>
            <div style="font-size: 1.4rem; font-weight: bold; margin: 5px 0;">${dayNumber}</div>
            <div style="font-size: 0.8rem; opacity: 0.7;">${month}/${year.toString().slice(2)}</div>
        `;

        element.classList.remove('today');
        if (currentDate.toDateString() === today.toDateString()) {
            element.classList.add('today');
        }

        element.classList.remove('weekend');
        if (index >= 5) {
            element.classList.add('weekend');
        }
    });
}

function prevWeek() {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    currentWeekStart = newDate;
    updateWeekDisplay();
}

function nextWeek() {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    currentWeekStart = newDate;
    updateWeekDisplay();
}

function goToToday() {
    currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay();
}

function renderCalendar() {
    const calendarBody = document.getElementById('calendarWeekBody');
    if (!calendarBody) return;

    calendarBody.innerHTML = '';

    const appointmentsToShow = filteredAppointments.length > 0 ? filteredAppointments : allAppointments;
    const weekStart = new Date(currentWeekStart);

    for (let hour = 8; hour <= 20; hour++) {
        const hourRow = document.createElement('div');
        hourRow.className = 'calendar-hour-row';

        const hourLabel = document.createElement('div');
        hourLabel.className = 'hour-label';
        hourLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
        hourRow.appendChild(hourLabel);

        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-slot';

            const cellDate = new Date(weekStart);
            cellDate.setDate(weekStart.getDate() + dayIndex);
            
            const year = cellDate.getFullYear();
            const month = String(cellDate.getMonth() + 1).padStart(2, '0');
            const day = String(cellDate.getDate()).padStart(2, '0');
            const dateString = `${year}-${month}-${day}`;
            const datetime = `${dateString}T${hour.toString().padStart(2, '0')}:00:00`;

            const appointmentsForSlot = appointmentsToShow.filter(app => {
                if (!app.date || !app.time) return false;
                const appHour = parseInt(app.time.split(':')[0]);
                return app.date === dateString && appHour === hour;
            });

            appointmentsForSlot.forEach(appointment => {
                const event = createCalendarEvent(appointment);
                cell.appendChild(event);
            });

            hourRow.appendChild(cell);
        }

        calendarBody.appendChild(hourRow);
    }
}

function createCalendarEvent(appointment) {
    const event = document.createElement('div');
    event.className = `appointment-card-calendar ${getStatusClass(appointment.status)}`;
    event.onclick = (e) => {
        e.stopPropagation();
        showAppointmentDetails(appointment);
    };

    const clientName = appointment.clientName.length > 12
        ? appointment.clientName.substring(0, 12) + '...'
        : appointment.clientName;

    event.innerHTML = `
        <strong>${escapeHtml(clientName)}</strong><br>
        ${appointment.time.substring(0, 5)}<br>
        ${appointment.barber ? appointment.barber.substring(0, 8) : ''}
    `;

    event.title = `Cliente: ${appointment.clientName}\nServiço: ${appointment.serviceName}\nBarbeiro: ${appointment.barber}\nHorário: ${appointment.time}\nStatus: ${appointment.status}`;

    return event;
}

function renderAppointmentsList() {
    const appointmentsList = document.getElementById('appointmentsList');
    if (!appointmentsList) return;

    const appointmentsToShow = filteredAppointments.length > 0 ? filteredAppointments : allAppointments;

    if (appointmentsToShow.length === 0) {
        appointmentsList.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Nenhum agendamento encontrado</p><small>Clique em "Novo Agendamento" para começar</small></div>';
        return;
    }

    const weekStart = new Date(currentWeekStart);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekAppointments = appointmentsToShow.filter(app => {
        if (!app.date) return false;
        const appDate = new Date(app.date + 'T00:00:00');
        return appDate >= weekStart && appDate < weekEnd;
    }).sort((a, b) => {
        if (a.date === b.date) return (a.time || '').localeCompare(b.time || '');
        return a.date.localeCompare(b.date);
    });

    if (weekAppointments.length === 0) {
        appointmentsList.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-week"></i><p>Nenhum agendamento para esta semana</p></div>';
        return;
    }

    appointmentsList.innerHTML = weekAppointments.map(appointment => {
        const canManage = isAdmin || (currentUserBarber && appointment.barber === currentUserBarber);
        
        let actionButtons = '';
        if (canManage) {
            actionButtons = `
                <div class="appointment-actions">
                    <button class="btn-action" onclick="event.stopPropagation(); editAppointment('${appointment.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-success" onclick="event.stopPropagation(); confirmAppointment('${appointment.id}')" title="Confirmar">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="btn-action btn-primary" onclick="event.stopPropagation(); completeAppointment('${appointment.id}')" title="Concluir">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-action btn-warning" onclick="event.stopPropagation(); cancelAppointment('${appointment.id}')" title="Cancelar">
                        <i class="fas fa-times"></i>
                    </button>
                    <button class="btn-action btn-danger" onclick="event.stopPropagation(); deleteAppointment('${appointment.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }

        return `
            <div class="appointment-item" onclick="showAppointmentDetails(${JSON.stringify(appointment).replace(/"/g, '&quot;')})">
                <div class="appointment-info">
                    <h4>${escapeHtml(appointment.clientName)}</h4>
                    <div class="appointment-meta">
                        <span><i class="fas fa-scissors"></i> ${appointment.serviceName}</span>
                        <span><i class="fas fa-user-tie"></i> ${appointment.barber}</span>
                        <span><i class="fas fa-calendar"></i> ${formatDate(appointment.date)}</span>
                        <span><i class="fas fa-clock"></i> ${appointment.time}</span>
                    </div>
                    ${appointment.notes ? `<div class="appointment-notes"><i class="fas fa-sticky-note"></i> ${escapeHtml(appointment.notes)}</div>` : ''}
                </div>
                ${actionButtons}
                <div class="appointment-status ${getStatusClass(appointment.status)}">
                    <i class="fas fa-${appointment.status === 'confirmado' ? 'check-circle' : appointment.status === 'concluido' ? 'check' : appointment.status === 'cancelado' ? 'times' : 'calendar'}"></i>
                    ${getStatusText(appointment.status)}
                </div>
            </div>
        `;
    }).join('');
}

function showAppointmentDetails(appointment) {
    const modal = document.getElementById('appointmentModal');
    if (!modal) return;

    window.selectedAppointmentId = appointment.id;
    
    const canManage = isAdmin || (currentUserBarber && appointment.barber === currentUserBarber);

    document.getElementById('modalClientName').textContent = appointment.clientName;
    document.getElementById('modalServiceName').textContent = appointment.serviceName;
    document.getElementById('modalBarber').textContent = appointment.barber;
    document.getElementById('modalDateTime').textContent = `${formatDate(appointment.date)} às ${appointment.time}`;
    document.getElementById('modalStatus').innerHTML = `<span class="status-badge ${getStatusClass(appointment.status)}">${getStatusText(appointment.status)}</span>`;
    document.getElementById('modalValue').textContent = formatMoney(appointment.servicePrice);
    document.getElementById('modalNotes').textContent = appointment.notes || 'Nenhuma';

    // Configurar botões do modal
    const editBtn = document.getElementById('modalEditBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    
    if (editBtn) {
        editBtn.onclick = () => {
            closeModal();
            editAppointment(appointment.id);
        };
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            closeModal();
            cancelAppointment(appointment.id);
        };
    }

    modal.classList.remove('hidden');
}

function closeModal() {
    const modal = document.getElementById('appointmentModal');
    if (modal) modal.classList.add('hidden');
    window.selectedAppointmentId = null;
}

function filterAppointments(filter) {
    if (allAppointments.length === 0) return;

    let filtered = [...allAppointments];
    const today = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    switch (filter) {
        case 'all':
            filtered = [...allAppointments];
            break;
        case 'today':
            filtered = filtered.filter(app => app.date === today);
            break;
        case 'week':
            filtered = filtered.filter(app => {
                if (!app.date) return false;
                const appDate = new Date(app.date + 'T00:00:00');
                return appDate >= weekStart && appDate < weekEnd;
            });
            break;
        case 'confirmed':
            filtered = filtered.filter(app => app.status === 'confirmado');
            break;
        case 'pending':
            filtered = filtered.filter(app => app.status === 'agendado');
            break;
        case 'completed':
            filtered = filtered.filter(app => app.status === 'concluido');
            break;
        case 'canceled':
            filtered = filtered.filter(app => app.status === 'cancelado');
            break;
    }

    filteredAppointments = filtered;

    const barberFilter = document.getElementById('barberFilter');
    if (barberFilter && isAdmin) {
        barberFilter.value = '';
    }

    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }

    if (filter !== 'all') {
        showAlert('info', `Mostrando ${filtered.length} agendamento(s) filtrado(s)`);
    }
}

async function filterByBarber(barberId) {
    if (!barberId) {
        filteredAppointments = [...allAppointments];
    } else {
        filteredAppointments = allAppointments.filter(app => app.barberId === barberId);
    }
    
    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }
}

function clearAllFilters() {
    console.log('Limpando todos os filtros...');
    
    if (isAdmin) {
        const barberFilter = document.getElementById('barberFilter');
        if (barberFilter) barberFilter.value = '';
    }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    
    filteredAppointments = [];
    
    const activeViewBtn = document.querySelector('.view-btn.active');
    if (activeViewBtn && activeViewBtn.dataset.view === 'calendar') {
        renderCalendar();
    } else {
        renderAppointmentsList();
    }
    
    showAlert('info', 'Todos os filtros foram limpos.');
}

function toggleView(view) {
    const calendarContainer = document.querySelector('.calendar-container');
    const appointmentsList = document.querySelector('.appointments-list');
    const appointmentsSection = appointmentsList?.parentElement;

    if (view === 'calendar' && calendarContainer) {
        calendarContainer.style.display = 'block';
        if (appointmentsSection) appointmentsSection.style.display = 'none';
        renderCalendar();
    } else if (appointmentsSection) {
        if (calendarContainer) calendarContainer.style.display = 'none';
        appointmentsSection.style.display = 'block';
        renderAppointmentsList();
    }
}

// ============================================
// INICIALIZAR SISTEMA
// ============================================

function initializeAppointments() {
    console.log('Inicializando sistema de agendamentos...');
    console.log('Tipo de usuário:', isAdmin ? 'ADMIN' : `BARBEIRO (${currentUserBarber})`);
    console.log('🏢 Barbearia atual:', sessionStorage.getItem('currentBarbershopName'));

    // Configurar botões
    const newAppointmentBtn = document.getElementById('newAppointmentBtn');
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    const appointmentForm = document.getElementById('appointmentForm');

    if (newAppointmentBtn) {
        newAppointmentBtn.addEventListener('click', showAppointmentForm);
    }

    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', hideAppointmentForm);
    }

    if (appointmentForm) {
        appointmentForm.addEventListener('submit', saveAppointment);
    }

    // Configurar navegação da semana
    const prevWeekBtn = document.getElementById('prevWeek');
    const nextWeekBtn = document.getElementById('nextWeek');
    const todayBtn = document.getElementById('todayBtn');

    if (prevWeekBtn) prevWeekBtn.addEventListener('click', prevWeek);
    if (nextWeekBtn) nextWeekBtn.addEventListener('click', nextWeek);
    if (todayBtn) todayBtn.addEventListener('click', goToToday);

    // Configurar filtros
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const filter = this.dataset.filter;
            filterAppointments(filter);
        });
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const view = this.dataset.view;
            toggleView(view);
        });
    });

    const barberFilter = document.getElementById('barberFilter');
    if (barberFilter) {
        barberFilter.addEventListener('change', function() {
            filterByBarber(this.value);
        });
    }

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }

    // Inicializar semana
    currentWeekStart = getWeekStart(new Date());
    updateWeekDisplay();

    // Ano no rodapé
    const currentYearElement = document.getElementById('currentYear');
    if (currentYearElement) {
        currentYearElement.textContent = new Date().getFullYear();
    }

    console.log('✅ Sistema de agendamentos inicializado');
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function formatDate(dateString) {
    if (!dateString) return 'Data inválida';
    try {
        const date = new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleDateString('pt-BR');
    } catch (error) {
        return 'Data inválida';
    }
}

function formatMoney(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function getStatusClass(status) {
    switch (status) {
        case 'confirmado': return 'status-confirmado';
        case 'concluido': return 'status-concluido';
        case 'cancelado': return 'status-cancelado';
        default: return 'status-agendado';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'confirmado': return 'Confirmado';
        case 'concluido': return 'Concluído';
        case 'cancelado': return 'Cancelado';
        default: return 'Agendado';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showAlert(type, message) {
    const alertDiv = document.getElementById('alertMessage');
    if (!alertDiv) return;
    
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
window.saveAppointment = saveAppointment;
window.showAppointmentForm = showAppointmentForm;
window.hideAppointmentForm = hideAppointmentForm;
window.editAppointment = editAppointment;
window.deleteAppointment = deleteAppointment;
window.completeAppointment = completeAppointment;
window.cancelAppointment = cancelAppointment;
window.confirmAppointment = confirmAppointment;
window.logout = logout;
window.closeModal = closeModal;
window.filterByBarber = filterByBarber;
window.clearAllFilters = clearAllFilters;
window.showAppointmentDetails = showAppointmentDetails;

console.log('✅ Módulo de agendamentos carregado - VERSÃO SUPABASE');