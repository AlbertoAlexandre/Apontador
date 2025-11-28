# APONTADOR - Sistema de Viagens e Serviços

Sistema web para registro e gerenciamento de viagens, obras, veículos e relatórios de diárias.

## 🚀 Funcionalidades

- ✅ **Registro de Viagens**: Formulário completo para apontamento de viagens
- ✅ **Cadastro de Obras**: Gerenciamento de obras, serviços e locais
- ✅ **Cadastro de Veículos**: Controle de veículos, placas, cubagem e motoristas
- ✅ **Relatório de Diárias**: Visualização de totais por veículo com volume calculado
- ✅ **Exportação Excel**: Download de relatórios em formato Excel
- ✅ **Interface Responsiva**: Otimizada para desktop e mobile
- ✅ **Funcionalidade Offline**: Registro local com sincronização posterior

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- npm (gerenciador de pacotes do Node.js)

## 🔧 Instalação

1. **Clone ou baixe o projeto**
   ```bash
   cd App_Apontador
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Inicie o servidor**
   ```bash
   npm start
   ```

4. **Acesse o aplicativo**
   - Abra o navegador e vá para: `http://localhost:3000`

## 📱 Uso do Sistema

### 1. Cadastros Iniciais
- **Obras**: Cadastre as obras com nome, serviço e local
- **Veículos**: Registre veículos com placa, cubagem e motorista

### 2. Registro de Viagens
- Selecione a obra e veículo
- Informe a data e quantidade de viagens
- Clique em **SALVAR VIAGEM**

### 3. Relatórios
- Acesse a aba **Diárias** para ver totais por veículo
- Use **Exportar Excel** para baixar relatórios completos

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais:
- **obras**: id_obra, nome_obra, servico, local
- **veiculos**: id_veiculo, veiculo, placa, cubagem_m3, motorista
- **viagens**: id_viagem, id_obra, id_veiculo, data, quantidade_viagens

### Relacionamentos:
- Uma obra pode ter várias viagens
- Um veículo pode realizar várias viagens
- Diárias são calculadas automaticamente

## 📊 Relatórios Disponíveis

### Diárias por Veículo:
- Total de viagens por veículo
- Volume total (cubagem × viagens)
- Subtotais organizados por veículo

### Exportação:
- **Excel**: Planilhas separadas para Viagens e Diárias
- **CSV**: Formato compatível com outros sistemas

## 📱 Uso em Dispositivos Móveis

- Interface otimizada para telas pequenas
- Campos de toque ampliados
- Teclado numérico para campos de número
- Calendário nativo para seleção de datas

## 🔄 Funcionalidade Offline

- Dados são salvos localmente quando offline
- Sincronização automática quando a conexão retornar
- Backup em localStorage para segurança

## 🛠️ Desenvolvimento

### Estrutura de Arquivos:
```
App_Apontador/
├── server.js          # Servidor backend
├── package.json       # Dependências
├── apontador.db       # Banco SQLite (criado automaticamente)
└── public/
    ├── index.html     # Interface principal
    ├── style.css      # Estilos responsivos
    └── app.js         # JavaScript frontend
```

### Tecnologias Utilizadas:
- **Backend**: Node.js + Express + SQLite
- **Frontend**: HTML5 + CSS3 + JavaScript + Bootstrap
- **Exportação**: XLSX library
- **Responsividade**: Bootstrap 5

## 🚀 Deploy e Produção

Para usar em produção:

1. **Configure variáveis de ambiente**
2. **Use PostgreSQL** em vez de SQLite
3. **Configure HTTPS**
4. **Implemente autenticação** se necessário

## 📞 Suporte

Para dúvidas ou problemas:
- Verifique se todas as dependências foram instaladas
- Confirme se a porta 3000 está disponível
- Consulte os logs do console para erros

## 🔄 Atualizações Futuras

- [ ] Autenticação de usuários
- [ ] Backup automático na nuvem
- [ ] Integração com GPS para localização
- [ ] Relatórios avançados com gráficos
- [ ] API para integração com outros sistemas