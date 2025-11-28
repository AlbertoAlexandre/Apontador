// APONTADOR - JavaScript Principal

const API_BASE = '/api';

// Estado da aplicação
let obras = [];
let servicos = [];
let locais = [];
let veiculos = [];
let viagens = [];
let profissionais = [];
let usuarios = [];
let currentUser = null;
let servicosSelecionados = [];
let locaisSelecionados = [];
let obraLocais = [];
let ocorrencias = [];
let climaData = [];
let mesAtual = new Date().getMonth();
let anoAtual = new Date().getFullYear();

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Verificar se está na página de login
    if (window.location.pathname.includes('login.html')) {
        return;
    }
    
    // Tentar verificar autenticação, mas não bloquear se falhar
    verificarAutenticacao().catch(() => {
        // Se falhar, inicializar sem autenticação (modo compatibilidade)
        inicializarSemAuth();
    });
});

// Inicializar sem autenticação (compatibilidade)
function inicializarSemAuth() {
    currentUser = { 
        nome: 'Usuário', 
        permissoes: {
            dashboard: true,
            registrar_viagem: true,
            obras: true,
            veiculo: true,
            profissionais: true,
            diaria: true,
            painel_controle: true,
            visualizar_ocorrencias_transportes: true,
            visualizar_clima_tempo: true
        }
    };
    
    document.getElementById('userName').textContent = 'Usuário';
    inicializarApp();
}

// Verificar autenticação
async function verificarAutenticacao() {
    try {
        const response = await fetch(`${API_BASE}/session`);
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('userName').textContent = currentUser.nome;
            configurarPermissoes();
            inicializarApp();
        } else {
            throw new Error('Não autenticado');
        }
    } catch (error) {
        throw error;
    }
}

// Configurar permissões de acesso
function configurarPermissoes() {
    const permissoes = currentUser.permissoes;
    
    // Ocultar itens de menu sem permissão
    document.getElementById('nav-dashboard').style.display = permissoes.dashboard ? 'block' : 'none';
    document.getElementById('nav-viagens').style.display = permissoes.registrar_viagem ? 'block' : 'none';
    document.getElementById('nav-obras').style.display = permissoes.obras ? 'block' : 'none';
    document.getElementById('nav-veiculos').style.display = permissoes.veiculo ? 'block' : 'none';
    document.getElementById('nav-profissionais').style.display = permissoes.profissionais ? 'block' : 'none';
    document.getElementById('nav-diarias').style.display = permissoes.diaria ? 'block' : 'none';
    document.getElementById('nav-ocorrencias').style.display = permissoes.visualizar_ocorrencias_transportes ? 'block' : 'none';
    document.getElementById('nav-clima').style.display = permissoes.visualizar_clima_tempo ? 'block' : 'none';
    document.getElementById('nav-painel').style.display = permissoes.painel_controle ? 'block' : 'none';
}

// Inicializar aplicação após autenticação
function inicializarApp() {
    carregarDados();
    configurarFormularios();
    
    // Mostrar primeira seção disponível
    if (currentUser.permissoes.dashboard) {
        showSection('dashboard');
    } else if (currentUser.permissoes.registrar_viagem) {
        showSection('viagens');
    } else if (currentUser.permissoes.obras) {
        showSection('obras');
    } else if (currentUser.permissoes.veiculo) {
        showSection('veiculos');
    } else if (currentUser.permissoes.profissionais) {
        showSection('profissionais');
    } else if (currentUser.permissoes.diaria) {
        showSection('diarias');
    }
    
    // Definir data atual como padrão
    const dataViagem = document.getElementById('dataViagem');
    if (dataViagem) {
        dataViagem.valueAsDate = new Date();
    }
}

// Logout
async function logout() {
    try {
        await fetch(`${API_BASE}/logout`, { method: 'POST' });
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    } catch (error) {
        window.location.href = '/login.html';
    }
}

