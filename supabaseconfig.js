// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================
const SUPABASE_URL = 'https://opmpodjqdxtpdolvrzln.supabase.co';
const SUPABASE_KEY = 'sb_publishable_RYuRxp9GWjfyEMwE3bjMCg_lYIJOg5a';
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let currentUser = null;
let currentBarbearia = null;

// ============================================
// FUNÇÕES DE AUTENTICAÇÃO (ADMIN)
// ============================================
async function loginAdmin(email, password) {
    const { data, error } = await supabase
        .from('usuarios_admin')
        .select('*')
        .eq('email', email)
        .single();
    
    if (error || !data) {
        throw new Error('Email ou senha inválidos');
    }
    
    // Verificar senha (em produção use bcrypt)
    if (password !== 'admin123') {
        throw new Error('Senha inválida');
    }
    
    currentUser = data;
    localStorage.setItem('admin_logged', 'true');
    return data;
}

// ============================================
// CRUD BARBEARIAS (ADMIN)
// ============================================
async function criarBarbearia(barbeariaData) {
    const { data, error } = await supabase
        .from('barbearias')
        .insert([barbeariaData])
        .select();
    
    if (error) throw error;
    return data[0];
}

async function listarBarbearias() {
    const { data, error } = await supabase
        .from('barbearias')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
}

async function atualizarBarbearia(id, barbeariaData) {
    const { data, error } = await supabase
        .from('barbearias')
        .update(barbeariaData)
        .eq('id', id)
        .select();
    
    if (error) throw error;
    return data[0];
}

async function deletarBarbearia(id) {
    const { error } = await supabase
        .from('barbearias')
        .delete()
        .eq('id', id);
    
    if (error) throw error;
    return true;
}

// ============================================
// FUNÇÕES PARA BARBEIROS (POR BARBEARIA)
// ============================================
async function criarBarbeiro(barbeiroData) {
    const { data, error } = await supabase
        .from('barbeiros')
        .insert([barbeiroData])
        .select();
    
    if (error) throw error;
    return data[0];
}

async function listarBarbeiros(barbeariaId) {
    const { data, error } = await supabase
        .from('barbeiros')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .order('nome');
    
    if (error) throw error;
    return data;
}

// ============================================
// FUNÇÕES PARA CLIENTES
// ============================================
async function criarCliente(clienteData) {
    const { data, error } = await supabase
        .from('clientes')
        .insert([clienteData])
        .select();
    
    if (error) throw error;
    return data[0];
}

async function listarClientes(barbeariaId) {
    const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .order('ultima_visita', { ascending: false });
    
    if (error) throw error;
    return data;
}

