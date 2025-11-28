// DASHBOARD
async function carregarDashboard() {
    try {
        // Carregar estatísticas
        const [obrasResp, veiculosResp, viagensResp, profissionaisResp] = await Promise.all([
            fetch(`${API_BASE}/obras`),
            fetch(`${API_BASE}/veiculos`),
            fetch(`${API_BASE}/viagens`),
            fetch(`${API_BASE}/profissionais`)
        ]);
        
        const obrasData = await obrasResp.json();
        const veiculosData = await veiculosResp.json();
        const viagensData = await viagensResp.json();
        const profissionaisData = await profissionaisResp.json();
        
        document.getElementById('totalObras').textContent = obrasData.length;
        document.getElementById('totalVeiculos').textContent = veiculosData.length;
        document.getElementById('totalViagens').textContent = viagensData.reduce((total, v) => total + v.quantidade_viagens, 0);
        document.getElementById('totalProfissionais').textContent = profissionaisData.length;
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// PAINEL DE CONTROLE
async function carregarPainelControle() {
    await carregarUsuarios();
    await carregarProfissionaisParaPermissao();
}

async function carregarUsuarios() {
    try {
        const response = await fetch(`${API_BASE}/usuarios`);
        usuarios = await response.json();
        
        const lista = document.getElementById('listaUsuarios');
        lista.innerHTML = '';
        
        usuarios.forEach(usuario => {
            const item = document.createElement('div');
            item.className = 'viagem-item';
            item.innerHTML = `
                <strong>${usuario.nome}</strong><br>
                <small>Usuário: ${usuario.usuario}</small><br>
                <small>Função: ${usuario.funcao}</small>
            `;
            lista.appendChild(item);
        });
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

async function carregarProfissionaisParaPermissao() {
    const select = document.getElementById('profissionalPermissao');
    select.innerHTML = '<option value="">Selecione um profissional</option>';
    
    profissionais.forEach(profissional => {
        const option = document.createElement('option');
        option.value = profissional.id_profissional;
        option.textContent = `${profissional.nome} - ${profissional.funcao}`;
        select.appendChild(option);
    });
}

async function carregarPermissoes() {
    const profissionalId = document.getElementById('profissionalPermissao').value;
    if (!profissionalId) {
        document.getElementById('permissoesContainer').style.display = 'none';
        return;
    }
    
    document.getElementById('permissoesContainer').style.display = 'block';
    
    // Buscar usuário existente para este profissional
    const usuario = usuarios.find(u => u.id_profissional == profissionalId);
    
    if (usuario) {
        // Carregar permissões existentes
        document.getElementById('perm_adm').checked = usuario.adm;
        document.getElementById('perm_dashboard').checked = usuario.dashboard;
        document.getElementById('perm_registrar_viagem').checked = usuario.registrar_viagem;
        document.getElementById('perm_obras').checked = usuario.obras;
        document.getElementById('perm_veiculo').checked = usuario.veiculo;
        document.getElementById('perm_profissionais').checked = usuario.profissionais;
        document.getElementById('perm_diaria').checked = usuario.diaria;
        document.getElementById('perm_painel_controle').checked = usuario.painel_controle;
        document.getElementById('perm_visualizar_ocorrencias_transportes').checked = usuario.visualizar_ocorrencias_transportes;
        document.getElementById('perm_visualizar_clima_tempo').checked = usuario.visualizar_clima_tempo;
        
        document.getElementById('novoUsuario').value = usuario.usuario;
        document.getElementById('novaSenha').value = '';
    } else {
        // Limpar formulário para novo usuário
        document.querySelectorAll('#permissoesContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.getElementById('novoUsuario').value = '';
        document.getElementById('novaSenha').value = '';
    }
}

async function salvarPermissoes() {
    const profissionalId = document.getElementById('profissionalPermissao').value;
    const usuario = document.getElementById('novoUsuario').value;
    const senha = document.getElementById('novaSenha').value;
    
    if (!profissionalId) {
        mostrarAlerta('Selecione um profissional', 'warning');
        return;
    }
    
    const usuarioExistente = usuarios.find(u => u.id_profissional == profissionalId);
    
    try {
        // Se não existe usuário, criar primeiro
        if (!usuarioExistente && usuario && senha) {
            const response = await fetch(`${API_BASE}/usuarios`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id_profissional: profissionalId,
                    usuario: usuario,
                    senha: senha
                })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao criar usuário');
            }
            
            await carregarUsuarios();
        }
        
        // Atualizar permissões
        const usuarioAtual = usuarios.find(u => u.id_profissional == profissionalId);
        if (usuarioAtual) {
            const permissoes = {
                adm: document.getElementById('perm_adm').checked,
                dashboard: document.getElementById('perm_dashboard').checked,
                registrar_viagem: document.getElementById('perm_registrar_viagem').checked,
                obras: document.getElementById('perm_obras').checked,
                veiculo: document.getElementById('perm_veiculo').checked,
                profissionais: document.getElementById('perm_profissionais').checked,
                diaria: document.getElementById('perm_diaria').checked,
                painel_controle: document.getElementById('perm_painel_controle').checked,
                visualizar_ocorrencias_transportes: document.getElementById('perm_visualizar_ocorrencias_transportes').checked,
                visualizar_clima_tempo: document.getElementById('perm_visualizar_clima_tempo').checked
            };
            
            const response = await fetch(`${API_BASE}/permissoes/${usuarioAtual.id_usuario}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(permissoes)
            });
            
            if (response.ok) {
                mostrarAlerta('Permissões salvas com sucesso!', 'success');
                await carregarUsuarios();
            }
        }
    } catch (error) {
        mostrarAlerta('Erro ao salvar permissões', 'danger');
        console.error(error);
    }
}