// Navegação entre seções
function showSection(sectionName) {
    // Esconder todas as seções
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Mostrar seção selecionada
    document.getElementById(sectionName + '-section').style.display = 'block';
    
    // Atualizar dados da seção
    switch(sectionName) {
        case 'obras':
            // Forçar novo layout se ainda estiver com o antigo
            const obraSection = document.getElementById('obras-section');
            if (obraSection && !obraSection.querySelector('.selection-boxes')) {
                obraSection.innerHTML = `
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-building"></i> Cadastrar Obra</h5>
                        </div>
                        <div class="card-body">
                            <form id="obraForm">
                                <div class="mb-4">
                                    <label class="form-label fw-bold">NOME DA OBRA</label>
                                    <input type="text" class="form-control form-control-lg" id="nomeObra" placeholder="Digite o nome da obra" required>
                                </div>
                                <div class="mb-4">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <label class="form-label fw-bold mb-0">SERVIÇOS</label>
                                        <div class="input-group" style="width: 300px;">
                                            <input type="text" class="form-control" id="novoServico" placeholder="Adicionar novo serviço">
                                            <button type="button" class="btn btn-success" onclick="adicionarNovoServico()">
                                                <i class="fas fa-plus"></i> Adicionar
                                            </button>
                                        </div>
                                    </div>
                                    <div id="servicosBoxes" class="selection-boxes"></div>
                                </div>
                                <div class="mb-4">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <label class="form-label fw-bold mb-0">LOCAIS</label>
                                        <div class="input-group" style="width: 300px;">
                                            <input type="text" class="form-control" id="novoLocal" placeholder="Adicionar novo local">
                                            <button type="button" class="btn btn-success" onclick="adicionarNovoLocal()">
                                                <i class="fas fa-plus"></i> Adicionar
                                            </button>
                                        </div>
                                    </div>
                                    <div id="locaisBoxes" class="selection-boxes"></div>
                                </div>
                                <div class="text-center mb-4">
                                    <button type="submit" class="btn btn-primary btn-lg px-5">
                                        <i class="fas fa-save"></i> SALVAR OBRA
                                    </button>
                                </div>
                            </form>
                            <div class="mt-5">
                                <h6 class="fw-bold mb-3">OBRAS CADASTRADAS</h6>
                                <div class="table-responsive">
                                    <table class="table table-striped table-hover">
                                        <thead class="table-dark">
                                            <tr><th>OBRA</th><th>SERVIÇOS</th><th>LOCAIS</th></tr>
                                        </thead>
                                        <tbody id="listaObrasTabela">
                                            <tr><td colspan="3" class="text-center text-muted">Nenhuma obra cadastrada</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                // Reconfigurar form
                document.getElementById('obraForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    await salvarObra();
                });
            }
            setTimeout(() => {
                carregarServicos();
                carregarLocais();
                listarObras();
            }, 100);
            break;
        case 'veiculos':
            listarVeiculos();
            break;
        case 'diarias':
            carregarDiarias();
            carregarFiltros();
            break;
        case 'profissionais':
            listarProfissionais();
            break;
        case 'viagens':
            carregarViagensRecentes();
            break;
        case 'dashboard':
            carregarDashboard();
            break;
        case 'painel':
            if (typeof carregarPainelControle === 'function') {
                carregarPainelControle();
            }
            break;
        case 'ocorrencias':
            carregarOcorrenciasRecentes();
            break;
        case 'clima':
            carregarClimaData();
            atualizarCalendario();
            break;
    }
}

// Configurar formulários
function configurarFormularios() {
    // Formulário de viagem
    document.getElementById('viagemForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvarViagem();
    });
    
    // Formulário de obra
    document.getElementById('obraForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvarObra();
    });
    
    // Formulário de veículo
    document.getElementById('veiculoForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvarVeiculo();
    });
    
    // Formulário de profissional
    document.getElementById('profissionalForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvarProfissional();
    });
    
    // Formulário de ocorrência
    document.getElementById('ocorrenciaForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvarOcorrencia();
    });
    
    // Formulário de clima
    document.getElementById('climaForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        await salvarClima();
    });
}

// Carregar dados iniciais
async function carregarDados() {
    try {
        const promises = [];
        
        if (currentUser.permissoes.obras || currentUser.permissoes.registrar_viagem) {
            promises.push(carregarObras());
            promises.push(carregarServicos());
            promises.push(carregarLocais());
        }
        if (currentUser.permissoes.veiculo || currentUser.permissoes.registrar_viagem) {
            promises.push(carregarVeiculos());
        }
        if (currentUser.permissoes.registrar_viagem || currentUser.permissoes.dashboard) {
            promises.push(carregarViagensRecentes());
        }
        if (currentUser.permissoes.profissionais || currentUser.permissoes.painel_controle) {
            promises.push(carregarProfissionais());
        }
        if (currentUser.permissoes.visualizar_ocorrencias_transportes || currentUser.permissoes.visualizar_clima_tempo) {
            promises.push(carregarObraLocais());
        }
        
        await Promise.all(promises);
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        if (error.message.includes('401')) {
            window.location.href = '/login.html';
        } else {
            mostrarAlerta('Erro ao carregar dados', 'danger');
        }
    }
}

// OBRAS
async function carregarObras() {
    try {
        const response = await fetch(`${API_BASE}/obras`);
        obras = await response.json();
        
        const select = document.getElementById('obraSelect');
        if (select) {
            select.innerHTML = '<option value="">Selecione uma obra</option>';
            
            obras.forEach(obra => {
                const option = document.createElement('option');
                option.value = obra.id_obra;
                option.textContent = obra.nome_obra;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar obras:', error);
    }
}

async function carregarServicos() {
    try {
        const response = await fetch(`${API_BASE}/servicos`);
        servicos = await response.json();
        renderizarServicosBoxes();
    } catch (error) {
        console.error('Erro ao carregar serviços:', error);
    }
}

function renderizarServicosBoxes() {
    const container = document.getElementById('servicosBoxes');
    if (!container) return;
    
    container.innerHTML = '';
    servicos.forEach(servico => {
        const box = document.createElement('div');
        box.className = `selection-box ${servicosSelecionados.includes(servico.nome_servico) ? 'selected' : ''}`;
        box.onclick = () => toggleServico(servico.nome_servico);
        box.innerHTML = `
            ${servico.nome_servico}
            <button class="edit-btn" onclick="event.stopPropagation(); editarServico('${servico.nome_servico}')" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn" onclick="event.stopPropagation(); excluirServico('${servico.nome_servico}')" title="Excluir">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(box);
    });
}

async function carregarLocais() {
    try {
        const response = await fetch(`${API_BASE}/locais`);
        locais = await response.json();
        renderizarLocaisBoxes();
    } catch (error) {
        console.error('Erro ao carregar locais:', error);
    }
}

