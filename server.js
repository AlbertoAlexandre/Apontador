const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const XLSX = require('xlsx');
const session = require('express-session');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
  secret: 'apontador-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));
app.use(express.static('public'));

// Rota principal - redirecionar para login se não autenticado
app.get('/', (req, res) => {
  if (!req.session.userId) {
    res.redirect('/login.html');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Banco de dados
const db = new sqlite3.Database('apontador.db');



// Criar tabelas
db.serialize(() => {
  // Tabela Obras (apenas nome)
  db.run(`CREATE TABLE IF NOT EXISTS obras (
    id_obra INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_obra TEXT UNIQUE NOT NULL
  )`);

  // Tabela Serviços
  db.run(`CREATE TABLE IF NOT EXISTS servicos (
    id_servico INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_servico TEXT UNIQUE NOT NULL
  )`);

  // Tabela Locais
  db.run(`CREATE TABLE IF NOT EXISTS locais (
    id_local INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_local TEXT UNIQUE NOT NULL
  )`);

  // Tabela de relacionamento Obra-Serviço
  db.run(`CREATE TABLE IF NOT EXISTS obra_servicos (
    id_obra INTEGER,
    id_servico INTEGER,
    PRIMARY KEY (id_obra, id_servico),
    FOREIGN KEY (id_obra) REFERENCES obras (id_obra),
    FOREIGN KEY (id_servico) REFERENCES servicos (id_servico)
  )`);

  // Tabela de relacionamento Obra-Local
  db.run(`CREATE TABLE IF NOT EXISTS obra_locais (
    id_obra INTEGER,
    id_local INTEGER,
    PRIMARY KEY (id_obra, id_local),
    FOREIGN KEY (id_obra) REFERENCES obras (id_obra),
    FOREIGN KEY (id_local) REFERENCES locais (id_local)
  )`);

  // Tabela Veículos
  db.run(`CREATE TABLE IF NOT EXISTS veiculos (
    id_veiculo INTEGER PRIMARY KEY AUTOINCREMENT,
    veiculo TEXT NOT NULL,
    placa TEXT UNIQUE NOT NULL,
    cubagem_m3 REAL NOT NULL,
    motorista TEXT NOT NULL
  )`);

  // Tabela Viagens (agora com obra, serviço e local independentes)
  db.run(`CREATE TABLE IF NOT EXISTS viagens (
    id_viagem INTEGER PRIMARY KEY AUTOINCREMENT,
    id_obra INTEGER,
    id_servico INTEGER,
    id_local INTEGER,
    id_veiculo INTEGER,
    data DATE NOT NULL,
    quantidade_viagens INTEGER NOT NULL,
    FOREIGN KEY (id_obra) REFERENCES obras (id_obra),
    FOREIGN KEY (id_servico) REFERENCES servicos (id_servico),
    FOREIGN KEY (id_local) REFERENCES locais (id_local),
    FOREIGN KEY (id_veiculo) REFERENCES veiculos (id_veiculo)
  )`);

  // Tabela Profissionais
  db.run(`CREATE TABLE IF NOT EXISTS profissionais (
    id_profissional INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    funcao TEXT NOT NULL,
    telefone TEXT,
    email TEXT
  )`);

  // Tabela Usuários
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
    id_profissional INTEGER,
    usuario TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    FOREIGN KEY (id_profissional) REFERENCES profissionais (id_profissional)
  )`);

  // Tabela Permissões
  db.run(`CREATE TABLE IF NOT EXISTS permissoes (
    id_permissao INTEGER PRIMARY KEY AUTOINCREMENT,
    id_usuario INTEGER,
    adm BOOLEAN DEFAULT 0,
    dashboard BOOLEAN DEFAULT 0,
    registrar_viagem BOOLEAN DEFAULT 0,
    obras BOOLEAN DEFAULT 0,
    veiculo BOOLEAN DEFAULT 0,
    profissionais BOOLEAN DEFAULT 0,
    diaria BOOLEAN DEFAULT 0,
    painel_controle BOOLEAN DEFAULT 0,
    visualizar_ocorrencias_transportes BOOLEAN DEFAULT 0,
    visualizar_clima_tempo BOOLEAN DEFAULT 0,
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
  )`);

  // Tabela Ocorrências/Transportes
  db.run(`CREATE TABLE IF NOT EXISTS ocorrencias_transportes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    obra_local_id INTEGER,
    veiculo_id INTEGER,
    motivo_paralizacao TEXT CHECK(motivo_paralizacao IN ('manutenção preventiva', 'corretiva', 'quebra', 'abastecimento')),
    tipo_manutencao TEXT CHECK(tipo_manutencao IN ('mecânica', 'elétrica', 'hidráulica', 'pneus', 'outros')),
    descricao_manutencao TEXT,
    data_hora_inicio DATETIME,
    data_hora_retorno DATETIME,
    tempo_total INTEGER,
    observacoes TEXT,
    usuario_id INTEGER,
    foto_anexo TEXT,
    status TEXT CHECK(status IN ('em andamento', 'concluído')) DEFAULT 'em andamento',
    indicador_preventiva BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (veiculo_id) REFERENCES veiculos (id_veiculo),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario)
  )`);

  // Tabela Clima Tempo
  db.run(`CREATE TABLE IF NOT EXISTS clima_tempo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_ocorrencia DATE,
    obra_local_id INTEGER,
    tipo_chuva TEXT CHECK(tipo_chuva IN ('fraca', 'moderada', 'forte')),
    hora_inicio TIME,
    hora_fim TIME,
    tempo_total INTEGER,
    observacoes TEXT,
    usuario_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id_usuario)
  )`);

  // Inserir usuário administrador padrão
  db.get('SELECT * FROM profissionais WHERE nome = "Alberto Alexandre"', (err, profissional) => {
    if (!profissional) {
      db.run('INSERT INTO profissionais (nome, funcao, telefone, email) VALUES (?, ?, ?, ?)', 
        ['Alberto Alexandre', 'Administrador', '', ''], function(err) {
        if (!err) {
          const profId = this.lastID;
          db.run('INSERT INTO usuarios (id_profissional, usuario, senha) VALUES (?, ?, ?)', 
            [profId, 'adm', '123'], function(err) {
            if (!err) {
              db.run('INSERT INTO permissoes (id_usuario, adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)', 
                [this.lastID]);
            }
          });
        }
      });
    } else {
      db.get('SELECT * FROM usuarios WHERE id_profissional = ?', [profissional.id_profissional], (err, usuario) => {
        if (!usuario) {
          db.run('INSERT INTO usuarios (id_profissional, usuario, senha) VALUES (?, ?, ?)', 
            [profissional.id_profissional, 'adm', '123'], function(err) {
            if (!err) {
              db.run('INSERT INTO permissoes (id_usuario, adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)', 
                [this.lastID]);
            }
          });
        }
      });
    }
  });
});

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

// ROTAS - AUTENTICAÇÃO
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  
  const query = `
    SELECT u.*, p.nome, pr.* 
    FROM usuarios u
    JOIN profissionais p ON u.id_profissional = p.id_profissional
    LEFT JOIN permissoes pr ON u.id_usuario = pr.id_usuario
    WHERE u.usuario = ? AND u.senha = ?
  `;
  
  db.get(query, [usuario, senha], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    
    req.session.userId = user.id_usuario;
    req.session.userName = user.nome;
    
    res.json({
      id: user.id_usuario,
      nome: user.nome,
      permissoes: {
        adm: user.adm,
        dashboard: user.dashboard,
        registrar_viagem: user.registrar_viagem,
        obras: user.obras,
        veiculo: user.veiculo,
        profissionais: user.profissionais,
        diaria: user.diaria,
        painel_controle: user.painel_controle,
        visualizar_ocorrencias_transportes: user.visualizar_ocorrencias_transportes,
        visualizar_clima_tempo: user.visualizar_clima_tempo
      }
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/session', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  const query = `
    SELECT u.*, p.nome, pr.* 
    FROM usuarios u
    JOIN profissionais p ON u.id_profissional = p.id_profissional
    LEFT JOIN permissoes pr ON u.id_usuario = pr.id_usuario
    WHERE u.id_usuario = ?
  `;
  
  db.get(query, [req.session.userId], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Sessão inválida' });
    
    res.json({
      id: user.id_usuario,
      nome: user.nome,
      permissoes: {
        adm: user.adm,
        dashboard: user.dashboard,
        registrar_viagem: user.registrar_viagem,
        obras: user.obras,
        veiculo: user.veiculo,
        profissionais: user.profissionais,
        diaria: user.diaria,
        painel_controle: user.painel_controle,
        visualizar_ocorrencias_transportes: user.visualizar_ocorrencias_transportes,
        visualizar_clima_tempo: user.visualizar_clima_tempo
      }
    });
  });
});

// ROTAS - USUÁRIOS E PERMISSÕES
app.get('/api/usuarios', requireAuth, (req, res) => {
  const query = `
    SELECT u.*, p.nome, p.funcao, pr.*
    FROM usuarios u
    JOIN profissionais p ON u.id_profissional = p.id_profissional
    LEFT JOIN permissoes pr ON u.id_usuario = pr.id_usuario
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/usuarios', requireAuth, (req, res) => {
  const { id_profissional, usuario, senha } = req.body;
  db.run('INSERT INTO usuarios (id_profissional, usuario, senha) VALUES (?, ?, ?)', 
    [id_profissional, usuario, senha], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Criar permissões padrão (todas desmarcadas)
    db.run('INSERT INTO permissoes (id_usuario) VALUES (?)', [this.lastID], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID });
    });
  });
});

