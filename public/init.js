// Inicialização garantida do sistema
document.addEventListener('DOMContentLoaded', function() {
    // Garantir que as seções existam
    const dashboard = document.getElementById('dashboard-section');
    const painel = document.getElementById('painel-section');
    
    if (dashboard) {
        console.log('Dashboard encontrado');
    } else {
        console.error('Dashboard não encontrado');
    }
    
    if (painel) {
        console.log('Painel encontrado');
    } else {
        console.error('Painel não encontrado');
    }
    
    // Mostrar dashboard por padrão
    if (dashboard) {
        showSection('dashboard');
    }
    
    // Configurar nome do usuário se não estiver definido
    const userName = document.getElementById('userName');
    if (userName && !userName.textContent) {
        userName.textContent = 'Usuário';
    }
});

// Função showSection simplificada
function showSection(sectionName) {
    console.log('Tentando mostrar seção:', sectionName);
    
    // Esconder todas as seções
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Mostrar seção selecionada
    const targetSection = document.getElementById(sectionName + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
        console.log('Seção mostrada:', sectionName);
    } else {
        console.error('Seção não encontrada:', sectionName);
    }
}