function renderizarLocaisBoxes() {
    const container = document.getElementById('locaisBoxes');
    if (!container) return;
    
    container.innerHTML = '';
    locais.forEach(local => {
        const box = document.createElement('div');
        box.className = `selection-box ${locaisSelecionados.includes(local.nome_local) ? 'selected' : ''}`;
        box.onclick = () => toggleLocal(local.nome_local);
        box.innerHTML = `
            ${local.nome_local}
            <button class="edit-btn" onclick="event.stopPropagation(); editarLocal('${local.nome_local}')" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn" onclick="event.stopPropagation(); excluirLocal('${local.nome_local}')" title="Excluir">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(box);
    });
}

async function carregarServicosLocais() {
    const nomeObra = document.getElementById('obraSelect').value;
    const servicoSelect = document.getElementById('servicoSelect');
    const localSelect = document.getElementById('localSelect');
    const veiculoSelect = document.getElementById('veiculoSelect');
    
    servicoSelect.innerHTML = '<option value="">Selecione um serviço</option>';
    localSelect.innerHTML = '<option value="">Selecione um local</option>';
    
    if (nomeObra) {
        const obrasFiltered = obras.filter(o => o.nome_obra === nomeObra);
        
        const servicosUnicos = [...new Set(obrasFiltered.map(o => o.servico))];
        servicosUnicos.forEach(servico => {
            const option = document.createElement('option');
            option.value = servico;
            option.textContent = servico;
            servicoSelect.appendChild(option);
        });
        
        const locaisUnicos = [...new Set(obrasFiltered.map(o => o.local))];
        locaisUnicos.forEach(local => {
            const option = document.createElement('option');
            option.value = local;
            option.textContent = local;
            localSelect.appendChild(option);
        });
        
        // Carregar veículos filtrados por obra
        await carregarVeiculosPorObra(nomeObra);
    } else {
        // Se nenhuma obra selecionada, carregar todos os veículos
        await carregarVeiculos();
    }
}

async function carregarVeiculosPorObra(obra) {
    try {
        const response = await fetch(`${API_BASE}/veiculos-por-obra?obra=${encodeURIComponent(obra)}`);
        const veiculosObra = await response.json();
        
        const veiculoSelect = document.getElementById('veiculoSelect');
        veiculoSelect.innerHTML = '<option value="">Selecione um veículo</option>';
        
        veiculosObra.forEach(veiculo => {
            const option = document.createElement('option');
            option.value = veiculo.id_veiculo;
            option.textContent = `${veiculo.veiculo} - ${veiculo.placa} (${veiculo.motorista})`;
            veiculoSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar veículos por obra:', error);
    }
}

function toggleServico(servico) {
    const index = servicosSelecionados.indexOf(servico);
    if (index > -1) {
        servicosSelecionados.splice(index, 1);
    } else {
        servicosSelecionados.push(servico);
    }
    renderizarServicosBoxes();
}

function adicionarNovoServico() {
    const input = document.getElementById('novoServico');
    const servico = input.value.trim();
    if (servico && !servicos.some(s => s.nome_servico === servico)) {
        servicos.push({ id_servico: Date.now(), nome_servico: servico });
        servicosSelecionados.push(servico);
        renderizarServicosBoxes();
        input.value = '';
        mostrarAlerta('Serviço adicionado com sucesso!', 'success');
    } else if (servico) {
        mostrarAlerta('Serviço já existe!', 'warning');
    }
}

function toggleLocal(local) {
    const index = locaisSelecionados.indexOf(local);
    if (index > -1) {
        locaisSelecionados.splice(index, 1);
    } else {
        locaisSelecionados.push(local);
    }
    renderizarLocaisBoxes();
}

function adicionarNovoLocal() {
    const input = document.getElementById('novoLocal');
    const local = input.value.trim();
    if (local && !locais.some(l => l.nome_local === local)) {
        locais.push({ id_local: Date.now(), nome_local: local });
        locaisSelecionados.push(local);
        renderizarLocaisBoxes();
        input.value = '';
        mostrarAlerta('Local adicionado com sucesso!', 'success');
    } else if (local) {
        mostrarAlerta('Local já existe!', 'warning');
    }
}



async function salvarObra() {
    const nomeObra = document.getElementById('nomeObra').value.trim();
    
    if (!nomeObra) {
        mostrarAlerta('Nome da obra é obrigatório', 'warning');
        return;
    }
    
    if (servicosSelecionados.length === 0) {
        mostrarAlerta('Selecione pelo menos um serviço', 'warning');
        return;
    }
    
    if (locaisSelecionados.length === 0) {
        mostrarAlerta('Selecione pelo menos um local', 'warning');
        return;
    }
    
    const dados = {
        nome_obra: nomeObra,
        servicos: servicosSelecionados,
        locais: locaisSelecionados
    };
    
    try {
        const response = await fetch(`${API_BASE}/obras`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            mostrarAlerta('Obra cadastrada com sucesso!', 'success');
            document.getElementById('obraForm').reset();
            servicosSelecionados = [];
            locaisSelecionados = [];
            renderizarServicosBoxes();
            renderizarLocaisBoxes();
            await carregarObras();
            await carregarServicos();
            await carregarLocais();
            listarObras();
        }
    } catch (error) {
        mostrarAlerta('Erro ao salvar obra', 'danger');
    }
}

function listarObras() {
    const tbody = document.getElementById('listaObrasTabela');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (obras.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Nenhuma obra cadastrada</td></tr>';
        return;
    }
    
    obras.forEach(obra => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${obra.nome_obra}</strong></td>
            <td>${obra.servicos || 'Nenhum serviço'}</td>
            <td>${obra.locais || 'Nenhum local'}</td>
        `;
        tbody.appendChild(row);
    });
}

async function excluirObra(id) {
    if (!confirm('Tem certeza que deseja excluir esta obra?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/obras/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            mostrarAlerta('Obra excluída com sucesso!', 'success');
            await carregarObras();
            listarObras();
        }
    } catch (error) {
        mostrarAlerta('Erro ao excluir obra', 'danger');
    }
}