app.put('/api/permissoes/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo } = req.body;
  
  db.run(`UPDATE permissoes SET 
    adm = ?, dashboard = ?, registrar_viagem = ?, obras = ?, 
    veiculo = ?, profissionais = ?, diaria = ?, painel_controle = ?,
    visualizar_ocorrencias_transportes = ?, visualizar_clima_tempo = ?
    WHERE id_usuario = ?`, 
    [adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo, id], 
    function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ROTAS - OBRAS
app.get('/api/obras', requireAuth, (req, res) => {
  const query = `
    SELECT o.*, 
           GROUP_CONCAT(DISTINCT s.nome_servico) as servicos,
           GROUP_CONCAT(DISTINCT l.nome_local) as locais
    FROM obras o
    LEFT JOIN obra_servicos os ON o.id_obra = os.id_obra
    LEFT JOIN servicos s ON os.id_servico = s.id_servico
    LEFT JOIN obra_locais ol ON o.id_obra = ol.id_obra
    LEFT JOIN locais l ON ol.id_local = l.id_local
    GROUP BY o.id_obra
    ORDER BY o.nome_obra
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/obras', requireAuth, (req, res) => {
  const { nome_obra, servicos, locais } = req.body;
  
  db.run('INSERT OR IGNORE INTO obras (nome_obra) VALUES (?)', [nome_obra], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    let obraId = this.lastID;
    
    if (this.changes === 0) {
      db.get('SELECT id_obra FROM obras WHERE nome_obra = ?', [nome_obra], (err, row) => {
        if (row) processarServicosLocais(row.id_obra);
      });
    } else {
      processarServicosLocais(obraId);
    }
    
    function processarServicosLocais(id) {
      let processed = 0;
      const total = (servicos?.length || 0) + (locais?.length || 0);
      
      if (total === 0) {
        return res.json({ id: id });
      }
      
      if (servicos?.length > 0) {
        servicos.forEach(servico => {
          db.run('INSERT OR IGNORE INTO servicos (nome_servico) VALUES (?)', [servico], function() {
            db.run('INSERT OR IGNORE INTO obra_servicos (id_obra, id_servico) SELECT ?, id_servico FROM servicos WHERE nome_servico = ?', [id, servico], function() {
              processed++;
              if (processed === total) res.json({ id: id });
            });
          });
        });
      }
      
      if (locais?.length > 0) {
        locais.forEach(local => {
          db.run('INSERT OR IGNORE INTO locais (nome_local) VALUES (?)', [local], function() {
            db.run('INSERT OR IGNORE INTO obra_locais (id_obra, id_local) SELECT ?, id_local FROM locais WHERE nome_local = ?', [id, local], function() {
              processed++;
              if (processed === total) res.json({ id: id });
            });
          });
        });
      }
    }
  });
});

// ROTAS - SERVIÇOS
app.get('/api/servicos', requireAuth, (req, res) => {
  const obraId = req.query.obra_id;
  let query = 'SELECT * FROM servicos ORDER BY nome_servico';
  let params = [];
  
  if (obraId) {
    query = `
      SELECT s.* FROM servicos s
      JOIN obra_servicos os ON s.id_servico = os.id_servico
      WHERE os.id_obra = ?
      ORDER BY s.nome_servico
    `;
    params = [obraId];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ROTAS - LOCAIS
app.get('/api/locais', requireAuth, (req, res) => {
  const obraId = req.query.obra_id;
  let query = 'SELECT * FROM locais ORDER BY nome_local';
  let params = [];
  
  if (obraId) {
    query = `
      SELECT l.* FROM locais l
      JOIN obra_locais ol ON l.id_local = ol.id_local
      WHERE ol.id_obra = ?
      ORDER BY l.nome_local
    `;
    params = [obraId];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ROTA - DELETAR OBRA
app.delete('/api/obras/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  
  db.serialize(() => {
    db.run('DELETE FROM obra_servicos WHERE id_obra = ?', [id]);
    db.run('DELETE FROM obra_locais WHERE id_obra = ?', [id]);
    db.run('DELETE FROM obras WHERE id_obra = ?', [id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ROTAS - VEÍCULOS
app.get('/api/veiculos', requireAuth, (req, res) => {
  db.all('SELECT * FROM veiculos', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/veiculos', requireAuth, (req, res) => {
  const { veiculo, placa, cubagem_m3, motorista } = req.body;
  db.run('INSERT INTO veiculos (veiculo, placa, cubagem_m3, motorista) VALUES (?, ?, ?, ?)', 
    [veiculo, placa, cubagem_m3, motorista], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// ROTAS - VIAGENS
app.get('/api/viagens', requireAuth, (req, res) => {
  const query = `
    SELECT v.*, o.nome_obra, s.nome_servico as servico, l.nome_local as local, 
           ve.veiculo, ve.placa, ve.motorista
    FROM viagens v
    JOIN obras o ON v.id_obra = o.id_obra
    LEFT JOIN servicos s ON v.id_servico = s.id_servico
    LEFT JOIN locais l ON v.id_local = l.id_local
    JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
    ORDER BY v.data DESC
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/viagens', requireAuth, (req, res) => {
  const { id_obra, id_servico, id_local, id_veiculo, data, quantidade_viagens } = req.body;
  db.run('INSERT INTO viagens (id_obra, id_servico, id_local, id_veiculo, data, quantidade_viagens) VALUES (?, ?, ?, ?, ?, ?)', 
    [id_obra, id_servico, id_local, id_veiculo, data, quantidade_viagens], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// ROTA - DIÁRIAS (Relatório)
app.get('/api/diarias', requireAuth, (req, res) => {
  const query = `
    SELECT 
      ve.veiculo,
      ve.placa,
      ve.motorista,
      ve.cubagem_m3,
      SUM(v.quantidade_viagens) as total_viagens,
      (ve.cubagem_m3 * SUM(v.quantidade_viagens)) as volume_total
    FROM veiculos ve
    LEFT JOIN viagens v ON ve.id_veiculo = v.id_veiculo
    GROUP BY ve.id_veiculo
    ORDER BY ve.veiculo
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ROTAS - PROFISSIONAIS
app.get('/api/profissionais', requireAuth, (req, res) => {
  db.all('SELECT * FROM profissionais ORDER BY nome', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/profissionais', requireAuth, (req, res) => {
  const { nome, funcao, telefone, email } = req.body;
  db.run('INSERT INTO profissionais (nome, funcao, telefone, email) VALUES (?, ?, ?, ?)', 
    [nome, funcao, telefone, email], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// ROTA - EXPORTAR EXCEL
app.get('/api/export/excel', requireAuth, (req, res) => {
  const viagensQuery = `
    SELECT v.*, o.nome_obra, s.nome_servico as servico, l.nome_local as local, 
           ve.veiculo, ve.placa, ve.motorista
    FROM viagens v
    JOIN obras o ON v.id_obra = o.id_obra
    LEFT JOIN servicos s ON v.id_servico = s.id_servico
    LEFT JOIN locais l ON v.id_local = l.id_local
    JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
  `;
  
  const diariasQuery = `
    SELECT 
      ve.veiculo, ve.placa, ve.motorista, ve.cubagem_m3,
      SUM(v.quantidade_viagens) as total_viagens,
      (ve.cubagem_m3 * SUM(v.quantidade_viagens)) as volume_total
    FROM veiculos ve
    LEFT JOIN viagens v ON ve.id_veiculo = v.id_veiculo
    GROUP BY ve.id_veiculo
  `;

  db.all(viagensQuery, (err, viagens) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(diariasQuery, (err, diarias) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const wb = XLSX.utils.book_new();
      const wsViagens = XLSX.utils.json_to_sheet(viagens);
      const wsDiarias = XLSX.utils.json_to_sheet(diarias);
      
      XLSX.utils.book_append_sheet(wb, wsViagens, 'Viagens');
      XLSX.utils.book_append_sheet(wb, wsDiarias, 'Diárias');
      
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      
      res.setHeader('Content-Disposition', 'attachment; filename=apontador.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    });
  });
});

// ROTAS - OCORRÊNCIAS/TRANSPORTES
app.get('/api/ocorrencias-transportes', requireAuth, (req, res) => {
  const query = `
    SELECT ot.*, v.veiculo, v.placa, u.usuario as usuario_nome
    FROM ocorrencias_transportes ot
    JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
    JOIN usuarios u ON ot.usuario_id = u.id_usuario
    ORDER BY ot.data_hora_inicio DESC
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/ocorrencias-transportes', requireAuth, (req, res) => {
  const { obra_local_id, veiculo_id, motivo_paralizacao, tipo_manutencao, descricao_manutencao, 
          data_hora_inicio, data_hora_retorno, observacoes, foto_anexo, status, indicador_preventiva } = req.body;
  
  // Calcular tempo total em minutos
  let tempo_total = null;
  if (data_hora_retorno && data_hora_inicio) {
    const inicio = new Date(data_hora_inicio);
    const retorno = new Date(data_hora_retorno);
    tempo_total = Math.floor((retorno - inicio) / (1000 * 60));
  }
  
  db.run(`INSERT INTO ocorrencias_transportes 
    (obra_local_id, veiculo_id, motivo_paralizacao, tipo_manutencao, descricao_manutencao, 
     data_hora_inicio, data_hora_retorno, tempo_total, observacoes, usuario_id, foto_anexo, status, indicador_preventiva) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
    [obra_local_id, veiculo_id, motivo_paralizacao, tipo_manutencao, descricao_manutencao, 
     data_hora_inicio, data_hora_retorno, tempo_total, observacoes, req.session.userId, foto_anexo, status, indicador_preventiva], 
    function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.put('/api/ocorrencias-transportes/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { data_hora_retorno, status, observacoes } = req.body;
  
  // Buscar data de início para calcular tempo total
  db.get('SELECT data_hora_inicio FROM ocorrencias_transportes WHERE id = ?', [id], (err, row) => {
    if (err || !row) return res.status(500).json({ error: 'Ocorrência não encontrada' });
    
    let tempo_total = null;
    if (data_hora_retorno && row.data_hora_inicio) {
      const inicio = new Date(row.data_hora_inicio);
      const retorno = new Date(data_hora_retorno);
      tempo_total = Math.floor((retorno - inicio) / (1000 * 60));
    }
    
    db.run(`UPDATE ocorrencias_transportes SET 
      data_hora_retorno = ?, tempo_total = ?, status = ?, observacoes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, 
      [data_hora_retorno, tempo_total, status, observacoes, id], 
      function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ROTAS - CLIMA TEMPO
app.get('/api/clima-tempo', requireAuth, (req, res) => {
  const { mes, ano } = req.query;
  let query = `
    SELECT ct.*, u.usuario as usuario_nome
    FROM clima_tempo ct
    JOIN usuarios u ON ct.usuario_id = u.id_usuario
    ORDER BY ct.data_ocorrencia DESC
  `;
  let params = [];
  
  if (mes && ano) {
    query = `
      SELECT ct.*, u.usuario as usuario_nome
      FROM clima_tempo ct
      JOIN usuarios u ON ct.usuario_id = u.id_usuario
      WHERE strftime('%m', ct.data_ocorrencia) = ? AND strftime('%Y', ct.data_ocorrencia) = ?
      ORDER BY ct.data_ocorrencia DESC
    `;
    params = [mes.padStart(2, '0'), ano];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/clima-tempo', requireAuth, (req, res) => {
  const { data_ocorrencia, obra_local_id, tipo_chuva, hora_inicio, hora_fim, observacoes } = req.body;
  
  // Calcular tempo total em minutos
  let tempo_total = null;
  if (hora_fim && hora_inicio) {
    const [h1, m1] = hora_inicio.split(':').map(Number);
    const [h2, m2] = hora_fim.split(':').map(Number);
    tempo_total = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (tempo_total < 0) tempo_total += 24 * 60; // Para casos que passam da meia-noite
  }
  
  db.run(`INSERT INTO clima_tempo 
    (data_ocorrencia, obra_local_id, tipo_chuva, hora_inicio, hora_fim, tempo_total, observacoes, usuario_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
    [data_ocorrencia, obra_local_id, tipo_chuva, hora_inicio, hora_fim, tempo_total, observacoes, req.session.userId], 
    function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

// ROTA - OBRA-LOCAIS (para os selects das novas páginas)
app.get('/api/obra-locais', requireAuth, (req, res) => {
  const query = `
    SELECT ol.id_obra, ol.id_local, o.nome_obra, l.nome_local,
           (CAST(ol.id_obra AS TEXT) || '-' || CAST(ol.id_local AS TEXT)) as obra_local_id
    FROM obra_locais ol
    JOIN obras o ON ol.id_obra = o.id_obra
    JOIN locais l ON ol.id_local = l.id_local
    ORDER BY o.nome_obra, l.nome_local
  `;
  db.all(query, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor APONTADOR rodando na porta ${PORT}`);
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
  console.log('✅ Nova estrutura de obras implementada');
  console.log('✅ Ocorrências/Transportes e Clima Tempo implementados');
});