async function buscarClientePorTelefone(telefone, barbeariaId) {
    const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('telefone', telefone)
        .eq('barbearia_id', barbeariaId)
        .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

// ============================================
// FUNÇÕES PARA SERVIÇOS
// ============================================
async function criarServico(servicoData) {
    const { data, error } = await supabase
        .from('servicos')
        .insert([servicoData])
        .select();
    
    if (error) throw error;
    return data[0];
}

async function listarServicos(barbeariaId) {
    const { data, error } = await supabase
        .from('servicos')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .eq('status', 'ativo')
        .order('nome');
    
    if (error) throw error;
    return data;
}

// ============================================
// FUNÇÕES PARA AGENDAMENTOS
// ============================================
async function criarAgendamento(agendamentoData) {
    // Buscar preço do serviço
    const { data: servico } = await supabase
        .from('servicos')
        .select('preco')
        .eq('id', agendamentoData.servico_id)
        .single();
    
    const agendamentoCompleto = {
        ...agendamentoData,
        valor_total: servico.preco
    };
    
    const { data, error } = await supabase
        .from('agendamentos')
        .insert([agendamentoCompleto])
        .select(`
            *,
            barbeiros (nome),
            clientes (nome, telefone),
            servicos (nome, preco)
        `);
    
    if (error) throw error;
    return data[0];
}

async function listarAgendamentos(barbeariaId, data = null) {
    let query = supabase
        .from('agendamentos')
        .select(`
            *,
            barbeiros (nome),
            clientes (nome, telefone),
            servicos (nome, preco)
        `)
        .eq('barbearia_id', barbeariaId)
        .order('data_hora', { ascending: true });
    
    if (data) {
        const startOfDay = `${data}T00:00:00`;
        const endOfDay = `${data}T23:59:59`;
        query = query.gte('data_hora', startOfDay).lte('data_hora', endOfDay);
    }
    
    const { data: resultados, error } = await query;
    if (error) throw error;
    return resultados;
}

async function atualizarStatusAgendamento(id, status) {
    const { data, error } = await supabase
        .from('agendamentos')
        .update({ status: status })
        .eq('id', id)
        .select();
    
    if (error) throw error;
    return data[0];
}

// ============================================
// FUNÇÕES PARA FINANCEIRO
// ============================================
async function registrarTransacaoFinanceira(transacaoData) {
    const { data, error } = await supabase
        .from('financeiro')
        .insert([transacaoData])
        .select();
    
    if (error) throw error;
    return data[0];
}

async function getRelatorioFinanceiro(barbeariaId, startDate, endDate) {
    const { data, error } = await supabase
        .from('financeiro')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .gte('data_movimento', startDate)
        .lte('data_movimento', endDate)
        .order('data_movimento', { ascending: false });
    
    if (error) throw error;
    
    const receitas = data.filter(t => t.tipo === 'receita').reduce((sum, t) => sum + t.valor, 0);
    const despesas = data.filter(t => t.tipo === 'despesa').reduce((sum, t) => sum + t.valor, 0);
    
    return {
        transacoes: data,
        total_receitas: receitas,
        total_despesas: despesas,
        saldo: receitas - despesas
    };
}

// ============================================
// DASHBOARD E ESTATÍSTICAS
// ============================================
async function getDashboardData(barbeariaId) {
    const today = new Date().toISOString().split('T')[0];
    
    // Agendamentos de hoje
    const agendamentosHoje = await listarAgendamentos(barbeariaId, today);
    
    // Total de clientes
    const { count: totalClientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('barbearia_id', barbeariaId);
    
    // Total de barbeiros ativos
    const { count: totalBarbeiros } = await supabase
        .from('barbeiros')
        .select('*', { count: 'exact', head: true })
        .eq('barbearia_id', barbeariaId)
        .eq('status', 'ativo');
    
    // Faturamento do mês
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
    
    const { data: agendamentosMes } = await supabase
        .from('agendamentos')
        .select('valor_total')
        .eq('barbearia_id', barbeariaId)
        .eq('status', 'concluido')
        .gte('data_hora', startOfMonthStr);
    
    const faturamentoMes = agendamentosMes?.reduce((sum, a) => sum + a.valor_total, 0) || 0;
    
    return {
        agendamentos_hoje: agendamentosHoje.length,
        total_clientes: totalClientes || 0,
        total_barbeiros: totalBarbeiros || 0,
        faturamento_mes: faturamentoMes,
        agendamentos_lista: agendamentosHoje
    };
}

// ============================================
// INTERFACE HTML DINÂMICA
// ============================================
function renderAdminPanel() {
    return `
        <div class="admin-panel">
            <h2>Painel Administrativo</h2>
            <button onclick="showCreateBarbearia()">+ Nova Barbearia</button>
            <div id="barbeariasList"></div>
        </div>
    `;
}

async function loadBarbeariasList() {
    const barbearias = await listarBarbearias();
    const container = document.getElementById('barbeariasList');
    
    container.innerHTML = `
        <table class="barbearias-table">
            <thead>
                <tr><th>Nome</th><th>Email</th><th>Telefone</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
                ${barbearias.map(b => `
                    <tr>
                        <td>${b.nome}</td>
                        <td>${b.email}</td>
                        <td>${b.telefone}</td>
                        <td>${b.status}</td>
                        <td>
                            <button onclick="selectBarbearia('${b.id}')">Gerenciar</button>
                            <button onclick="deleteBarbearia('${b.id}')">Excluir</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderBarbeariaPanel(barbearia) {
    return `
        <div class="barbearia-panel">
            <h2>${barbearia.nome}</h2>
            <div class="tabs">
                <button onclick="showTab('dashboard')">Dashboard</button>
                <button onclick="showTab('barbeiros')">Barbeiros</button>
                <button onclick="showTab('clientes')">Clientes</button>
                <button onclick="showTab('servicos')">Serviços</button>
                <button onclick="showTab('agendamentos')">Agendamentos</button>
                <button onclick="showTab('financeiro')">Financeiro</button>
            </div>
            <div id="tabContent"></div>
        </div>
    `;
}

// ============================================
// EXPORTAR FUNÇÕES PARA USO GLOBAL
// ============================================
window.loginAdmin = loginAdmin;
window.criarBarbearia = criarBarbearia;
window.listarBarbearias = listarBarbearias;
window.atualizarBarbearia = atualizarBarbearia;
window.deletarBarbearia = deletarBarbearia;
window.criarBarbeiro = criarBarbeiro;
window.listarBarbeiros = listarBarbeiros;
window.criarCliente = criarCliente;
window.listarClientes = listarClientes;
window.criarServico = criarServico;
window.listarServicos = listarServicos;
window.criarAgendamento = criarAgendamento;
window.listarAgendamentos = listarAgendamentos;
window.registrarTransacaoFinanceira = registrarTransacaoFinanceira;
window.getRelatorioFinanceiro = getRelatorioFinanceiro;
window.getDashboardData = getDashboardData;
window.loadBarbeariasList = loadBarbeariasList;