// VEÍCULOS
async function carregarVeiculos() {
    try {
        const response = await fetch(`${API_BASE}/veiculos`);
        veiculos = await response.json();
        
        const select = document.getElementById('veiculoSelect');
        select.innerHTML = '<option value="">Selecione um veículo</option>';
        
        veiculos.forEach(veiculo => {
            const option = document.createElement('option');
            option.value = veiculo.id_veiculo;
            option.textContent = `${veiculo.veiculo} - ${veiculo.placa} (${veiculo.motorista})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar veículos:', error);
    }
}

async function salvarVeiculo() {
    const dados = {
        veiculo: document.getElementById('nomeVeiculo').value,
        placa: document.getElementById('placaVeiculo').value,
        cubagem_m3: parseFloat(document.getElementById('cubagemVeiculo').value),
        motorista: document.getElementById('motoristaVeiculo').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/veiculos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            mostrarAlerta('Veículo cadastrado com sucesso!', 'success');
            document.getElementById('veiculoForm').reset();
            await carregarVeiculos();
            listarVeiculos();
        }
    } catch (error) {
        mostrarAlerta('Erro ao salvar veículo', 'danger');
    }
}

function listarVeiculos() {
    const lista = document.getElementById('listaVeiculos');
    lista.innerHTML = '';
    
    veiculos.forEach(veiculo => {
        const item = document.createElement('div');
        item.className = 'viagem-item';
        item.innerHTML = `
            <strong>${veiculo.veiculo}</strong> - ${veiculo.placa}<br>
            <small>Motorista: ${veiculo.motorista}</small><br>
            <small>Cubagem: ${veiculo.cubagem_m3} m³</small>
        `;
        lista.appendChild(item);
    });
}

// VIAGENS
async function salvarViagem() {
    const obraId = document.getElementById('obraSelect').value;
    const servicoId = document.getElementById('servicoSelect').value;
    const localId = document.getElementById('localSelect').value;
    const veiculoId = document.getElementById('veiculoSelect').value;
    
    if (!obraId) {
        mostrarAlerta('Selecione uma obra', 'warning');
        return;
    }
    if (!servicoId) {
        mostrarAlerta('Selecione um serviço', 'warning');
        return;
    }
    if (!localId) {
        mostrarAlerta('Selecione um local', 'warning');
        return;
    }
    if (!veiculoId) {
        mostrarAlerta('Selecione um veículo', 'warning');
        return;
    }
    
    const dados = {
        id_obra: parseInt(obraId),
        id_servico: parseInt(servicoId),
        id_local: parseInt(localId),
        id_veiculo: parseInt(veiculoId),
        data: document.getElementById('dataViagem').value,
        quantidade_viagens: parseInt(document.getElementById('quantidadeViagens').value)
    };
    
    try {
        const response = await fetch(`${API_BASE}/viagens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            mostrarAlerta('Viagem registrada com sucesso!', 'success');
            document.getElementById('viagemForm').reset();
            document.getElementById('dataViagem').valueAsDate = new Date();
            document.getElementById('servicoSelect').innerHTML = '<option value="">Selecione um serviço</option>';
            document.getElementById('localSelect').innerHTML = '<option value="">Selecione um local</option>';
            await carregarViagensRecentes();
        } else {
            const error = await response.json();
            mostrarAlerta(`Erro: ${error.error || 'Erro desconhecido'}`, 'danger');
        }
    } catch (error) {
        console.error('Erro ao salvar viagem:', error);
        mostrarAlerta('Erro ao salvar viagem', 'danger');
    }
}

async function carregarViagensRecentes() {
    try {
        const response = await fetch(`${API_BASE}/viagens`);
        viagens = await response.json();
        
        const container = document.getElementById('viagensRecentes');
        container.innerHTML = '';
        
        // Mostrar apenas as 5 viagens mais recentes
        viagens.slice(0, 5).forEach(viagem => {
            const item = document.createElement('div');
            item.className = 'viagem-item';
            item.innerHTML = `
                <strong>${viagem.veiculo}</strong><br>
                <small>${viagem.nome_obra}</small><br>
                <small>${formatarData(viagem.data)} - ${viagem.quantidade_viagens} viagens</small>
            `;
            container.appendChild(item);
        });
    } catch (error) {
        console.error('Erro ao carregar viagens:', error);
    }
}

// DIÁRIAS
async function carregarDiarias() {
    try {
        const response = await fetch(`${API_BASE}/diarias`);
        const diarias = await response.json();
        exibirDiarias(diarias);
    } catch (error) {
        console.error('Erro ao carregar diárias:', error);
    }
}

function exibirDiarias(diarias) {
    const tbody = document.getElementById('corpoTabelaDiarias');
    tbody.innerHTML = '';
    
    let totalViagens = 0;
    let totalVolume = 0;
    
    diarias.forEach(diaria => {
        const row = document.createElement('tr');
        const viagens = diaria.total_viagens || 0;
        const volume = diaria.volume_total || 0;
        
        totalViagens += viagens;
        totalVolume += volume;
        
        row.innerHTML = `
            <td>${diaria.veiculo}</td>
            <td>${diaria.placa}</td>
            <td>${diaria.motorista}</td>
            <td>${diaria.cubagem_m3}</td>
            <td class="text-center">${viagens}</td>
            <td class="text-end">${volume.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Adicionar linha de totais
    const totalRow = document.createElement('tr');
    totalRow.className = 'table-warning fw-bold';
    totalRow.innerHTML = `
        <td colspan="4">TOTAIS</td>
        <td class="text-center">${totalViagens}</td>
        <td class="text-end">${totalVolume.toFixed(2)}</td>
    `;
    tbody.appendChild(totalRow);
}

async function carregarFiltros() {
    try {
        const [obrasResp, veiculosResp] = await Promise.all([
            fetch(`${API_BASE}/obras`),
            fetch(`${API_BASE}/veiculos`)
        ]);
        
        const obras = await obrasResp.json();
        const veiculos = await veiculosResp.json();
        
        // Carregar filtros de obra
        const selectObra = document.getElementById('selectObra');
        if (selectObra) {
            selectObra.innerHTML = '';
            [...new Set(obras.map(o => o.nome_obra))].forEach(obra => {
                const option = document.createElement('option');
                option.value = obra;
                option.textContent = obra;
                selectObra.appendChild(option);
            });
        }
        
        // Carregar filtros de veículo
        const selectVeiculo = document.getElementById('selectVeiculo');
        if (selectVeiculo) {
            selectVeiculo.innerHTML = '';
            veiculos.forEach(v => {
                const option = document.createElement('option');
                option.value = v.veiculo;
                option.textContent = v.veiculo;
                selectVeiculo.appendChild(option);
            });
        }
        
        // Carregar filtros de motorista
        const selectMotorista = document.getElementById('selectMotorista');
        if (selectMotorista) {
            selectMotorista.innerHTML = '';
            [...new Set(veiculos.map(v => v.motorista))].forEach(m => {
                const option = document.createElement('option');
                option.value = m;
                option.textContent = m;
                selectMotorista.appendChild(option);
            });
        }
        
        // Carregar filtros de serviço
        const selectServico = document.getElementById('selectServico');
        if (selectServico) {
            selectServico.innerHTML = '';
            [...new Set(obras.map(o => o.servico))].forEach(s => {
                const option = document.createElement('option');
                option.value = s;
                option.textContent = s;
                selectServico.appendChild(option);
            });
        }
        
        // Carregar filtros de local
        const selectLocal = document.getElementById('selectLocal');
        if (selectLocal) {
            selectLocal.innerHTML = '';
            [...new Set(obras.map(o => o.local))].forEach(l => {
                const option = document.createElement('option');
                option.value = l;
                option.textContent = l;
                selectLocal.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Erro ao carregar filtros:', error);
    }
}

function aplicarFiltros() {
    ['Veiculo', 'Obra', 'Motorista', 'Servico', 'Local'].forEach(tipo => {
        const checkbox = document.getElementById(`filtro${tipo}`);
        const select = document.getElementById(`select${tipo}`);
        select.style.display = checkbox.checked ? 'block' : 'none';
    });
    
    const filtros = {};
    ['Veiculo', 'Obra', 'Motorista', 'Servico', 'Local'].forEach(tipo => {
        const checkbox = document.getElementById(`filtro${tipo}`);
        const select = document.getElementById(`select${tipo}`);
        if (checkbox.checked && select.selectedOptions.length > 0) {
            filtros[tipo.toLowerCase()] = Array.from(select.selectedOptions).map(o => o.value);
        }
    });
    
    // Se obra foi selecionada, atualizar filtros dependentes
    if (filtros.obra) {
        atualizarFiltrosPorObra();
    }
    
    carregarDiariasComFiltros(filtros);
}

function limparFiltros() {
    ['Veiculo', 'Obra', 'Motorista', 'Servico', 'Local'].forEach(tipo => {
        document.getElementById(`filtro${tipo}`).checked = false;
        document.getElementById(`select${tipo}`).style.display = 'none';
    });
    carregarDiarias();
}

async function carregarDiariasComFiltros(filtros) {
    try {
        const params = new URLSearchParams();
        Object.keys(filtros).forEach(key => {
            if (filtros[key] && filtros[key].length > 0) {
                params.append(key, filtros[key].join(','));
            }
        });
        
        const response = await fetch(`${API_BASE}/diarias?${params}`);
        const diarias = await response.json();
        exibirDiarias(diarias);
    } catch (error) {
        console.error('Erro ao carregar diárias:', error);
    }
}

// Função para atualizar filtros dinâmicos baseados na obra selecionada
async function atualizarFiltrosPorObra() {
    const obrasSelecionadas = Array.from(document.getElementById('selectObra').selectedOptions).map(o => o.value);
    
    if (obrasSelecionadas.length > 0) {
        try {
            const veiculosPromises = obrasSelecionadas.map(obra => 
                fetch(`${API_BASE}/veiculos-por-obra?obra=${encodeURIComponent(obra)}`).then(r => r.json())
            );
            const motoristasPromises = obrasSelecionadas.map(obra => 
                fetch(`${API_BASE}/motoristas-por-obra?obra=${encodeURIComponent(obra)}`).then(r => r.json())
            );
            
            const veiculosResults = await Promise.all(veiculosPromises);
            const motoristasResults = await Promise.all(motoristasPromises);
            
            // Combinar resultados e remover duplicatas
            const veiculosUnicos = [...new Map(
                veiculosResults.flat().map(v => [v.id_veiculo, v])
            ).values()];
            
            const motoristasUnicos = [...new Set(
                motoristasResults.flat().map(m => m.motorista)
            )];
            
            // Atualizar selects de veículos e motoristas
            const selectVeiculo = document.getElementById('selectVeiculo');
            selectVeiculo.innerHTML = '';
            veiculosUnicos.forEach(v => {
                const option = document.createElement('option');
                option.value = v.veiculo;
                option.textContent = v.veiculo;
                selectVeiculo.appendChild(option);
            });
            
            const selectMotorista = document.getElementById('selectMotorista');
            selectMotorista.innerHTML = '';
            motoristasUnicos.forEach(m => {
                const option = document.createElement('option');
                option.value = m;
                option.textContent = m;
                selectMotorista.appendChild(option);
            });
            
        } catch (error) {
            console.error('Erro ao atualizar filtros por obra:', error);
        }
    } else {
        // Se nenhuma obra selecionada, carregar todos
        carregarFiltros();
    }
}

// PROFISSIONAIS
async function carregarProfissionais() {
    try {
        const response = await fetch(`${API_BASE}/profissionais`);
        profissionais = await response.json();
    } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
    }
}

async function salvarProfissional() {
    const dados = {
        nome: document.getElementById('nomeProfissional').value,
        funcao: document.getElementById('funcaoProfissional').value,
        telefone: document.getElementById('telefoneProfissional').value,
        email: document.getElementById('emailProfissional').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/profissionais`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            mostrarAlerta('Profissional cadastrado com sucesso!', 'success');
            document.getElementById('profissionalForm').reset();
            await carregarProfissionais();
            listarProfissionais();
        }
    } catch (error) {
        mostrarAlerta('Erro ao salvar profissional', 'danger');
    }
}

function listarProfissionais() {
    const lista = document.getElementById('listaProfissionais');
    lista.innerHTML = '';
    
    profissionais.forEach(profissional => {
        const item = document.createElement('div');
        item.className = 'viagem-item';
        item.innerHTML = `
            <strong>${profissional.nome}</strong><br>
            <small>Função: ${profissional.funcao}</small><br>
            ${profissional.telefone ? `<small>Tel: ${profissional.telefone}</small><br>` : ''}
            ${profissional.email ? `<small>Email: ${profissional.email}</small>` : ''}
        `;
        lista.appendChild(item);
    });
}

// EXPORTAÇÃO
async function exportarExcel() {
    try {
        const response = await fetch(`${API_BASE}/export/excel`);
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apontador_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        mostrarAlerta('Arquivo Excel exportado com sucesso!', 'success');
    } catch (error) {
        mostrarAlerta('Erro ao exportar arquivo', 'danger');
    }
}

// UTILITÁRIOS
function formatarData(data) {
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
}

function mostrarAlerta(mensagem, tipo) {
    // Remover alertas existentes
    const alertasExistentes = document.querySelectorAll('.alert');
    alertasExistentes.forEach(alerta => alerta.remove());
    
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo} alert-dismissible fade show position-fixed`;
    alerta.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alerta.innerHTML = `
        ${mensagem}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alerta);
    
    // Remover automaticamente após 3 segundos
    setTimeout(() => {
        if (alerta.parentNode) {
            alerta.remove();
        }
    }, 3000);
}

// Funcionalidade offline (localStorage como backup)
function salvarOffline(tipo, dados) {
    const dadosOffline = JSON.parse(localStorage.getItem('apontador_offline') || '{}');
    if (!dadosOffline[tipo]) dadosOffline[tipo] = [];
    
    dadosOffline[tipo].push({
        ...dados,
        timestamp: new Date().toISOString(),
        sincronizado: false
    });
    
    localStorage.setItem('apontador_offline', JSON.stringify(dadosOffline));
}

function verificarDadosOffline() {
    const dadosOffline = JSON.parse(localStorage.getItem('apontador_offline') || '{}');
    let temDados = false;
    
    Object.keys(dadosOffline).forEach(tipo => {
        if (dadosOffline[tipo].some(item => !item.sincronizado)) {
            temDados = true;
        }
    });
    
    if (temDados) {
        mostrarAlerta('Existem dados offline para sincronizar', 'info');
    }
}

// Funções de edição e exclusão
function editarServico(servico) {
    const novoNome = prompt('Editar serviço:', servico);
    if (novoNome && novoNome.trim() && novoNome !== servico) {
        const index = servicos.findIndex(s => s.nome_servico === servico);
        if (index > -1) {
            servicos[index].nome_servico = novoNome.trim();
            const selIndex = servicosSelecionados.indexOf(servico);
            if (selIndex > -1) {
                servicosSelecionados[selIndex] = novoNome.trim();
            }
            renderizarServicosBoxes();
            mostrarAlerta('Serviço editado com sucesso!', 'success');
        }
    }
}

function excluirServico(servico) {
    if (confirm(`Excluir o serviço "${servico}"?`)) {
        servicos = servicos.filter(s => s.nome_servico !== servico);
        servicosSelecionados = servicosSelecionados.filter(s => s !== servico);
        renderizarServicosBoxes();
        mostrarAlerta('Serviço excluído com sucesso!', 'success');
    }
}

function editarLocal(local) {
    const novoNome = prompt('Editar local:', local);
    if (novoNome && novoNome.trim() && novoNome !== local) {
        const index = locais.findIndex(l => l.nome_local === local);
        if (index > -1) {
            locais[index].nome_local = novoNome.trim();
            const selIndex = locaisSelecionados.indexOf(local);
            if (selIndex > -1) {
                locaisSelecionados[selIndex] = novoNome.trim();
            }
            renderizarLocaisBoxes();
            mostrarAlerta('Local editado com sucesso!', 'success');
        }
    }
}

function excluirLocal(local) {
    if (confirm(`Excluir o local "${local}"?`)) {
        locais = locais.filter(l => l.nome_local !== local);
        locaisSelecionados = locaisSelecionados.filter(l => l !== local);
        renderizarLocaisBoxes();
        mostrarAlerta('Local excluído com sucesso!', 'success');
    }
}

// OCORRÊNCIAS/TRANSPORTES
async function carregarObraLocais() {
    try {
        const response = await fetch(`${API_BASE}/obra-locais`);
        obraLocais = await response.json();
        
        const selects = ['obraLocalSelect', 'obraLocalClimaSelect'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Selecione obra/local</option>';
                obraLocais.forEach(ol => {
                    const option = document.createElement('option');
                    option.value = ol.obra_local_id;
                    option.textContent = `${ol.nome_obra} - ${ol.nome_local}`;
                    select.appendChild(option);
                });
            }
        });
        
        // Carregar veículos para ocorrências
        const veiculoSelect = document.getElementById('veiculoOcorrenciaSelect');
        if (veiculoSelect) {
            veiculoSelect.innerHTML = '<option value="">Selecione um veículo</option>';
            veiculos.forEach(veiculo => {
                const option = document.createElement('option');
                option.value = veiculo.id_veiculo;
                option.textContent = `${veiculo.veiculo} - ${veiculo.placa}`;
                veiculoSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar obra-locais:', error);
    }
}

async function salvarOcorrencia() {
    const dados = {
        obra_local_id: document.getElementById('obraLocalSelect').value,
        veiculo_id: parseInt(document.getElementById('veiculoOcorrenciaSelect').value),
        motivo_paralizacao: document.getElementById('motivoParalizacao').value,
        tipo_manutencao: document.getElementById('tipoManutencao').value,
        descricao_manutencao: document.getElementById('descricaoManutencao').value,
        data_hora_inicio: document.getElementById('dataHoraInicio').value,
        data_hora_retorno: document.getElementById('dataHoraRetorno').value,
        observacoes: document.getElementById('observacoesOcorrencia').value,
        status: document.getElementById('statusOcorrencia').value,
        indicador_preventiva: document.getElementById('indicadorPreventiva').checked
    };
    
    try {
        const response = await fetch(`${API_BASE}/ocorrencias-transportes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            mostrarAlerta('Ocorrência registrada com sucesso!', 'success');
            document.getElementById('ocorrenciaForm').reset();
            await carregarOcorrenciasRecentes();
        }
    } catch (error) {
        mostrarAlerta('Erro ao salvar ocorrência', 'danger');
    }
}

async function carregarOcorrenciasRecentes() {
    try {
        const response = await fetch(`${API_BASE}/ocorrencias-transportes`);
        ocorrencias = await response.json();
        
        const container = document.getElementById('ocorrenciasRecentes');
        if (container) {
            container.innerHTML = '';
            
            ocorrencias.slice(0, 5).forEach(ocorrencia => {
                const item = document.createElement('div');
                item.className = 'viagem-item';
                const statusClass = ocorrencia.status === 'concluído' ? 'text-success' : 'text-warning';
                item.innerHTML = `
                    <strong>${ocorrencia.veiculo}</strong><br>
                    <small>${ocorrencia.motivo_paralizacao}</small><br>
                    <small class="${statusClass}">${ocorrencia.status}</small><br>
                    <small>${formatarDataHora(ocorrencia.data_hora_inicio)}</small>
                `;
                container.appendChild(item);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar ocorrências:', error);
    }
}

function togglePreventiva() {
    const motivo = document.getElementById('motivoParalizacao').value;
    const checkbox = document.getElementById('indicadorPreventiva');
    checkbox.checked = motivo === 'manutenção preventiva';
}

// CLIMA TEMPO
async function salvarClima() {
    const dados = {
        data_ocorrencia: document.getElementById('dataOcorrencia').value,
        obra_local_id: document.getElementById('obraLocalClimaSelect').value,
        tipo_chuva: document.getElementById('tipoChuva').value,
        hora_inicio: document.getElementById('horaInicio').value,
        hora_fim: document.getElementById('horaFim').value,
        observacoes: document.getElementById('observacoesClima').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/clima-tempo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });
        
        if (response.ok) {
            mostrarAlerta('Clima registrado com sucesso!', 'success');
            document.getElementById('climaForm').reset();
            document.getElementById('dataOcorrencia').valueAsDate = new Date();
            await carregarClimaData();
            atualizarCalendario();
        }
    } catch (error) {
        mostrarAlerta('Erro ao salvar clima', 'danger');
    }
}

async function carregarClimaData() {
    try {
        const response = await fetch(`${API_BASE}/clima-tempo?mes=${(mesAtual + 1).toString().padStart(2, '0')}&ano=${anoAtual}`);
        climaData = await response.json();
    } catch (error) {
        console.error('Erro ao carregar dados do clima:', error);
    }
}

function atualizarCalendario() {
    const container = document.getElementById('calendarioClima');
    const mesAnoSpan = document.getElementById('mesAnoAtual');
    
    if (!container || !mesAnoSpan) return;
    
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    mesAnoSpan.textContent = `${meses[mesAtual]} ${anoAtual}`;
    
    const primeiroDia = new Date(anoAtual, mesAtual, 1).getDay();
    const diasNoMes = new Date(anoAtual, mesAtual + 1, 0).getDate();
    
    let html = '<div class="calendario-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; font-size: 12px;">';
    
    // Cabeçalho dos dias da semana
    ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].forEach(dia => {
        html += `<div class="text-center fw-bold">${dia}</div>`;
    });
    
    // Dias vazios no início
    for (let i = 0; i < primeiroDia; i++) {
        html += '<div></div>';
    }
    
    // Dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
        const dataStr = `${anoAtual}-${(mesAtual + 1).toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
        const climaDia = climaData.find(c => c.data_ocorrencia === dataStr);
        
        let classe = 'text-center p-1 border';
        let cor = '';
        
        if (climaDia) {
            switch (climaDia.tipo_chuva) {
                case 'fraca': cor = 'bg-success text-white'; break;
                case 'moderada': cor = 'bg-primary text-white'; break;
                case 'forte': cor = 'bg-danger text-white'; break;
            }
        }
        
        html += `<div class="${classe} ${cor}" title="${climaDia ? climaDia.tipo_chuva : ''}">${dia}</div>`;
    }
    
    html += '</div>';
    container.innerHTML = html;
}

function navegarMes(direcao) {
    mesAtual += direcao;
    if (mesAtual > 11) {
        mesAtual = 0;
        anoAtual++;
    } else if (mesAtual < 0) {
        mesAtual = 11;
        anoAtual--;
    }
    carregarClimaData().then(() => atualizarCalendario());
}

// UTILITÁRIOS ADICIONAIS
function formatarDataHora(dataHora) {
    if (!dataHora) return '';
    return new Date(dataHora).toLocaleString('pt-BR');
}

// Definir data atual nos campos de data
document.addEventListener('DOMContentLoaded', function() {
    const hoje = new Date().toISOString().split('T')[0];
    const dataOcorrencia = document.getElementById('dataOcorrencia');
    if (dataOcorrencia) {
        dataOcorrencia.value = hoje;
    }
});

// Funções globais para a interface (chamadas pelo HTML)
window.toggleServico = toggleServico;
window.toggleLocal = toggleLocal;
window.adicionarNovoServico = adicionarNovoServico;
window.adicionarNovoLocal = adicionarNovoLocal;
window.editarServico = editarServico;
window.excluirServico = excluirServico;
window.editarLocal = editarLocal;
window.excluirLocal = excluirLocal;
window.excluirObra = excluirObra;
window.carregarServicosLocais = carregarServicosLocais;
window.showSection = showSection;
window.logout = logout;
window.exportarExcel = exportarExcel;
window.togglePreventiva = togglePreventiva;
window.navegarMes = navegarMes;
window.aplicarFiltros = aplicarFiltros;
window.limparFiltros = limparFiltros;
window.carregarFiltros = carregarFiltros;

// DASHBOARD FUNCTIONS
let chartHorasImprodutivas = null;

async function carregarDashboard() {
    try {
        const [obras, veiculos, viagens, kpis, paralizacoes] = await Promise.all([
            fetch(`${API_BASE}/obras`).then(r => r.json()),
            fetch(`${API_BASE}/veiculos`).then(r => r.json()),
            fetch(`${API_BASE}/viagens`).then(r => r.json()),
            fetch(`${API_BASE}/dashboard-kpis`).then(r => r.json()),
            fetch(`${API_BASE}/relatorio-paralizacoes`).then(r => r.json())
        ]);
        
        atualizarCardsDashboard(obras, veiculos, viagens);
        atualizarKPIsAvancados(kpis);
        carregarFiltrosDashboard(obras, veiculos, viagens);
        criarGraficoHorasImprodutivas(paralizacoes);
        carregarTabelaParalizacoes(paralizacoes);
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

function atualizarCardsDashboard(obras, veiculos, viagens) {
    const obrasUnicas = [...new Set(viagens.map(v => v.nome_obra))];
    document.getElementById('totalObras').textContent = obrasUnicas.length;
    
    const veiculosUnicos = [...new Set(viagens.map(v => v.id_veiculo))];
    document.getElementById('totalVeiculos').textContent = veiculosUnicos.length;
    
    const totalViagens = viagens.reduce((sum, v) => sum + v.quantidade_viagens, 0);
    document.getElementById('totalViagens').textContent = totalViagens;
    
    const volumeTotal = viagens.reduce((sum, viagem) => {
        const veiculo = veiculos.find(v => v.id_veiculo === viagem.id_veiculo);
        return sum + (veiculo ? veiculo.cubagem_m3 * viagem.quantidade_viagens : 0);
    }, 0);
    
    document.getElementById('totalVolume').textContent = volumeTotal.toFixed(2);
}

function atualizarKPIsAvancados(kpis) {
    document.getElementById('kpiOcorrencias').textContent = kpis.ocorrencias_andamento || 0;
    document.getElementById('kpiChuvas').textContent = kpis.chuvas_mes || 0;
    
    const disponibilidade = kpis.veiculos_ativos > 0 ? 
        Math.round(((kpis.veiculos_ativos - kpis.ocorrencias_andamento) / kpis.veiculos_ativos) * 100) : 100;
    document.getElementById('kpiDisponibilidade').textContent = disponibilidade + '%';
    
    document.getElementById('kpiTempoParado').textContent = (kpis.ocorrencias_andamento * 8) + 'h';
    
    const eficiencia = kpis.total_viagens > 0 ? Math.min(100, Math.round((kpis.total_viagens / (kpis.veiculos_ativos * 10)) * 100)) : 0;
    document.getElementById('kpiEficiencia').textContent = eficiencia + '%';
    
    const performance = Math.round((disponibilidade + eficiencia) / 2);
    document.getElementById('kpiPerformance').textContent = performance;
}

async function carregarFiltrosDashboard(obras, veiculos, viagens) {
    const selectObra = document.getElementById('dashSelectObra');
    if (selectObra) {
        selectObra.innerHTML = '';
        [...new Set(obras.map(o => o.nome_obra))].forEach(obra => {
            const option = document.createElement('option');
            option.value = obra;
            option.textContent = obra;
            selectObra.appendChild(option);
        });
    }
    
    const selectVeiculo = document.getElementById('dashSelectVeiculo');
    if (selectVeiculo) {
        selectVeiculo.innerHTML = '';
        veiculos.forEach(v => {
            const option = document.createElement('option');
            option.value = v.veiculo;
            option.textContent = v.veiculo;
            selectVeiculo.appendChild(option);
        });
    }
    
    const selectMotorista = document.getElementById('dashSelectMotorista');
    if (selectMotorista) {
        selectMotorista.innerHTML = '';
        [...new Set(veiculos.map(v => v.motorista))].forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            selectMotorista.appendChild(option);
        });
    }
}

function aplicarFiltrosDashboard() {
    ['Obra', 'Veiculo', 'Motorista', 'Servico', 'Local'].forEach(tipo => {
        const checkbox = document.getElementById(`dashFiltro${tipo}`);
        const select = document.getElementById(`dashSelect${tipo}`);
        select.style.display = checkbox.checked ? 'block' : 'none';
    });
    
    const checkboxData = document.getElementById('dashFiltroData');
    const dateRange = document.getElementById('dashDateRange');
    dateRange.style.display = checkboxData.checked ? 'block' : 'none';
}

function aplicarFiltrosDashboardCompleto() {
    const filtros = {};
    
    ['Obra', 'Veiculo', 'Motorista', 'Servico', 'Local'].forEach(tipo => {
        const checkbox = document.getElementById(`dashFiltro${tipo}`);
        const select = document.getElementById(`dashSelect${tipo}`);
        if (checkbox.checked && select.selectedOptions.length > 0) {
            filtros[tipo.toLowerCase()] = Array.from(select.selectedOptions).map(o => o.value);
        }
    });
    
    const checkboxData = document.getElementById('dashFiltroData');
    if (checkboxData.checked) {
        const dataInicio = document.getElementById('dashDataInicio').value;
        const dataFim = document.getElementById('dashDataFim').value;
        if (dataInicio && dataFim) {
            filtros.data_inicio = dataInicio;
            filtros.data_fim = dataFim;
        }
    }
    
    carregarDashboardComFiltros(filtros);
}

async function carregarDashboardComFiltros(filtros) {
    try {
        const params = new URLSearchParams();
        Object.keys(filtros).forEach(key => {
            if (Array.isArray(filtros[key])) {
                params.append(key, filtros[key].join(','));
            } else {
                params.append(key, filtros[key]);
            }
        });
        
        const [obras, veiculos, viagens, kpis] = await Promise.all([
            fetch(`${API_BASE}/obras`).then(r => r.json()),
            fetch(`${API_BASE}/veiculos`).then(r => r.json()),
            fetch(`${API_BASE}/viagens?${params}`).then(r => r.json()),
            fetch(`${API_BASE}/dashboard-kpis`).then(r => r.json())
        ]);
        
        atualizarCardsDashboard(obras, veiculos, viagens);
        atualizarKPIsAvancados(kpis);
    } catch (error) {
        console.error('Erro ao carregar dashboard com filtros:', error);
    }
}

function limparFiltrosDashboard() {
    ['Obra', 'Veiculo', 'Motorista', 'Servico', 'Local', 'Data'].forEach(tipo => {
        document.getElementById(`dashFiltro${tipo}`).checked = false;
        const select = document.getElementById(`dashSelect${tipo}`);
        if (select) select.style.display = 'none';
    });
    document.getElementById('dashDateRange').style.display = 'none';
    document.getElementById('dashDataInicio').value = '';
    document.getElementById('dashDataFim').value = '';
    carregarDashboard();
}

function gerarRelatorioPDF(tipo) {
    const url = `${API_BASE}/relatorio-pdf/${tipo}`;
    window.open(url, '_blank');
}

function criarGraficoHorasImprodutivas(paralizacoes) {
    const ctx = document.getElementById('chartHorasImprodutivas');
    if (!ctx) return;
    
    // Destruir gráfico anterior se existir
    if (chartHorasImprodutivas) {
        chartHorasImprodutivas.destroy();
    }
    
    // Calcular horas improdutivas por veículo
    const horasPorVeiculo = {};
    let totalHoras = 0;
    let veiculosParalizados = 0;
    
    paralizacoes.forEach(p => {
        if (p.data_hora_inicio && p.data_hora_retorno) {
            const inicio = new Date(p.data_hora_inicio);
            const retorno = new Date(p.data_hora_retorno);
            const horas = Math.abs(retorno - inicio) / (1000 * 60 * 60); // Converter para horas
            
            if (!horasPorVeiculo[p.veiculo]) {
                horasPorVeiculo[p.veiculo] = 0;
                veiculosParalizados++;
            }
            horasPorVeiculo[p.veiculo] += horas;
            totalHoras += horas;
        } else if (p.status === 'em andamento') {
            // Para ocorrências em andamento, assumir 8 horas por dia
            if (!horasPorVeiculo[p.veiculo]) {
                horasPorVeiculo[p.veiculo] = 0;
                veiculosParalizados++;
            }
            horasPorVeiculo[p.veiculo] += 8;
            totalHoras += 8;
        }
    });
    
    // Atualizar resumo operacional
    document.getElementById('totalHorasImprodutivas').textContent = Math.round(totalHoras) + 'h';
    document.getElementById('veiculosParalizados').textContent = veiculosParalizados;
    
    // Preparar dados para o gráfico
    const labels = Object.keys(horasPorVeiculo);
    const data = Object.values(horasPorVeiculo);
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
    ];
    
    chartHorasImprodutivas = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = Math.round(context.parsed * 10) / 10;
                            return label + ': ' + value + 'h';
                        }
                    }
                }
            }
        }
    });
}

function carregarTabelaParalizacoes(paralizacoes) {
    const tbody = document.getElementById('tabelaParalizacoes');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (paralizacoes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma paralização registrada</td></tr>';
        return;
    }
    
    paralizacoes.forEach(p => {
        const row = document.createElement('tr');
        
        // Calcular total de horas
        let totalHoras = 'N/A';
        if (p.data_hora_inicio && p.data_hora_retorno) {
            const inicio = new Date(p.data_hora_inicio);
            const retorno = new Date(p.data_hora_retorno);
            const horas = Math.abs(retorno - inicio) / (1000 * 60 * 60);
            totalHoras = Math.round(horas * 10) / 10 + 'h';
        } else if (p.status === 'em andamento') {
            totalHoras = 'Em andamento';
        }
        
        // Definir classe do status
        const statusClass = p.status === 'concluído' ? 'badge bg-success' : 'badge bg-warning';
        
        row.innerHTML = `
            <td><strong>${p.veiculo || 'N/A'}</strong></td>
            <td>${p.motivo_paralizacao || 'N/A'}</td>
            <td>${p.tipo_manutencao || 'N/A'}</td>
            <td style="max-width: 200px; word-wrap: break-word;">${p.observacoes || 'Sem observações'}</td>
            <td><strong>${totalHoras}</strong></td>
            <td><span class="${statusClass}">${p.status || 'N/A'}</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

// Export dashboard functions to global scope
window.carregarDashboard = carregarDashboard;
window.aplicarFiltrosDashboard = aplicarFiltrosDashboard;
window.aplicarFiltrosDashboardCompleto = aplicarFiltrosDashboardCompleto;
window.limparFiltrosDashboard = limparFiltrosDashboard;
window.gerarRelatorioPDF = gerarRelatorioPDF;
window.criarGraficoHorasImprodutivas = criarGraficoHorasImprodutivas;
window.carregarTabelaParalizacoes = carregarTabelaParalizacoes;