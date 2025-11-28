#!/usr/bin/env python3
"""
APONTADOR - Sistema de Viagens (Versão Python)
"""

from flask import Flask, render_template_string, request, jsonify, send_file, session, redirect, url_for, make_response
import sqlite3
import json
from datetime import datetime
import pandas as pd
import os
from io import BytesIO
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

app = Flask(__name__)
app.secret_key = 'apontador-secret-key-2024'

# Configuração do banco de dados
DATABASE = 'apontador.db'

def init_db():
    """Inicializa o banco de dados"""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Tabela Obras
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS obras (
            id_obra INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_obra TEXT NOT NULL,
            servico TEXT NOT NULL,
            local TEXT NOT NULL
        )
    ''')
    
    # Tabela Profissionais
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS profissionais (
            id_profissional INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            funcao TEXT NOT NULL,
            contato TEXT,
            email TEXT,
            terceirizado BOOLEAN DEFAULT 0,
            empresa_terceirizada TEXT
        )
    ''')
    
    # Tabela Veículos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS veiculos (
            id_veiculo INTEGER PRIMARY KEY AUTOINCREMENT,
            veiculo TEXT NOT NULL,
            placa TEXT UNIQUE NOT NULL,
            cubagem_m3 REAL NOT NULL,
            motorista TEXT NOT NULL
        )
    ''')
    
    # Tabela Viagens
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS viagens (
            id_viagem INTEGER PRIMARY KEY AUTOINCREMENT,
            id_obra INTEGER,
            id_veiculo INTEGER,
            data_hora DATETIME NOT NULL,
            quantidade_viagens INTEGER NOT NULL,
            id_usuario INTEGER,
            nome_usuario TEXT,
            FOREIGN KEY (id_obra) REFERENCES obras (id_obra),
            FOREIGN KEY (id_veiculo) REFERENCES veiculos (id_veiculo),
            FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        )
    ''')
    
    # Adicionar colunas se não existirem (para bancos existentes)
    try:
        cursor.execute('ALTER TABLE viagens ADD COLUMN id_usuario INTEGER')
    except:
        pass
    try:
        cursor.execute('ALTER TABLE viagens ADD COLUMN nome_usuario TEXT')
    except:
        pass
    
    # Tabela Usuários
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
            id_profissional INTEGER,
            usuario TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            FOREIGN KEY (id_profissional) REFERENCES profissionais (id_profissional)
        )
    ''')
    
    # Tabela Permissões
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS permissoes (
            id_permissao INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario INTEGER,
            adm BOOLEAN DEFAULT 0,
            dashboard BOOLEAN DEFAULT 0,
            registrar_viagem BOOLEAN DEFAULT 0,
            obras BOOLEAN DEFAULT 0,
            veiculo BOOLEAN DEFAULT 0,
            profissionais BOOLEAN DEFAULT 0,
            diaria BOOLEAN DEFAULT 0,
            meu_veiculo BOOLEAN DEFAULT 0,
            painel_controle BOOLEAN DEFAULT 0,
            FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
        )
    ''')
    
    # Adicionar coluna meu_veiculo se não existir
    try:
        cursor.execute('ALTER TABLE permissoes ADD COLUMN meu_veiculo BOOLEAN DEFAULT 0')
    except:
        pass
    
    # Tabela Configurações da Empresa
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS empresa_config (
            id INTEGER PRIMARY KEY,
            nome_empresa TEXT,
            telefone TEXT,
            endereco TEXT,
            cnpj TEXT,
            logomarca TEXT
        )
    ''')
    
    # Tabela Obras Ativas
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS obras_ativas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome_obra TEXT UNIQUE NOT NULL,
            ativa BOOLEAN DEFAULT 1
        )
    ''')
    
    # Tabela Associação Usuário-Veículo
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuario_veiculo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_usuario INTEGER UNIQUE NOT NULL,
            id_veiculo INTEGER NOT NULL,
            FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
            FOREIGN KEY (id_veiculo) REFERENCES veiculos (id_veiculo)
        )
    ''')
    
    # Tabela Ocorrências/Transportes
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS ocorrencias_transportes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            obra_local_id TEXT NOT NULL,
            veiculo_id INTEGER NOT NULL,
            motivo_paralizacao TEXT NOT NULL,
            tipo_manutencao TEXT,
            descricao_manutencao TEXT,
            data_hora_inicio DATETIME NOT NULL,
            data_hora_retorno DATETIME,
            status TEXT DEFAULT 'em andamento',
            indicador_preventiva BOOLEAN DEFAULT 0,
            observacoes TEXT,
            foto_anexo TEXT,
            FOREIGN KEY (veiculo_id) REFERENCES veiculos (id_veiculo)
        )
    ''')
    
    # Tabela Clima/Tempo
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clima_tempo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_ocorrencia DATE NOT NULL,
            obra_local_id TEXT NOT NULL,
            tipo_chuva TEXT NOT NULL,
            hora_inicio TIME,
            hora_fim TIME,
            observacoes TEXT
        )
    ''')
    
    # Adicionar colunas de permissões se não existirem
    try:
        cursor.execute('ALTER TABLE permissoes ADD COLUMN visualizar_ocorrencias_transportes BOOLEAN DEFAULT 0')
    except:
        pass
    try:
        cursor.execute('ALTER TABLE permissoes ADD COLUMN visualizar_clima_tempo BOOLEAN DEFAULT 0')
    except:
        pass
    
    # Inserir configuração padrão se não existir
    cursor.execute('SELECT * FROM empresa_config WHERE id = 1')
    if not cursor.fetchone():
        cursor.execute('INSERT INTO empresa_config (id, nome_empresa, telefone, endereco, cnpj, logomarca) VALUES (1, "", "", "", "", "")')
    
    # Inserir usuário administrador padrão
    cursor.execute('SELECT * FROM profissionais WHERE nome = "Alberto Alexandre"')
    profissional = cursor.fetchone()
    
    if not profissional:
        cursor.execute('INSERT INTO profissionais (nome, funcao, contato, email) VALUES (?, ?, ?, ?)', 
                      ('Alberto Alexandre', 'Administrador', '', ''))
        prof_id = cursor.lastrowid
        cursor.execute('INSERT INTO usuarios (id_profissional, usuario, senha) VALUES (?, ?, ?)', 
                      (prof_id, 'adm', '123'))
        user_id = cursor.lastrowid
        cursor.execute('INSERT INTO permissoes (id_usuario, adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)', 
                      (user_id,))
    else:
        cursor.execute('SELECT * FROM usuarios WHERE id_profissional = ?', (profissional[0],))
        usuario = cursor.fetchone()
        if not usuario:
            cursor.execute('INSERT INTO usuarios (id_profissional, usuario, senha) VALUES (?, ?, ?)', 
                          (profissional[0], 'adm', '123'))
            user_id = cursor.lastrowid
            cursor.execute('INSERT INTO permissoes (id_usuario, adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)', 
                          (user_id,))
        else:
            # Garantir que o admin sempre tenha todas as permissões
            cursor.execute('UPDATE permissoes SET adm=1, dashboard=1, registrar_viagem=1, obras=1, veiculo=1, profissionais=1, diaria=1, painel_controle=1, visualizar_ocorrencias_transportes=1, visualizar_clima_tempo=1 WHERE id_usuario=?', (usuario[0],))
            # Se não existir registro de permissões, criar
            cursor.execute('SELECT * FROM permissoes WHERE id_usuario = ?', (usuario[0],))
            if not cursor.fetchone():
                cursor.execute('INSERT INTO permissoes (id_usuario, adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)', (usuario[0],))
    
    conn.commit()
    conn.close()

def get_db_connection():
    """Conecta ao banco de dados"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# Template HTML principal
HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APONTADOR - Sistema de Viagens</title>
    <link rel="icon" type="image/png" href="/favicon.ico">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body { background-color: #f5f5f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; }
        .card { border: none; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); background: white; margin-bottom: 20px; }
        .card-header { background: linear-gradient(135deg, #3498db, #2980b9); color: white; border-radius: 15px 15px 0 0 !important; border: none; padding: 20px; font-weight: 600; }
        .card-body { padding: 30px; }
        .form-label { font-weight: 600; color: #2c3e50; margin-bottom: 8px; }
        .form-control, .form-select { border: 2px solid #ced4da; border-radius: 10px; padding: 15px; font-size: 16px; transition: all 0.3s ease; }
        .form-control:focus, .form-select:focus { border-color: #3498db; box-shadow: 0 0 0 0.2rem rgba(52, 152, 219, 0.25); }
        .form-control.readonly-user { background-color: #e9ecef; border-color: #dee2e6; color: #6c757d; cursor: not-allowed; }
        .form-control.readonly-user:focus { border-color: #dee2e6; box-shadow: none; }
        .btn { border-radius: 10px; padding: 15px 30px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; transition: all 0.3s ease; }
        .btn-success { background: linear-gradient(135deg, #27ae60, #2ecc71); border: none; }
        .btn-primary { background: linear-gradient(135deg, #3498db, #2980b9); border: none; }
        .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.15); }
        .table { background: white; border-radius: 10px; overflow: hidden; }
        .table th { background-color: #34495e; color: white; border: none; padding: 15px; font-weight: 600; }
        .table td { padding: 15px; border-color: #ecf0f1; }
        .container { max-width: 1200px; }
        .section { animation: fadeIn 0.5s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .sidebar { position: fixed; top: 0; left: 0; height: 100vh; width: 250px; background: linear-gradient(135deg, #2c3e50, #34495e); transform: translateX(-250px); transition: transform 0.3s ease; z-index: 1000; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
        .sidebar.active { transform: translateX(0); }
        .sidebar-header { padding: 20px; background: rgba(0,0,0,0.1); color: white; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .sidebar-menu { list-style: none; padding: 0; margin: 0; }
        .sidebar-menu li { border-bottom: 1px solid rgba(255,255,255,0.1); }
        .sidebar-menu a { display: block; padding: 15px 20px; color: white; text-decoration: none; transition: all 0.3s ease; }
        .sidebar-menu a:hover { background: rgba(255,255,255,0.1); padding-left: 30px; }
        .sidebar-menu a.active { background: #3498db; }
        .menu-toggle { position: fixed; top: 20px; left: 20px; z-index: 1001; background: #2c3e50; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer; transition: all 0.3s ease; }
        .menu-toggle:hover { background: #34495e; }
        .content { margin-left: 0; transition: margin-left 0.3s ease; }
        .content.shifted { margin-left: 250px; }
        .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 999; opacity: 0; visibility: hidden; transition: all 0.3s ease; }
        .overlay.active { opacity: 1; visibility: visible; }
        @media (max-width: 768px) { .card-body { padding: 20px; } .form-control, .form-select { font-size: 16px; } .content.shifted { margin-left: 0; } }
        .modal-xl { max-width: 90vw; }
        .modal-body .table-responsive { max-height: 60vh; overflow-y: auto; }
        .modal-body .btn { padding: 8px 12px; font-size: 12px; }
        @media (max-width: 768px) { .modal-xl { max-width: 95vw; margin: 10px; } .modal-body .table-responsive { max-height: 50vh; } }
        .btn-outline-primary.btn-nav { border-color: white; color: white; }
        .btn-outline-primary.btn-nav:hover { background-color: white; color: #3498db; }
        
        /* Tamanho dos botões de ação (aumentado em 10%) */
        .table td .btn-sm { padding: 4px 7px; font-size: 11px; min-width: 26px; height: 26px; }
        .table td .btn-sm i { font-size: 11px; }
        
        /* Botões nas listas de Profissionais e Veículos (aumentado em 10%) */
        #listaProfissionais .btn, #listaVeiculos .btn { padding: 4px 7px; font-size: 11px; min-width: 26px; height: 26px; }
        #listaProfissionais .btn i, #listaVeiculos .btn i { font-size: 11px; }
        
        /* Estilos para caixinhas de seleção */
        .selection-boxes {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            min-height: 60px;
            padding: 15px;
            border: 2px dashed #dee2e6;
            border-radius: 8px;
            background-color: #f8f9fa;
        }
        .selection-box {
            position: relative;
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            user-select: none;
        }
        .selection-box:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .selection-box.selected {
            background: linear-gradient(135deg, #28a745, #20c997);
            box-shadow: 0 0 0 3px rgba(40, 167, 69, 0.3);
        }
        .selection-box .edit-btn,
        .selection-box .delete-btn {
            position: absolute;
            top: -6px;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            border: none;
            font-size: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .selection-box .edit-btn {
            right: 22px;
            background: #0d6efd;
            color: white;
        }
        .selection-box .delete-btn {
            right: -6px;
            background: #dc3545;
            color: white;
        }
        .selection-box .edit-btn:hover,
        .selection-box .delete-btn:hover {
            transform: scale(1.1);
        }
        .selection-boxes:empty::before {
            content: "Nenhum item selecionado. Clique em 'Adicionar' para incluir novos itens.";
            color: #6c757d;
            font-style: italic;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 30px;
        }
    </style>
</head>
<body>
    <button class="menu-toggle" onclick="toggleSidebar()">
        <i class="fas fa-bars"></i>
    </button>
    
    <div class="overlay" id="overlay" onclick="closeSidebar()"></div>
    
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h4><i class="fas fa-truck"></i> APONTADOR</h4>
            <small>Sistema de Viagens</small>
        </div>
        <ul class="sidebar-menu">
            {% if permissoes.dashboard %}<li id="nav-dashboard"><a href="#" onclick="showSection('dashboard')" class="active"><i class="fas fa-tachometer-alt"></i> Dashboard</a></li>{% endif %}
            {% if permissoes.registrar_viagem %}<li id="nav-viagens"><a href="#" onclick="showSection('viagens')"><i class="fas fa-plus-circle"></i> Registrar Viagem</a></li>{% endif %}
            {% if permissoes.obras %}<li id="nav-obras"><a href="#" onclick="showSection('obras')"><i class="fas fa-building"></i> Obras</a></li>{% endif %}
            {% if permissoes.veiculo %}<li id="nav-veiculos"><a href="#" onclick="showSection('veiculos')"><i class="fas fa-truck"></i> Veículos</a></li>{% endif %}
            {% if permissoes.profissionais %}<li id="nav-profissionais"><a href="#" onclick="showSection('profissionais')"><i class="fas fa-users"></i> Profissionais</a></li>{% endif %}
            {% if permissoes.diaria %}<li id="nav-diarias"><a href="#" onclick="showSection('diarias')"><i class="fas fa-chart-bar"></i> Diárias</a></li>{% endif %}
            {% if permissoes.visualizar_ocorrencias_transportes %}<li id="nav-ocorrencias"><a href="#" onclick="showSection('ocorrencias')"><i class="fas fa-tools"></i> Ocorrências/Transportes</a></li>{% endif %}
            {% if permissoes.visualizar_clima_tempo %}<li id="nav-clima"><a href="#" onclick="showSection('clima')"><i class="fas fa-cloud-rain"></i> Clima Tempo</a></li>{% endif %}
            {% if permissoes.meu_veiculo %}<li id="nav-meu-veiculo"><a href="#" onclick="showSection('meu-veiculo')"><i class="fas fa-car"></i> Meu Veículo</a></li>{% endif %}
            {% if permissoes.painel_controle %}<li id="nav-painel"><a href="#" onclick="showSection('painel')"><i class="fas fa-cogs"></i> Painel de Controle</a></li>{% endif %}
            <li><a href="/logout"><i class="fas fa-sign-out-alt"></i> Sair</a></li>
        </ul>
    </div>
    
    <div class="content" id="content">
        <div class="container mt-4">
        
        <!-- Seção Dashboard -->
        <div id="dashboard-section" class="section">
            <!-- Usuário Logado -->
            <div class="alert alert-info mb-4 d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-user"></i> <strong>Usuário Logado:</strong> {{ user_name }} (ID: {{ user_id }})
                </div>
                <div id="logoDashboard" style="display: none;">
                    <img id="logoEmpresaDashboard" src="" alt="Logo da Empresa" style="max-height: 40px; max-width: 120px;">
                </div>
            </div>
            
            <!-- Filtros Dashboard -->
            <div class="card mb-4">
                <div class="card-header">
                    <h5><i class="fas fa-filter"></i> Filtros Dashboard</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="dashFiltroObra" onchange="aplicarFiltrosDashboard()">
                                <label class="form-check-label">Obra</label>
                            </div>
                            <select class="form-select form-select-sm mt-1" id="dashSelectObra" multiple style="display:none;" onchange="atualizarFiltrosDependentesDashboard()"></select>
                        </div>
                        <div class="col-md-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="dashFiltroVeiculo" onchange="aplicarFiltrosDashboard()">
                                <label class="form-check-label">Veículo</label>
                            </div>
                            <select class="form-select form-select-sm mt-1" id="dashSelectVeiculo" multiple style="display:none;"></select>
                        </div>
                        <div class="col-md-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="dashFiltroMotorista" onchange="aplicarFiltrosDashboard()">
                                <label class="form-check-label">Motorista</label>
                            </div>
                            <select class="form-select form-select-sm mt-1" id="dashSelectMotorista" multiple style="display:none;"></select>
                        </div>
                        <div class="col-md-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="dashFiltroServico" onchange="aplicarFiltrosDashboard()">
                                <label class="form-check-label">Serviço</label>
                            </div>
                            <select class="form-select form-select-sm mt-1" id="dashSelectServico" multiple style="display:none;"></select>
                        </div>
                        <div class="col-md-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="dashFiltroLocal" onchange="aplicarFiltrosDashboard()">
                                <label class="form-check-label">Local</label>
                            </div>
                            <select class="form-select form-select-sm mt-1" id="dashSelectLocal" multiple style="display:none;"></select>
                        </div>
                        <div class="col-md-2">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="dashFiltroData" onchange="aplicarFiltrosDashboard()">
                                <label class="form-check-label">Período</label>
                            </div>
                            <div class="mt-1" id="dashDateRange" style="display:none;">
                                <input type="date" class="form-control form-control-sm mb-1" id="dashDataInicio">
                                <input type="date" class="form-control form-control-sm" id="dashDataFim">
                            </div>
                        </div>
                    </div>
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <div class="d-flex gap-2">
                                <button class="btn btn-sm btn-primary" onclick="aplicarFiltrosDashboardCompleto()">
                                    <i class="fas fa-filter"></i> Aplicar Filtros
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="limparFiltrosDashboard()">
                                    <i class="fas fa-times"></i> Limpar Filtros
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-building fa-3x text-primary mb-3"></i>
                            <h3 id="totalObras" class="text-primary">0</h3>
                            <p class="text-muted">Obras Ativas</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-truck fa-3x text-success mb-3"></i>
                            <h3 id="totalVeiculos" class="text-success">0</h3>
                            <p class="text-muted">Veículos</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-route fa-3x text-warning mb-3"></i>
                            <h3 id="totalViagens" class="text-warning">0</h3>
                            <p class="text-muted">Total de Viagens</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-cube fa-3x text-info mb-3"></i>
                            <h3 id="totalVolume" class="text-info">0</h3>
                            <p class="text-muted">Volume Total (m³)</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-chart-pie"></i> Viagens por Veículo</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="chartVeiculos" width="300" height="200"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-chart-bar"></i> Volume por Obra</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="chartObras" width="300" height="200"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-chart-line"></i> Média de Produção</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="chartMedia" width="300" height="200"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Seção Relatórios Profissionais -->
            <div class="row mt-4">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-file-pdf"></i> Relatórios Profissionais</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-4">
                                    <button class="btn btn-danger w-100 mb-2" onclick="gerarRelatorioPDF('produtividade')">
                                        <i class="fas fa-chart-line"></i> Relatório de Produtividade
                                    </button>
                                </div>
                                <div class="col-md-4">
                                    <button class="btn btn-warning w-100 mb-2" onclick="gerarRelatorioPDF('paralizacoes')">
                                        <i class="fas fa-tools"></i> Relatório de Paralizações
                                    </button>
                                </div>
                                <div class="col-md-4">
                                    <button class="btn btn-info w-100 mb-2" onclick="gerarRelatorioPDF('chuvas')">
                                        <i class="fas fa-cloud-rain"></i> Relatório de Chuvas
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Seção Dashboard Executivo -->
            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-users"></i> Produtividade por Motorista</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="chartMotoristas" width="400" height="300"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-truck"></i> Horas Improdutivas do Veículo</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="chartFrota" width="400" height="300"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Seção Dashboard Operacional -->
            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-exclamation-triangle"></i> Veículos Parados</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="chartParalizacoes" width="400" height="300"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-cloud-rain"></i> Impacto do Clima</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="chartClima" width="400" height="300"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Seção KPIs Avançados -->
            <div class="row mt-4">
                <div class="col-md-2">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-exclamation-circle fa-2x text-warning mb-2"></i>
                            <h4 id="kpiOcorrencias" class="text-warning">0</h4>
                            <p class="text-muted">Ocorrências Ativas</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-cloud-rain fa-2x text-info mb-2"></i>
                            <h4 id="kpiChuvas" class="text-info">0</h4>
                            <p class="text-muted">Dias de Chuva (Mês)</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-percentage fa-2x text-danger mb-2"></i>
                            <h4 id="kpiDisponibilidade" class="text-danger">0%</h4>
                            <p class="text-muted">Disponibilidade</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-clock fa-2x text-secondary mb-2"></i>
                            <h4 id="kpiTempoParado" class="text-secondary">0h</h4>
                            <p class="text-muted">Tempo Parado</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-chart-line fa-2x text-success mb-2"></i>
                            <h4 id="kpiEficiencia" class="text-success">0%</h4>
                            <p class="text-muted">Eficiência</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-star fa-2x text-primary mb-2"></i>
                            <h4 id="kpiPerformance" class="text-primary">0</h4>
                            <p class="text-muted">Score Performance</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Seção Tabela Dinâmica de Paralizações -->
            <div class="row mt-4">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-table"></i> Detalhamento de Paralizações</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-striped table-hover">
                                    <thead class="table-dark">
                                        <tr>
                                            <th>VEÍCULO</th>
                                            <th>MOTIVO</th>
                                            <th>TIPO MANUTENÇÃO</th>
                                            <th style="width: 30%;">OBSERVAÇÕES</th>
                                            <th>TOTAL HORAS</th>
                                            <th>STATUS</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tabelaParalizacoesDashboard">
                                        <tr>
                                            <td colspan="6" class="text-center text-muted">Carregando dados...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Seção Registrar Viagem -->
        <div id="viagens-section" class="section" style="display: none;">
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-plus-circle"></i> Registrar Nova Viagem</h5>
                        </div>
                        <div class="card-body">
                            <form id="viagemForm">
                                <div class="row">
                                    <div class="col-md-3 mb-3">
                                        <label class="form-label">OBRA *</label>
                                        <select class="form-select" id="obraSelect" required onchange="carregarServicoLocal()">
                                            <option value="">Selecione uma obra</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3 mb-3">
                                        <label class="form-label">SERVIÇO *</label>
                                        <select class="form-select" id="servicoSelect" required>
                                            <option value="">Selecione um serviço</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3 mb-3">
                                        <label class="form-label">LOCAL *</label>
                                        <select class="form-select" id="localSelect" required>
                                            <option value="">Selecione um local</option>
                                        </select>
                                    </div>
                                    <div class="col-md-3 mb-3">
                                        <label class="form-label">VEÍCULO *</label>
                                        <select class="form-select" id="veiculoSelect" required>
                                            <option value="">Selecione um veículo</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">DATA E HORA *</label>
                                        <input type="datetime-local" class="form-control" id="dataHoraViagem" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">MOTORISTA *</label>
                                        <select class="form-select" id="motoristaViagem" required>
                                            <option value="">Selecione um motorista</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-3 mb-3">
                                        <label class="form-label">QUANTIDADE</label>
                                        <input type="number" class="form-control" id="quantidadeViagens" value="1" readonly style="background-color: #e9ecef; font-size: 14px; padding: 10px;">
                                    </div>
                                    <div class="col-md-9 mb-3 d-flex align-items-end">
                                        <button type="submit" class="btn btn-success btn-lg w-100">
                                            <i class="fas fa-save"></i> SALVAR VIAGEM
                                        </button>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">USUÁRIO</label>
                                        <input type="text" class="form-control readonly-user" id="nomeUsuarioViagem" readonly>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">ID USUÁRIO</label>
                                        <input type="text" class="form-control readonly-user" id="idUsuarioViagem" readonly>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <!-- Tabela de Viagens do Usuário -->
                    <div class="card mt-4">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-3">
                                <h6><i class="fas fa-list"></i> Minhas Viagens</h6>
                                <button class="btn btn-sm btn-warning" onclick="gerarComprovanteDiaria()">
                                    <i class="fas fa-file-pdf"></i> Cupom Diária
                                </button>
                            </div>
                            <div class="d-flex align-items-center gap-2">
                                <button class="btn btn-sm btn-outline-primary btn-nav" onclick="navegarData(-1)">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <span id="dataAtualViagens" class="fw-bold text-white"></span>
                                <button class="btn btn-sm btn-outline-primary btn-nav" onclick="navegarData(1)">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-sm mb-0">
                                    <thead>
                                        <tr>
                                            <th>Obra</th>
                                            <th>Serviço</th>
                                            <th>Local</th>
                                            <th>Veículo</th>
                                            <th>Hora</th>
                                            <th>Qtd</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="tabelaViagensUsuario"></tbody>
                                </table>
                            </div>
                            <div id="semViagens" class="text-center p-4 text-muted" style="display: none;">
                                <i class="fas fa-info-circle"></i> Nenhuma viagem registrada nesta data
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header"><h6>Status do Sistema</h6></div>
                        <div class="card-body">
                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i> Sistema Online<br>
                                <small>Versão Python Flask</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção Obras -->
        <div id="obras-section" class="section" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h5><i class="fas fa-building"></i> Cadastrar Obra</h5>
                </div>
                <div class="card-body">
                    <form id="obraForm">
                        <!-- Nome da Obra -->
                        <div class="mb-4">
                            <label class="form-label fw-bold">NOME DA OBRA</label>
                            <input type="text" class="form-control form-control-lg" id="nomeObra" placeholder="Digite o nome da obra" required>
                        </div>
                        
                        <!-- Seção Serviços -->
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
                        
                        <!-- Seção Locais -->
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
                        
                        <!-- Botão Salvar -->
                        <div class="text-center mb-4">
                            <button type="submit" class="btn btn-primary btn-lg px-5">
                                <i class="fas fa-save"></i> SALVAR OBRA
                            </button>
                        </div>
                    </form>
                    
                    <!-- Lista de Obras Cadastradas -->
                    <div class="mt-5">
                        <h6 class="fw-bold mb-3">OBRAS CADASTRADAS</h6>
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>OBRA</th>
                                        <th>SERVIÇOS</th>
                                        <th>LOCAIS</th>
                                        <th>ATIVA</th>
                                        <th>AÇÕES</th>
                                    </tr>
                                </thead>
                                <tbody id="listaObrasTabela">
                                    <tr>
                                        <td colspan="3" class="text-center text-muted">Nenhuma obra cadastrada</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção Veículos -->
        <div id="veiculos-section" class="section" style="display: none;">
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-truck"></i> Cadastrar Veículo</h5>
                        </div>
                        <div class="card-body">
                            <form id="veiculoForm">
                                <div class="mb-3">
                                    <label class="form-label">VEÍCULO *</label>
                                    <input type="text" class="form-control" id="nomeVeiculo" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">PLACA *</label>
                                    <input type="text" class="form-control" id="placaVeiculo" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">CUBAGEM (m³) *</label>
                                    <input type="number" step="0.01" class="form-control" id="cubagemVeiculo" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">MOTORISTA *</label>
                                    <select class="form-select" id="motoristaVeiculo" required>
                                        <option value="">Selecione um motorista</option>
                                    </select>
                                </div>
                                <button type="submit" class="btn btn-primary w-100">
                                    <i class="fas fa-save"></i> Salvar Veículo
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header"><h6>Veículos Cadastrados</h6></div>
                        <div class="card-body" id="listaVeiculos"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção Profissionais -->
        <div id="profissionais-section" class="section" style="display: none;">
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-user"></i> Cadastrar Profissional</h5>
                        </div>
                        <div class="card-body">
                            <form id="profissionalForm">
                                <div class="mb-3">
                                    <label class="form-label">NOME *</label>
                                    <input type="text" class="form-control" id="nomeProfissional" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">FUNÇÃO *</label>
                                    <input type="text" class="form-control" id="funcaoProfissional" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">CONTATO</label>
                                    <input type="tel" class="form-control" id="contatoProfissional">
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">EMAIL</label>
                                    <input type="email" class="form-control" id="emailProfissional">
                                </div>
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="terceirizadoProfissional">
                                        <label class="form-check-label">Terceirizado</label>
                                    </div>
                                </div>
                                <div class="mb-3" id="empresaDiv" style="display:none;">
                                    <label class="form-label">EMPRESA TERCEIRIZADA</label>
                                    <input type="text" class="form-control" id="empresaProfissional">
                                </div>
                                <button type="submit" class="btn btn-primary w-100">
                                    <i class="fas fa-save"></i> Salvar Profissional
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header"><h6>Profissionais Cadastrados</h6></div>
                        <div class="card-body" id="listaProfissionais"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção Diárias -->
        <div id="diarias-section" class="section" style="display: none;">
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5><i class="fas fa-chart-bar"></i> Relatório de Diárias</h5>
                    <a href="/export/excel" class="btn btn-sm btn-success">
                        <i class="fas fa-file-excel"></i> Exportar Excel
                    </a>
                </div>
                <div class="card-body">
                    <div class="row mb-3">
                        <div class="col-md-12">
                            <label class="form-label">Filtros:</label>
                            <div class="row">
                                <div class="col-md-2">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="filtroVeiculo" onchange="aplicarFiltros()">
                                        <label class="form-check-label" for="filtroVeiculo">Veículo</label>
                                    </div>
                                    <select class="form-select form-select-sm mt-1" id="selectVeiculo" multiple style="display:none;">
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="filtroObra" onchange="aplicarFiltros()">
                                        <label class="form-check-label" for="filtroObra">Obra</label>
                                    </div>
                                    <select class="form-select form-select-sm mt-1" id="selectObra" multiple style="display:none;">
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="filtroMotorista" onchange="aplicarFiltros()">
                                        <label class="form-check-label" for="filtroMotorista">Motorista</label>
                                    </div>
                                    <select class="form-select form-select-sm mt-1" id="selectMotorista" multiple style="display:none;">
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="filtroServico" onchange="aplicarFiltros()">
                                        <label class="form-check-label" for="filtroServico">Serviço</label>
                                    </div>
                                    <select class="form-select form-select-sm mt-1" id="selectServico" multiple style="display:none;">
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="filtroLocal" onchange="aplicarFiltros()">
                                        <label class="form-check-label" for="filtroLocal">Local</label>
                                    </div>
                                    <select class="form-select form-select-sm mt-1" id="selectLocal" multiple style="display:none;">
                                    </select>
                                </div>
                            </div>
                            <div class="row mt-2">
                                <div class="col-md-12">
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-sm btn-primary" onclick="aplicarFiltros()">
                                            <i class="fas fa-filter"></i> Aplicar Filtros
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="limparFiltros()">
                                            <i class="fas fa-times"></i> Limpar Filtros
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-striped" id="tabelaDiarias">
                            <thead>
                                <tr>
                                    <th>Veículo</th>
                                    <th>Placa</th>
                                    <th>Motorista</th>
                                    <th>Cubagem (m³)</th>
                                    <th>Total Viagens</th>
                                    <th>Volume Total (m³)</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="corpoTabelaDiarias"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Seção Meu Veículo -->
        <div id="meu-veiculo-section" class="section" style="display: none;">
            <!-- Cabeçalho da Página -->
            <div class="alert alert-info mb-4 d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-user"></i> <strong>Usuário Logado:</strong> {{ user_name }} (ID: {{ user_id }})
                </div>
                <div id="logoMeuVeiculo" style="display: none;">
                    <img id="logoEmpresaMeuVeiculo" src="" alt="Logo da Empresa" style="max-height: 40px; max-width: 120px;">
                </div>
            </div>
            
            <!-- Dados da Empresa -->
            <div class="card mb-4" id="dadosEmpresaMeuVeiculo">
                <div class="card-body text-center">
                    <h5 id="nomeEmpresaMeuVeiculo"></h5>
                    <p class="mb-1" id="enderecoEmpresaMeuVeiculo"></p>
                    <p class="mb-1" id="telefoneEmpresaMeuVeiculo"></p>
                    <p class="mb-0" id="cnpjEmpresaMeuVeiculo"></p>
                </div>
            </div>
            
            <!-- Resumo do Veículo -->
            <div class="row mb-4">
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-car fa-3x text-primary mb-3"></i>
                            <h4 id="nomeVeiculoMeuVeiculo" class="text-primary">-</h4>
                            <p class="text-muted">Veículo</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-route fa-3x text-success mb-3"></i>
                            <h4 id="totalViagensMeuVeiculo" class="text-success">0</h4>
                            <p class="text-muted">Viagens do Dia</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card text-center">
                        <div class="card-body">
                            <i class="fas fa-cube fa-3x text-info mb-3"></i>
                            <h4 id="volumeTotalMeuVeiculo" class="text-info">0</h4>
                            <p class="text-muted">Volume Total (m³)</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Barra de Navegação Minhas Viagens -->
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center gap-3">
                        <h6><i class="fas fa-list"></i> Minhas Viagens</h6>
                        <button class="btn btn-sm btn-warning" onclick="gerarComprovanteMeuVeiculo()">
                            <i class="fas fa-file-pdf"></i> Cupom Diária
                        </button>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-outline-primary btn-nav" onclick="navegarDataMeuVeiculo(-1)">
                            <i class="fas fa-chevron-left"></i>
                        </button>
                        <span id="dataAtualMeuVeiculo" class="fw-bold text-white"></span>
                        <button class="btn btn-sm btn-outline-primary btn-nav" onclick="navegarDataMeuVeiculo(1)">
                            <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-sm mb-0">
                            <thead>
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>Obra</th>
                                    <th>Serviço</th>
                                    <th>Local</th>
                                    <th>Qtd</th>
                                    <th>Registrado por</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaViagensMeuVeiculo"></tbody>
                        </table>
                    </div>
                    <div id="semViagensMeuVeiculo" class="text-center p-4 text-muted" style="display: none;">
                        <i class="fas fa-info-circle"></i> Nenhuma viagem registrada nesta data
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Seção Painel de Controle -->
        <div id="painel-section" class="section" style="display: none;">
            <div class="row mb-4">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-building"></i> Configurações da Empresa</h5>
                        </div>
                        <div class="card-body">
                            <form id="empresaForm">
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Nome da Empresa</label>
                                        <input type="text" class="form-control" id="nomeEmpresa">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Telefone</label>
                                        <input type="tel" class="form-control" id="telefoneEmpresa">
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-8 mb-3">
                                        <label class="form-label">Endereço</label>
                                        <input type="text" class="form-control" id="enderecoEmpresa">
                                    </div>
                                    <div class="col-md-4 mb-3">
                                        <label class="form-label">CNPJ</label>
                                        <input type="text" class="form-control" id="cnpjEmpresa">
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Logomarca</label>
                                        <div class="input-group">
                                            <input type="url" class="form-control" id="logomarcaEmpresa" placeholder="https://exemplo.com/logo.png">
                                            <button type="button" class="btn btn-outline-primary" onclick="document.getElementById('fileLogomarca').click()">
                                                <i class="fas fa-upload"></i> Selecionar
                                            </button>
                                        </div>
                                        <input type="file" id="fileLogomarca" accept="image/*" style="display: none;">
                                        <small class="text-muted">Cole uma URL ou selecione um arquivo de imagem</small>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label class="form-label">Preview da Logo</label>
                                        <div class="border rounded p-2" style="height: 60px; display: flex; align-items: center; justify-content: center;">
                                            <img id="previewLogo" src="" alt="Logo" style="max-height: 50px; max-width: 200px; display: none;">
                                            <span id="noLogo" class="text-muted">Nenhuma logo carregada</span>
                                        </div>
                                    </div>
                                </div>
                                <button type="submit" class="btn btn-success">
                                    <i class="fas fa-save"></i> Salvar Configurações
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header">
                            <h5><i class="fas fa-cogs"></i> Painel de Controle - Permissões</h5>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">Selecionar Profissional</label>
                                <select class="form-select" id="profissionalPermissao" onchange="carregarPermissoes()">
                                    <option value="">Selecione um profissional</option>
                                </select>
                            </div>
                            
                            <div id="permissoesContainer" style="display: none;">
                                <h6>Permissões de Acesso:</h6>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_adm">
                                            <label class="form-check-label" for="perm_adm">
                                                <strong>ADM</strong> (Criar e trocar senhas)
                                            </label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_dashboard">
                                            <label class="form-check-label" for="perm_dashboard">Dashboard</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_registrar_viagem">
                                            <label class="form-check-label" for="perm_registrar_viagem">Registrar Viagem</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_obras">
                                            <label class="form-check-label" for="perm_obras">Obras</label>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_veiculo">
                                            <label class="form-check-label" for="perm_veiculo">Veículo</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_profissionais">
                                            <label class="form-check-label" for="perm_profissionais">Profissionais</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_diaria">
                                            <label class="form-check-label" for="perm_diaria">Diária</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_meu_veiculo" onchange="handleMeuVeiculoChange()">
                                            <label class="form-check-label" for="perm_meu_veiculo">Meu Veículo</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_painel_controle">
                                            <label class="form-check-label" for="perm_painel_controle">Painel de Controle</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_visualizar_ocorrencias_transportes">
                                            <label class="form-check-label" for="perm_visualizar_ocorrencias_transportes">Ocorrências/Transportes</label>
                                        </div>
                                        <div class="form-check mb-2">
                                            <input class="form-check-input" type="checkbox" id="perm_visualizar_clima_tempo">
                                            <label class="form-check-label" for="perm_visualizar_clima_tempo">Clima Tempo</label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mt-4">
                                    <h6>Criar Usuário e Senha:</h6>
                                    <div class="row">
                                        <div class="col-md-6">
                                            <label class="form-label">Usuário</label>
                                            <input type="text" class="form-control" id="novoUsuario" placeholder="Nome de usuário">
                                        </div>
                                        <div class="col-md-6">
                                            <label class="form-label">Senha</label>
                                            <input type="password" class="form-control" id="novaSenha" placeholder="Senha">
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="button" class="btn btn-success mt-3" onclick="salvarPermissoes()">
                                    <i class="fas fa-save"></i> Salvar Permissões
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h6>Usuários Cadastrados</h6>
                        </div>
                        <div class="card-body" id="listaUsuarios">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Seção Ocorrências/Transportes -->
        <div id="ocorrencias-section" class="section" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h5><i class="fas fa-tools"></i> Ocorrências/Transportes</h5>
                </div>
                <div class="card-body">
                    <form id="ocorrenciaForm">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">OBRA/LOCAL *</label>
                                <select class="form-select" id="obraLocalOcorrencia" required>
                                    <option value="">Selecione uma obra</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">VEÍCULO *</label>
                                <select class="form-select" id="veiculoOcorrencia" required>
                                    <option value="">Selecione um veículo</option>
                                </select>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">MOTIVO PARALIZAÇÃO *</label>
                                <select class="form-select" id="motivoParalizacao" required>
                                    <option value="">Selecione o motivo</option>
                                    <option value="manutenção preventiva">Manutenção Preventiva</option>
                                    <option value="corretiva">Corretiva</option>
                                    <option value="quebra">Quebra</option>
                                    <option value="abastecimento">Abastecimento</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">TIPO MANUTENÇÃO</label>
                                <select class="form-select" id="tipoManutencao">
                                    <option value="">Selecione o tipo</option>
                                    <option value="mecânica">Mecânica</option>
                                    <option value="elétrica">Elétrica</option>
                                    <option value="hidráulica">Hidráulica</option>
                                    <option value="pneus">Pneus</option>
                                    <option value="outros">Outros</option>
                                </select>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">DATA/HORA INÍCIO *</label>
                                <input type="datetime-local" class="form-control" id="dataHoraInicio" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">DATA/HORA RETORNO</label>
                                <input type="datetime-local" class="form-control" id="dataHoraRetorno">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">STATUS</label>
                                <select class="form-select" id="statusOcorrencia">
                                    <option value="em andamento">Em Andamento</option>
                                    <option value="concluído">Concluído</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <div class="form-check mt-4">
                                    <input class="form-check-input" type="checkbox" id="indicadorPreventiva">
                                    <label class="form-check-label">Manutenção Preventiva</label>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">DESCRIÇÃO MANUTENÇÃO</label>
                            <textarea class="form-control" id="descricaoManutencao" rows="3"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">OBSERVAÇÕES</label>
                            <textarea class="form-control" id="observacoesOcorrencia" rows="3"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">FOTO ANEXO</label>
                            <input type="file" class="form-control" id="fotoAnexo" accept="image/*">
                        </div>
                        <button type="submit" class="btn btn-success w-100">
                            <i class="fas fa-save"></i> SALVAR OCORRÊNCIA
                        </button>
                    </form>
                </div>
            </div>
            
            <!-- Lista de Ocorrências -->
            <div class="card mt-4">
                <div class="card-header">
                    <h6>Ocorrências Registradas</h6>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>Veículo</th>
                                    <th>Motivo</th>
                                    <th>Tipo</th>
                                    <th>Status</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="listaOcorrencias"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seção Clima Tempo -->
        <div id="clima-section" class="section" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h5><i class="fas fa-cloud-rain"></i> Clima Tempo</h5>
                </div>
                <div class="card-body">
                    <form id="climaForm">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">DATA OCORRÊNCIA *</label>
                                <input type="date" class="form-control" id="dataOcorrencia" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">OBRA/LOCAL *</label>
                                <select class="form-select" id="obraLocalClima" required>
                                    <option value="">Selecione uma obra</option>
                                </select>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-4 mb-3">
                                <label class="form-label">TIPO CHUVA *</label>
                                <select class="form-select" id="tipoChuva" required>
                                    <option value="">Selecione o tipo</option>
                                    <option value="fraca" style="color: green;">Fraca (Verde)</option>
                                    <option value="moderada" style="color: blue;">Moderada (Azul)</option>
                                    <option value="forte" style="color: red;">Forte (Vermelha)</option>
                                </select>
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">HORA INÍCIO</label>
                                <input type="time" class="form-control" id="horaInicio">
                            </div>
                            <div class="col-md-4 mb-3">
                                <label class="form-label">HORA FIM</label>
                                <input type="time" class="form-control" id="horaFim">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">OBSERVAÇÕES</label>
                            <textarea class="form-control" id="observacoesClima" rows="3"></textarea>
                        </div>
                        <button type="submit" class="btn btn-success w-100">
                            <i class="fas fa-save"></i> SALVAR REGISTRO CLIMA
                        </button>
                    </form>
                </div>
            </div>
            
            <!-- Calendário e Lista de Registros -->
            <div class="row mt-4">
                <div class="col-md-8">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6>Registros de Clima</h6>
                            <div>
                                <button class="btn btn-sm btn-outline-primary" onclick="navegarMesClima(-1)">
                                    <i class="fas fa-chevron-left"></i>
                                </button>
                                <span id="mesAtualClima" class="mx-2"></span>
                                <button class="btn btn-sm btn-outline-primary" onclick="navegarMesClima(1)">
                                    <i class="fas fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-striped">
                                    <thead>
                                        <tr>
                                            <th>Data</th>
                                            <th>Obra</th>
                                            <th>Tipo Chuva</th>
                                            <th>Horário</th>
                                            <th>Tempo Total</th>
                                            <th>Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody id="listaClima"></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="card">
                        <div class="card-header">
                            <h6>Totais Mensais</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-2">
                                <span class="badge bg-success me-2">Fraca:</span>
                                <span id="totalFraca">0</span> registros
                            </div>
                            <div class="mb-2">
                                <span class="badge bg-primary me-2">Moderada:</span>
                                <span id="totalModerada">0</span> registros
                            </div>
                            <div class="mb-2">
                                <span class="badge bg-danger me-2">Forte:</span>
                                <span id="totalForte">0</span> registros
                            </div>
                            <hr>
                            <div>
                                <strong>Total: <span id="totalGeral">0</span> registros</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </div>
    </div>

    <!-- Modal Seleção de Veículo -->
    <div class="modal fade" id="modalSelecaoVeiculo" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="fas fa-car"></i> Selecionar Veículo</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Para habilitar a permissão "Meu Veículo", é necessário associar um veículo ao profissional:</p>
                    <div class="mb-3">
                        <label class="form-label">VEÍCULOS CADASTRADOS</label>
                        <select class="form-select" id="selectVeiculoModal" required>
                            <option value="">Selecione um veículo</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" onclick="cancelarSelecaoVeiculo()">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="confirmarSelecaoVeiculo()">Confirmar</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal Viagens por Veículo -->
    <div class="modal fade" id="modalViagensVeiculo" tabindex="-1">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title"><i class="fas fa-list"></i> Viagens do Veículo: <span id="nomeVeiculoModal"></span></h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Data/Hora</th>
                                    <th>Obra</th>
                                    <th>Serviço</th>
                                    <th>Local</th>
                                    <th>Qtd Viagens</th>
                                    <th>Registrado por</th>
                                    <th>Ações</th>
                                </tr>
                            </thead>
                            <tbody id="tabelaViagensVeiculo"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        let obras = [];
        let veiculos = [];
        let profissionais = [];
        let servicosSelecionados = [];
        let locaisSelecionados = [];
        let servicos = [];
        let locais = [];
        let obrasAtivas = new Set();
        let dataAtualMeuVeiculo = new Date();
        dataAtualMeuVeiculo.setHours(0, 0, 0, 0);
        let veiculoSelecionadoModal = null;
        let profissionalSelecionadoModal = null;
        let veiculoAssociadoAtual = null; // Armazena o veículo associado ao usuário logado

        // Permissões do usuário
        const userPermissions = {
            adm: {{ 'true' if permissoes.adm else 'false' }},
            dashboard: {{ 'true' if permissoes.dashboard else 'false' }},
            registrar_viagem: {{ 'true' if permissoes.registrar_viagem else 'false' }},
            obras: {{ 'true' if permissoes.obras else 'false' }},
            veiculo: {{ 'true' if permissoes.veiculo else 'false' }},
            profissionais: {{ 'true' if permissoes.profissionais else 'false' }},
            diaria: {{ 'true' if permissoes.diaria else 'false' }},
            meu_veiculo: {{ 'true' if permissoes.meu_veiculo else 'false' }},
            painel_controle: {{ 'true' if permissoes.painel_controle else 'false' }}
        };
        
        // Dados do usuário logado
        const currentUser = {
            id: {{ user_id }},
            name: '{{ user_name }}'
        };
        
        // Controle de navegação de datas
        let dataAtualVisualizacao = new Date();
        dataAtualVisualizacao.setHours(0, 0, 0, 0);

        document.addEventListener('DOMContentLoaded', function() {
            // Verificar se usuário tem pelo menos uma permissão
            const temPermissao = Object.values(userPermissions).some(perm => perm === true);
            if (!temPermissao) {
                document.body.innerHTML = `
                    <div class="container mt-5">
                        <div class="alert alert-warning text-center">
                            <h4><i class="fas fa-exclamation-triangle"></i> Acesso Negado</h4>
                            <p>Você não possui permissões para acessar nenhuma seção do sistema.</p>
                            <p>Entre em contato com o administrador para solicitar acesso.</p>
                            <a href="/logout" class="btn btn-primary">Sair</a>
                        </div>
                    </div>
                `;
                return;
            }
            
            carregarDados();
            configurarFormularios();
            
            // Configurar formulários das novas páginas
            const ocorrenciaForm = document.getElementById('ocorrenciaForm');
            if (ocorrenciaForm) {
                ocorrenciaForm.addEventListener('submit', salvarOcorrencia);
            }
            
            const climaForm = document.getElementById('climaForm');
            if (climaForm) {
                climaForm.addEventListener('submit', salvarClima);
            }
            
            const agora = new Date();
            const dataViagem = document.getElementById('dataHoraViagem');
            if (dataViagem) {
                agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
                dataViagem.value = agora.toISOString().slice(0, 16);
            }
            
            // Preencher campos do usuário logado
            const nomeUsuarioField = document.getElementById('nomeUsuarioViagem');
            const idUsuarioField = document.getElementById('idUsuarioViagem');
            if (nomeUsuarioField) nomeUsuarioField.value = currentUser.name;
            if (idUsuarioField) idUsuarioField.value = currentUser.id;
            
            // Mostrar primeira seção disponível baseada nas permissões
            const secoes = ['dashboard', 'registrar_viagem', 'obras', 'veiculo', 'profissionais', 'diaria', 'visualizar_ocorrencias_transportes', 'visualizar_clima_tempo', 'meu_veiculo', 'painel_controle'];
            const nomeSecoes = ['dashboard', 'viagens', 'obras', 'veiculos', 'profissionais', 'diarias', 'ocorrencias', 'clima', 'meu-veiculo', 'painel'];
            
            for (let i = 0; i < secoes.length; i++) {
                if (userPermissions.adm || userPermissions[secoes[i]]) {
                    showSection(nomeSecoes[i]);
                    // Forçar carregamento do dashboard se for a primeira seção
                    if (nomeSecoes[i] === 'dashboard') {
                        setTimeout(() => carregarDashboard(), 500);
                    }
                    break;
                }
            }
        });

        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('content');
            
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
            
            if (window.innerWidth > 768) {
                content.classList.toggle('shifted');
            }
        }
        
        function closeSidebar() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('overlay');
            const content = document.getElementById('content');
            
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            content.classList.remove('shifted');
        }
        
        function showSection(sectionName) {
            // Mapear nome da seção para permissão
            const sectionPermissionMap = {
                'dashboard': 'dashboard',
                'viagens': 'registrar_viagem',
                'obras': 'obras',
                'veiculos': 'veiculo',
                'profissionais': 'profissionais',
                'diarias': 'diaria',
                'meu-veiculo': 'meu_veiculo',
                'painel': 'painel_controle'
            };
            
            const requiredPermission = sectionPermissionMap[sectionName];
            
            // Verificar permissão - admin tem acesso total
            if (!userPermissions.adm && !userPermissions[requiredPermission]) {
                alert('Você não tem permissão para acessar esta seção.');
                return;
            }
            
            document.querySelectorAll('.section').forEach(section => {
                section.style.display = 'none';
            });
            
            const targetSection = document.getElementById(sectionName + '-section');
            if (targetSection) {
                targetSection.style.display = 'block';
            }
            
            document.querySelectorAll('.sidebar-menu a').forEach(link => {
                link.classList.remove('active');
            });
            if (event && event.target) {
                event.target.classList.add('active');
            }
            
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
            
            // Carregar dados específicos da seção (já passou na verificação de permissão)
            if (sectionName === 'dashboard') {
                // Forçar carregamento completo do dashboard
                setTimeout(() => carregarDashboard(), 100);
            }
            if (sectionName === 'diarias') { carregarDiarias(); carregarFiltros(); }
            if (sectionName === 'obras') { 
                setTimeout(() => {
                    renderizarServicosBoxes();
                    renderizarLocaisBoxes();
                    listarObras();
                }, 100);
            }
            if (sectionName === 'veiculos') { listarVeiculos(); carregarMotoristas(); }
            if (sectionName === 'profissionais') listarProfissionais();
            if (sectionName === 'viagens') { carregarMotoristas(); carregarViagensUsuario(); }
            if (sectionName === 'meu-veiculo') { carregarMeuVeiculo(); }
            if (sectionName === 'painel') { carregarPainelControle(); carregarEmpresaConfig(); }
            if (sectionName === 'ocorrencias') { carregarOcorrencias(); carregarDadosNovosModulos(); }
            if (sectionName === 'clima') { carregarClimaRegistros(); carregarDadosNovosModulos(); }
        }

        function configurarFormularios() {
            document.getElementById('viagemForm').addEventListener('submit', salvarViagem);
            document.getElementById('obraForm').addEventListener('submit', salvarObra);
            document.getElementById('veiculoForm').addEventListener('submit', salvarVeiculo);
            document.getElementById('profissionalForm').addEventListener('submit', salvarProfissional);
            document.getElementById('empresaForm').addEventListener('submit', salvarEmpresa);
            
            document.getElementById('terceirizadoProfissional').addEventListener('change', function() {
                document.getElementById('empresaDiv').style.display = this.checked ? 'block' : 'none';
            });
            
            document.getElementById('logomarcaEmpresa').addEventListener('input', function() {
                const url = this.value;
                const preview = document.getElementById('previewLogo');
                const noLogo = document.getElementById('noLogo');
                
                if (url) {
                    preview.src = url;
                    preview.style.display = 'block';
                    noLogo.style.display = 'none';
                } else {
                    preview.style.display = 'none';
                    noLogo.style.display = 'block';
                }
            });
            
            document.getElementById('fileLogomarca').addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        const base64 = e.target.result;
                        document.getElementById('logomarcaEmpresa').value = base64;
                        document.getElementById('previewLogo').src = base64;
                        document.getElementById('previewLogo').style.display = 'block';
                        document.getElementById('noLogo').style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                } else {
                    alert('Por favor, selecione um arquivo de imagem válido.');
                }
            });
        }

        async function carregarDados() {
            const promises = [];
            
            // Carregar obras ativas para todos os usuários (necessário para registrar viagem)
            promises.push(carregarObrasAtivas());
            
            if (userPermissions.adm || userPermissions.obras || userPermissions.registrar_viagem) {
                promises.push(carregarObras());
                promises.push(carregarServicos());
                promises.push(carregarLocais());
            }
            if (userPermissions.adm || userPermissions.veiculo || userPermissions.registrar_viagem || userPermissions.diaria) promises.push(carregarVeiculos());
            if (userPermissions.adm || userPermissions.profissionais || userPermissions.veiculo || userPermissions.registrar_viagem) promises.push(carregarProfissionais());
            
            if (promises.length > 0) {
                await Promise.all(promises);
            }
        }
        
        async function carregarObrasAtivas() {
            try {
                const response = await fetch('/api/obras-ativas');
                if (response.ok) {
                    const obrasAtivasArray = await response.json();
                    obrasAtivas = new Set(obrasAtivasArray);
                }
            } catch (error) {
                console.error('Erro ao carregar obras ativas:', error);
                obrasAtivas = new Set(); // Inicializar vazio em caso de erro
            }
        }
        
        async function carregarServicos() {
            try {
                const response = await fetch('/api/obras');
                if (response.status === 403) return;
                const obrasData = await response.json();
                servicos = [...new Set(obrasData.map(o => o.servico))].map(s => ({nome_servico: s}));
                renderizarServicosBoxes();
            } catch (error) {
                console.error('Erro ao carregar serviços:', error);
            }
        }
        
        async function carregarLocais() {
            try {
                const response = await fetch('/api/obras');
                if (response.status === 403) return;
                const obrasData = await response.json();
                locais = [...new Set(obrasData.map(o => o.local))].map(l => ({nome_local: l}));
                renderizarLocaisBoxes();
            } catch (error) {
                console.error('Erro ao carregar locais:', error);
            }
        }

        async function carregarObras() {
            try {
                const response = await fetch('/api/obras');
                if (response.status === 403) {
                    // Se não tem permissão para obras, ainda assim carregar obras ativas para o select
                    const select = document.getElementById('obraSelect');
                    if (select) {
                        select.innerHTML = '<option value="">Selecione uma obra</option>';
                        
                        // Usar apenas as obras ativas disponíveis
                        Array.from(obrasAtivas).forEach(nomeObra => {
                            const option = document.createElement('option');
                            option.value = nomeObra;
                            option.textContent = nomeObra;
                            select.appendChild(option);
                        });
                    }
                    return;
                }
                
                obras = await response.json();
                
                const select = document.getElementById('obraSelect');
                if (select) {
                    select.innerHTML = '<option value="">Selecione uma obra</option>';
                    
                    const obrasUnicas = [...new Set(obras.map(o => o.nome_obra))];
                    
                    // Filtrar apenas obras ativas para o select
                    const obrasParaExibir = obrasUnicas.filter(nomeObra => obrasAtivas.has(nomeObra));
                    
                    obrasParaExibir.forEach(nomeObra => {
                        const option = document.createElement('option');
                        option.value = nomeObra;
                        option.textContent = nomeObra;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Erro ao carregar obras:', error);
            }
        }

        async function carregarVeiculos() {
            try {
                const response = await fetch('/api/veiculos');
                if (response.status === 403) {
                    console.log('Sem permissão para carregar veículos');
                    return;
                }
                veiculos = await response.json();
                
                const select = document.getElementById('veiculoSelect');
                if (select) {
                    select.innerHTML = '<option value="">Selecione um veículo</option>';
                    
                    veiculos.forEach(veiculo => {
                        const option = document.createElement('option');
                        option.value = veiculo.id_veiculo;
                        option.textContent = `${veiculo.veiculo} - ${veiculo.placa} (${veiculo.motorista})`;
                        select.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Erro ao carregar veículos:', error);
            }
        }

        async function carregarProfissionais() {
            try {
                const response = await fetch('/api/profissionais');
                if (response.status === 403) {
                    console.log('Sem permissão para carregar profissionais');
                    return;
                }
                profissionais = await response.json();
                carregarMotoristas();
            } catch (error) {
                console.error('Erro ao carregar profissionais:', error);
            }
        }
        
        function carregarMotoristas() {
            const motoristas = profissionais.filter(p => p.funcao.toLowerCase().includes('motorista'));
            
            const selectVeiculo = document.getElementById('motoristaVeiculo');
            if (selectVeiculo) {
                selectVeiculo.innerHTML = '<option value="">Selecione um motorista</option>';
                motoristas.forEach(motorista => {
                    const option = document.createElement('option');
                    option.value = motorista.nome;
                    option.textContent = motorista.nome;
                    selectVeiculo.appendChild(option);
                });
            }
            
            const selectViagem = document.getElementById('motoristaViagem');
            if (selectViagem) {
                selectViagem.innerHTML = '<option value="">Selecione um motorista</option>';
                motoristas.forEach(motorista => {
                    const option = document.createElement('option');
                    option.value = motorista.nome;
                    option.textContent = motorista.nome;
                    selectViagem.appendChild(option);
                });
            }
        }
        
        async function salvarViagem(e) {
            e.preventDefault();
            const form = document.getElementById('viagemForm');
            const editId = form.getAttribute('data-edit-id');
            
            const nomeObra = document.getElementById('obraSelect').value;
            const servico = document.getElementById('servicoSelect').value;
            const local = document.getElementById('localSelect').value;
            
            if (!nomeObra || !servico || !local) {
                alert('Por favor, selecione obra, serviço e local!');
                return;
            }
            
            const dados = {
                nome_obra: nomeObra,
                servico: servico,
                local: local,
                id_veiculo: parseInt(document.getElementById('veiculoSelect').value),
                data_hora: document.getElementById('dataHoraViagem').value,
                quantidade_viagens: 1,
                id_usuario: currentUser.id,
                nome_usuario: currentUser.name
            };
            
            try {
                let response;
                if (editId) {
                    response = await fetch(`/api/viagens/${editId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                } else {
                    response = await fetch('/api/viagens', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                }
                
                const result = await response.json();
                
                if (result.success) {
                    alert(editId ? 'Viagem atualizada com sucesso!' : 'Viagem registrada com sucesso!');
                    form.reset();
                    form.removeAttribute('data-edit-id');
                    
                    document.getElementById('servicoSelect').innerHTML = '<option value="">Selecione um serviço</option>';
                    document.getElementById('localSelect').innerHTML = '<option value="">Selecione um local</option>';
                    
                    const agora = new Date();
                    agora.setMinutes(agora.getMinutes() - agora.getTimezoneOffset());
                    document.getElementById('dataHoraViagem').value = agora.toISOString().slice(0, 16);
                    
                    // Recarregar dados do usuário
                    document.getElementById('nomeUsuarioViagem').value = currentUser.name;
                    document.getElementById('idUsuarioViagem').value = currentUser.id;
                    
                    // Recarregar tabela de viagens do usuário
                    carregarViagensUsuario();
                } else {
                    alert('Erro: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                alert('Erro ao salvar viagem: ' + error.message);
            }
        }

        async function salvarObra(e) {
            e.preventDefault();
            const form = document.getElementById('obraForm');
            const nomeObra = document.getElementById('nomeObra').value.trim();
            const obraEditando = form.getAttribute('data-edit-obra');
            
            if (!nomeObra) {
                alert('Nome da obra é obrigatório');
                return;
            }
            
            if (servicosSelecionados.length === 0) {
                alert('Selecione pelo menos um serviço');
                return;
            }
            
            if (locaisSelecionados.length === 0) {
                alert('Selecione pelo menos um local');
                return;
            }
            
            try {
                // Se está editando, remover entradas antigas do banco
                if (obraEditando) {
                    // Remover todas as entradas da obra antiga do banco
                    const deletePromises = obras
                        .filter(o => o.nome_obra === obraEditando)
                        .map(obra => 
                            fetch(`/api/obras/${obra.id_obra}?force=true`, { method: 'DELETE' })
                        );
                    await Promise.all(deletePromises);
                    
                    // Remover do estado local
                    obras = obras.filter(o => o.nome_obra !== obraEditando);
                    obrasAtivas.delete(obraEditando);
                }
                
                const promises = [];
                
                for (const servico of servicosSelecionados) {
                    for (const local of locaisSelecionados) {
                        const dados = {
                            nome_obra: nomeObra,
                            servico: servico,
                            local: local
                        };
                        
                        promises.push(
                            fetch('/api/obras', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(dados)
                            })
                        );
                    }
                }
                
                await Promise.all(promises);
                
                alert(obraEditando ? 'Obra atualizada com sucesso!' : 'Obra cadastrada com sucesso!');
                form.reset();
                form.removeAttribute('data-edit-obra');
                servicosSelecionados = [];
                locaisSelecionados = [];
                renderizarServicosBoxes();
                renderizarLocaisBoxes();
                // Marcar a obra como ativa por padrão (já salvo no backend)
                obrasAtivas.add(nomeObra);
                await carregarObras();
                listarObras();
            } catch (error) {
                alert('Erro ao salvar obra');
            }
        }

        async function salvarVeiculo(e) {
            e.preventDefault();
            const form = document.getElementById('veiculoForm');
            const editId = form.getAttribute('data-edit-id');
            
            const dados = {
                veiculo: document.getElementById('nomeVeiculo').value,
                placa: document.getElementById('placaVeiculo').value,
                cubagem_m3: document.getElementById('cubagemVeiculo').value,
                motorista: document.getElementById('motoristaVeiculo').value
            };
            
            try {
                let response;
                if (editId) {
                    response = await fetch(`/api/veiculos/${editId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                } else {
                    response = await fetch('/api/veiculos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                }
                
                if (response.ok) {
                    alert(editId ? 'Veículo atualizado com sucesso!' : 'Veículo cadastrado com sucesso!');
                    form.reset();
                    form.removeAttribute('data-edit-id');
                    await carregarVeiculos();
                    listarVeiculos();
                }
            } catch (error) {
                alert('Erro ao salvar veículo');
            }
        }

        async function salvarProfissional(e) {
            e.preventDefault();
            const form = document.getElementById('profissionalForm');
            const editId = form.getAttribute('data-edit-id');
            
            const dados = {
                nome: document.getElementById('nomeProfissional').value,
                funcao: document.getElementById('funcaoProfissional').value,
                contato: document.getElementById('contatoProfissional').value,
                email: document.getElementById('emailProfissional').value,
                terceirizado: document.getElementById('terceirizadoProfissional').checked,
                empresa_terceirizada: document.getElementById('empresaProfissional').value
            };
            
            try {
                let response;
                if (editId) {
                    response = await fetch(`/api/profissionais/${editId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                } else {
                    response = await fetch('/api/profissionais', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                }
                
                if (response.ok) {
                    alert(editId ? 'Profissional atualizado com sucesso!' : 'Profissional cadastrado com sucesso!');
                    form.reset();
                    form.removeAttribute('data-edit-id');
                    document.getElementById('empresaDiv').style.display = 'none';
                    await carregarProfissionais();
                    listarProfissionais();
                }
            } catch (error) {
                alert('Erro ao salvar profissional');
            }
        }

        function listarObras() {
            const tbody = document.getElementById('listaObrasTabela');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            if (obras.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma obra cadastrada</td></tr>';
                return;
            }
            
            // Agrupar obras por nome
            const obrasAgrupadas = {};
            obras.forEach(obra => {
                if (!obrasAgrupadas[obra.nome_obra]) {
                    obrasAgrupadas[obra.nome_obra] = { servicos: [], locais: [], id: obra.id_obra };
                }
                if (!obrasAgrupadas[obra.nome_obra].servicos.includes(obra.servico)) {
                    obrasAgrupadas[obra.nome_obra].servicos.push(obra.servico);
                }
                if (!obrasAgrupadas[obra.nome_obra].locais.includes(obra.local)) {
                    obrasAgrupadas[obra.nome_obra].locais.push(obra.local);
                }
            });
            
            Object.keys(obrasAgrupadas).forEach(nomeObra => {
                const obra = obrasAgrupadas[nomeObra];
                const isAtiva = obrasAtivas.has(nomeObra);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><strong>${nomeObra}</strong></td>
                    <td>${obra.servicos.join(', ')}</td>
                    <td>${obra.locais.join(', ')}</td>
                    <td class="text-center">
                        <input type="checkbox" class="form-check-input" ${isAtiva ? 'checked' : ''} 
                               onchange="toggleObraAtiva('${nomeObra}', this.checked)">
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editarObra('${nomeObra}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirObra('${nomeObra}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function listarVeiculos() {
            const lista = document.getElementById('listaVeiculos');
            lista.innerHTML = '';
            
            veiculos.forEach(veiculo => {
                const item = document.createElement('div');
                item.className = 'border-start border-success border-3 ps-3 mb-2';
                item.innerHTML = `
                    <div>
                        <strong>${veiculo.veiculo}</strong> - ${veiculo.placa}<br>
                        <small class="text-muted">Motorista: ${veiculo.motorista}</small><br>
                        <small class="text-muted">Cubagem: ${veiculo.cubagem_m3} m³</small>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editarVeiculo(${veiculo.id_veiculo})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirVeiculo(${veiculo.id_veiculo})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                item.className = 'border-start border-success border-3 ps-3 mb-2 d-flex justify-content-between align-items-start';
                lista.appendChild(item);
            });
        }

        function listarProfissionais() {
            const lista = document.getElementById('listaProfissionais');
            lista.innerHTML = '';
            
            profissionais.forEach(profissional => {
                const item = document.createElement('div');
                item.className = 'border-start border-info border-3 ps-3 mb-2';
                item.innerHTML = `
                    <div>
                        <strong>${profissional.nome}</strong><br>
                        <small class="text-muted">Função: ${profissional.funcao}</small><br>
                        ${profissional.contato ? `<small class="text-muted">Contato: ${profissional.contato}</small><br>` : ''}
                        ${profissional.email ? `<small class="text-muted">Email: ${profissional.email}</small><br>` : ''}
                        ${profissional.terceirizado ? `<small class="text-warning">Terceirizado${profissional.empresa_terceirizada ? ` - ${profissional.empresa_terceirizada}` : ''}</small>` : ''}
                    </div>
                    <div>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editarProfissional(${profissional.id_profissional})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirProfissional(${profissional.id_profissional})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                item.className = 'border-start border-info border-3 ps-3 mb-2 d-flex justify-content-between align-items-start';
                lista.appendChild(item);
            });
        }

        async function carregarDiarias() {
            const response = await fetch('/api/diarias');
            const diarias = await response.json();
            
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
                    <td>
                        <button class="btn btn-sm btn-outline-info" onclick="verViagensVeiculo(${diaria.id_veiculo}, '${diaria.veiculo}')">
                            <i class="fas fa-list"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
            
            const totalRow = document.createElement('tr');
            totalRow.className = 'table-warning fw-bold';
            totalRow.innerHTML = `
                <td colspan="4">TOTAIS</td>
                <td class="text-center">${totalViagens}</td>
                <td class="text-end">${totalVolume.toFixed(2)}</td>
                <td></td>
            `;
            tbody.appendChild(totalRow);
        }
        
        async function carregarDashboard() {
            try {
                console.log('Carregando dashboard...');
                const timestamp = Date.now();
                const [obras, veiculos, viagens, kpis] = await Promise.all([
                    fetch(`/api/obras?_t=${timestamp}`).then(r => r.json()),
                    fetch(`/api/veiculos?_t=${timestamp}`).then(r => r.json()),
                    fetch(`/api/viagens?_t=${timestamp}`).then(r => r.json()),
                    fetch(`/api/dashboard-kpis?_t=${timestamp}`).then(r => r.json())
                ]);
                
                console.log('Dados carregados:', { obras: obras.length, veiculos: veiculos.length, viagens: viagens.length });
                console.log('KPIs carregados:', kpis);
                
                await carregarFiltrosDashboard(obras, veiculos, viagens);
                atualizarCardsDashboard(obras, veiculos, viagens);
                criarGraficos(veiculos, viagens, obras);
                atualizarKPIsAvancados(kpis);
                carregarGraficosAvancados();
                carregarLogoDashboard();
                carregarTabelaParalizacoes();
                
                console.log('Dashboard carregado com sucesso!');
            } catch (error) {
                console.error('Erro ao carregar dashboard:', error);
            }
        }
        
        function atualizarKPIsAvancados(kpis) {
            console.log('KPIs recebidos:', kpis);
            document.getElementById('kpiOcorrencias').textContent = kpis.ocorrencias_andamento || 0;
            document.getElementById('kpiChuvas').textContent = kpis.chuvas_mes || 0;
            
            // Use calculated values from backend
            const disponibilidade = kpis.disponibilidade_media || 100;
            document.getElementById('kpiDisponibilidade').textContent = disponibilidade + '%';
            
            // Use calculated average stopped hours
            document.getElementById('kpiTempoParado').textContent = (kpis.tempo_parado_medio || 0) + 'h';
            
            // Use calculated efficiency average
            const eficiencia = kpis.eficiencia_media || 0;
            document.getElementById('kpiEficiencia').textContent = eficiencia + '%';
            
            // Score de performance (média dos indicadores)
            const performance = Math.round((disponibilidade + eficiencia) / 2);
            document.getElementById('kpiPerformance').textContent = performance;
        }
        
        async function carregarGraficosAvancados() {
            try {
                // Get current dashboard filters
                const filtros = {};
                
                ['Obra', 'Veiculo', 'Motorista', 'Servico', 'Local'].forEach(tipoFiltro => {
                    const checkbox = document.getElementById(`dashFiltro${tipoFiltro}`);
                    const select = document.getElementById(`dashSelect${tipoFiltro}`);
                    if (checkbox && checkbox.checked && select && select.selectedOptions.length > 0) {
                        filtros[tipoFiltro.toLowerCase()] = Array.from(select.selectedOptions).map(o => o.value).join(',');
                    }
                });
                
                const checkboxData = document.getElementById('dashFiltroData');
                if (checkboxData && checkboxData.checked) {
                    const dataInicio = document.getElementById('dashDataInicio').value;
                    const dataFim = document.getElementById('dashDataFim').value;
                    if (dataInicio && dataFim) {
                        filtros.data_inicio = dataInicio;
                        filtros.data_fim = dataFim;
                    }
                }
                
                // Build URL parameters
                const params = new URLSearchParams(filtros);
                const queryString = params.toString();
                
                const [produtividade, paralizacoes, chuvas, kpis] = await Promise.all([
                    fetch(`/api/relatorio-produtividade?${queryString}`).then(r => r.json()),
                    fetch(`/api/relatorio-paralizacoes?${queryString}`).then(r => r.json()),
                    fetch(`/api/relatorio-chuvas?${queryString}`).then(r => r.json()),
                    fetch(`/api/dashboard-kpis?${queryString}`).then(r => r.json())
                ]);
                
                // Update KPIs with filtered data
                atualizarKPIsAvancados(kpis);
                
                criarGraficoMotoristas(produtividade.motoristas);
                criarGraficoFrota(produtividade.frota);
                criarGraficoParalizacoes(paralizacoes);
                criarGraficoClima(chuvas);
                
                // Update table with current data
                await carregarTabelaParalizacoes();
                
            } catch (error) {
                console.error('Erro ao carregar gráficos avançados:', error);
            }
        }
        
        function criarGraficoMotoristas(dados) {
            const ctx = document.getElementById('chartMotoristas').getContext('2d');
            if (ctx.canvas.chart) ctx.canvas.chart.destroy();
            
            const top10 = dados.slice(0, 10);
            
            ctx.canvas.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10.map(d => d.motorista),
                    datasets: [{
                        label: 'Total Viagens',
                        data: top10.map(d => d.quantidade_total),
                        backgroundColor: '#3498db',
                        borderColor: '#2980b9',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
        function criarGraficoFrota(dados) {
            const ctx = document.getElementById('chartFrota').getContext('2d');
            if (ctx.canvas.chart) ctx.canvas.chart.destroy();
            
            // Get unproductive hours data
            fetch('/api/relatorio-paralizacoes?' + new URLSearchParams({
                obra: document.getElementById('dashSelectObra') ? Array.from(document.getElementById('dashSelectObra').selectedOptions).map(o => o.value).join(',') : '',
                veiculo: document.getElementById('dashSelectVeiculo') ? Array.from(document.getElementById('dashSelectVeiculo').selectedOptions).map(o => o.value).join(',') : '',
                motorista: document.getElementById('dashSelectMotorista') ? Array.from(document.getElementById('dashSelectMotorista').selectedOptions).map(o => o.value).join(',') : '',
                data_inicio: document.getElementById('dashDataInicio') ? document.getElementById('dashDataInicio').value : '',
                data_fim: document.getElementById('dashDataFim') ? document.getElementById('dashDataFim').value : ''
            }).toString())
            .then(r => r.json())
            .then(paralizacoes => {
                // Calculate unproductive hours by vehicle
                const horasImprodutivas = {};
                paralizacoes.forEach(p => {
                    if (p.veiculo && p.data_hora_inicio) {
                        const inicio = new Date(p.data_hora_inicio);
                        let horas = 0;
                        
                        if (p.data_hora_retorno) {
                            const retorno = new Date(p.data_hora_retorno);
                            horas = (retorno - inicio) / (1000 * 60 * 60); // Convert to hours
                        } else {
                            // If no return time, calculate from start to now
                            const agora = new Date();
                            horas = (agora - inicio) / (1000 * 60 * 60);
                        }
                        
                        horasImprodutivas[p.veiculo] = (horasImprodutivas[p.veiculo] || 0) + Math.max(0, horas);
                    }
                });
                
                const veiculos = Object.keys(horasImprodutivas);
                const horas = Object.values(horasImprodutivas);
                
                ctx.canvas.chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: veiculos,
                        datasets: [{
                            label: 'Horas Improdutivas',
                            data: horas,
                            backgroundColor: '#e74c3c',
                            borderColor: '#c0392b',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        scales: {
                            x: { beginAtZero: true, title: { display: true, text: 'Horas' } },
                            y: { title: { display: true, text: 'Veículos' } }
                        }
                    }
                });
            })
            .catch(() => {
                // Fallback if API fails
                ctx.canvas.chart = new Chart(ctx, {
                    type: 'bar',
                    data: { labels: [], datasets: [{ label: 'Horas Improdutivas', data: [], backgroundColor: '#e74c3c' }] },
                    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y' }
                });
            });
        }
        
        function criarGraficoParalizacoes(dados) {
            const ctx = document.getElementById('chartParalizacoes').getContext('2d');
            if (ctx.canvas.chart) ctx.canvas.chart.destroy();
            
            // Agrupar por motivo
            const motivos = {};
            dados.forEach(d => {
                const motivo = d.motivo_paralizacao || 'Não informado';
                motivos[motivo] = (motivos[motivo] || 0) + 1;
            });
            
            ctx.canvas.chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(motivos),
                    datasets: [{
                        data: Object.values(motivos),
                        backgroundColor: ['#e74c3c', '#f39c12', '#9b59b6', '#34495e', '#2ecc71', '#3498db'],
                        borderWidth: 2,
                        borderColor: '#ffffff'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '50%',
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        function criarGraficoClima(dados) {
            const ctx = document.getElementById('chartClima').getContext('2d');
            if (ctx.canvas.chart) ctx.canvas.chart.destroy();
            
            // Agrupar por tipo de chuva
            const tipos = { fraca: 0, moderada: 0, forte: 0 };
            dados.forEach(d => {
                if (d.tipo_chuva && tipos.hasOwnProperty(d.tipo_chuva)) {
                    tipos[d.tipo_chuva]++;
                }
            });
            
            ctx.canvas.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Fraca', 'Moderada', 'Forte'],
                    datasets: [{
                        label: 'Registros de Chuva',
                        data: [tipos.fraca, tipos.moderada, tipos.forte],
                        backgroundColor: ['#2ecc71', '#3498db', '#e74c3c']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }
        
        function gerarRelatorioPDF(tipo) {
            // Get current dashboard filters
            const filtros = {};
            
            ['Obra', 'Veiculo', 'Motorista', 'Servico', 'Local'].forEach(tipoFiltro => {
                const checkbox = document.getElementById(`dashFiltro${tipoFiltro}`);
                const select = document.getElementById(`dashSelect${tipoFiltro}`);
                if (checkbox && checkbox.checked && select && select.selectedOptions.length > 0) {
                    filtros[tipoFiltro.toLowerCase()] = Array.from(select.selectedOptions).map(o => o.value).join(',');
                }
            });
            
            const checkboxData = document.getElementById('dashFiltroData');
            if (checkboxData && checkboxData.checked) {
                const dataInicio = document.getElementById('dashDataInicio').value;
                const dataFim = document.getElementById('dashDataFim').value;
                if (dataInicio && dataFim) {
                    filtros.data_inicio = dataInicio;
                    filtros.data_fim = dataFim;
                }
            }
            
            // Build URL with filters
            const params = new URLSearchParams(filtros);
            const url = `/api/relatorio-pdf/${tipo}?${params}`;
            window.open(url, '_blank');
        }
        
        function carregarLogoDashboard() {
            fetch('/api/empresa-config')
                .then(response => response.json())
                .then(config => {
                    if (config.logomarca) {
                        document.getElementById('logoEmpresaDashboard').src = config.logomarca;
                        document.getElementById('logoDashboard').style.display = 'block';
                    }
                })
                .catch(error => console.log('Logo do dashboard não carregada'));
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
                
                // Add event listener for dynamic filtering
                selectObra.addEventListener('change', atualizarFiltrosDependentesDashboard);
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
            
            const selectServico = document.getElementById('dashSelectServico');
            if (selectServico) {
                selectServico.innerHTML = '';
                [...new Set(obras.map(o => o.servico))].forEach(s => {
                    const option = document.createElement('option');
                    option.value = s;
                    option.textContent = s;
                    selectServico.appendChild(option);
                });
            }
            
            const selectLocal = document.getElementById('dashSelectLocal');
            if (selectLocal) {
                selectLocal.innerHTML = '';
                [...new Set(obras.map(o => o.local))].forEach(l => {
                    const option = document.createElement('option');
                    option.value = l;
                    option.textContent = l;
                    selectLocal.appendChild(option);
                });
            }
        }
        
        function atualizarCardsDashboard(obras, veiculos, viagens) {
            // Contar obras únicas nas viagens filtradas
            const obrasUnicas = [...new Set(viagens.map(v => v.nome_obra))];
            document.getElementById('totalObras').textContent = obrasUnicas.length;
            
            // Contar veículos únicos nas viagens filtradas
            const veiculosUnicos = [...new Set(viagens.map(v => v.id_veiculo))];
            document.getElementById('totalVeiculos').textContent = veiculosUnicos.length;
            
            // Total de viagens filtradas
            document.getElementById('totalViagens').textContent = viagens.reduce((sum, v) => sum + v.quantidade_viagens, 0);
            
            // Volume total das viagens filtradas
            const volumeTotal = viagens.reduce((sum, viagem) => {
                const veiculo = veiculos.find(v => v.id_veiculo === viagem.id_veiculo);
                return sum + (veiculo ? veiculo.cubagem_m3 * viagem.quantidade_viagens : 0);
            }, 0);
            
            document.getElementById('totalVolume').textContent = volumeTotal.toFixed(2);
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
            
            // Update dependent filters when obra is selected
            const obraCheckbox = document.getElementById('dashFiltroObra');
            if (obraCheckbox.checked) {
                atualizarFiltrosDependentesDashboard();
            }
        }
        
        async function atualizarFiltrosDependentesDashboard() {
            const obraSelect = document.getElementById('dashSelectObra');
            const obrasSelecionadas = Array.from(obraSelect.selectedOptions).map(o => o.value);
            
            if (obrasSelecionadas.length > 0) {
                try {
                    // Update vehicles based on selected obras
                    const veiculosResponse = await fetch(`/api/veiculos-filtrados?obra=${obrasSelecionadas.join(',')}`);
                    const veiculos = await veiculosResponse.json();
                    
                    const veiculoSelect = document.getElementById('dashSelectVeiculo');
                    veiculoSelect.innerHTML = '';
                    veiculos.forEach(v => {
                        const option = document.createElement('option');
                        option.value = v.veiculo;
                        option.textContent = v.veiculo;
                        veiculoSelect.appendChild(option);
                    });
                    
                    // Update drivers based on selected obras
                    const motoristasResponse = await fetch(`/api/motoristas-filtrados?obra=${obrasSelecionadas.join(',')}`);
                    const motoristas = await motoristasResponse.json();
                    
                    const motoristaSelect = document.getElementById('dashSelectMotorista');
                    motoristaSelect.innerHTML = '';
                    motoristas.forEach(m => {
                        const option = document.createElement('option');
                        option.value = m.motorista;
                        option.textContent = m.motorista;
                        motoristaSelect.appendChild(option);
                    });
                    
                } catch (error) {
                    console.error('Erro ao atualizar filtros dependentes:', error);
                }
            }
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
                    fetch('/api/obras').then(r => r.json()),
                    fetch('/api/veiculos').then(r => r.json()),
                    fetch(`/api/viagens?${params}`).then(r => r.json()),
                    fetch(`/api/dashboard-kpis?${params}`).then(r => r.json())
                ]);
                
                atualizarCardsDashboard(obras, veiculos, viagens);
                criarGraficos(veiculos, viagens, obras);
                atualizarKPIsAvancados(kpis);
                await carregarGraficosAvancados(); // Reload advanced charts with filters
                await carregarTabelaParalizacoes(); // Reload table with filters
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
        
        async function carregarTabelaParalizacoes() {
            try {
                // Get current dashboard filters
                const filtros = {};
                
                ['Obra', 'Veiculo', 'Motorista', 'Servico', 'Local'].forEach(tipoFiltro => {
                    const checkbox = document.getElementById(`dashFiltro${tipoFiltro}`);
                    const select = document.getElementById(`dashSelect${tipoFiltro}`);
                    if (checkbox && checkbox.checked && select && select.selectedOptions.length > 0) {
                        filtros[tipoFiltro.toLowerCase()] = Array.from(select.selectedOptions).map(o => o.value).join(',');
                    }
                });
                
                const checkboxData = document.getElementById('dashFiltroData');
                if (checkboxData && checkboxData.checked) {
                    const dataInicio = document.getElementById('dashDataInicio').value;
                    const dataFim = document.getElementById('dashDataFim').value;
                    if (dataInicio && dataFim) {
                        filtros.data_inicio = dataInicio;
                        filtros.data_fim = dataFim;
                    }
                }
                
                // Build URL parameters
                const params = new URLSearchParams(filtros);
                const queryString = params.toString();
                
                const response = await fetch(`/api/relatorio-paralizacoes?${queryString}`);
                const paralizacoes = await response.json();
                
                const tbody = document.getElementById('tabelaParalizacoesDashboard');
                tbody.innerHTML = '';
                
                if (paralizacoes.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhuma paralização encontrada</td></tr>';
                    return;
                }
                
                paralizacoes.forEach(p => {
                    const row = document.createElement('tr');
                    
                    const dataInicio = p.data_hora_inicio ? new Date(p.data_hora_inicio).toLocaleString('pt-BR') : 'N/A';
                    const dataRetorno = p.data_hora_retorno ? new Date(p.data_hora_retorno).toLocaleString('pt-BR') : 'Em andamento';
                    
                    const statusClass = p.status === 'concluído' ? 'badge bg-success' : 'badge bg-warning';
                    
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
                
            } catch (error) {
                console.error('Erro ao carregar tabela de paralizações:', error);
                const tbody = document.getElementById('tabelaParalizacoesDashboard');
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Erro ao carregar dados</td></tr>';
            }
        }
        
        function criarGraficos(veiculos, viagens, obras) {
            ['chartVeiculos', 'chartObras', 'chartMedia'].forEach(id => {
                const canvas = document.getElementById(id);
                if (canvas && canvas.chart) {
                    canvas.chart.destroy();
                }
            });
            
            // Gráfico de Veículos - apenas veículos com viagens filtradas
            const ctxVeiculos = document.getElementById('chartVeiculos').getContext('2d');
            const veiculosComViagens = [...new Set(viagens.map(v => v.veiculo))];
            const dadosVeiculos = veiculosComViagens.map(nomeVeiculo => {
                const viagensVeiculo = viagens.filter(v => v.veiculo === nomeVeiculo);
                return {
                    label: nomeVeiculo,
                    value: viagensVeiculo.reduce((sum, v) => sum + v.quantidade_viagens, 0)
                };
            }).filter(d => d.value > 0);
            
            ctxVeiculos.canvas.chart = new Chart(ctxVeiculos, {
                type: 'pie',
                data: {
                    labels: dadosVeiculos.map(d => d.label),
                    datasets: [{
                        data: dadosVeiculos.map(d => d.value),
                        backgroundColor: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            
            // Gráfico de Obras - apenas obras com viagens filtradas
            const ctxObras = document.getElementById('chartObras').getContext('2d');
            const obrasComViagens = [...new Set(viagens.map(v => v.nome_obra))];
            const dadosObras = obrasComViagens.map(nomeObra => {
                const viagensObra = viagens.filter(v => v.nome_obra === nomeObra);
                const volume = viagensObra.reduce((sum, viagem) => {
                    const veiculo = veiculos.find(v => v.id_veiculo === viagem.id_veiculo);
                    return sum + (veiculo ? veiculo.cubagem_m3 * viagem.quantidade_viagens : 0);
                }, 0);
                return { label: nomeObra, value: volume };
            }).filter(d => d.value > 0);
            
            ctxObras.canvas.chart = new Chart(ctxObras, {
                type: 'bar',
                data: {
                    labels: dadosObras.map(d => d.label),
                    datasets: [{
                        label: 'Volume (m³)',
                        data: dadosObras.map(d => d.value),
                        backgroundColor: '#3498db'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
            
            // Gráfico de Média - apenas veículos com viagens filtradas
            const ctxMedia = document.getElementById('chartMedia').getContext('2d');
            const dadosMedia = veiculosComViagens.map(nomeVeiculo => {
                const viagensVeiculo = viagens.filter(v => v.veiculo === nomeVeiculo);
                const totalViagens = viagensVeiculo.reduce((sum, v) => sum + v.quantidade_viagens, 0);
                const diasTrabalhados = new Set(viagensVeiculo.map(v => v.data_hora.split(' ')[0])).size;
                const media = diasTrabalhados > 0 ? totalViagens / diasTrabalhados : 0;
                return { label: nomeVeiculo, value: media };
            }).filter(d => d.value > 0);
            
            ctxMedia.canvas.chart = new Chart(ctxMedia, {
                type: 'line',
                data: {
                    labels: dadosMedia.map(d => d.label),
                    datasets: [{
                        label: 'Média Viagens/Dia',
                        data: dadosMedia.map(d => d.value),
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.1)',
                        fill: true
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
        
        async function carregarFiltros() {
            try {
                const [obras, veiculos] = await Promise.all([
                    fetch('/api/obras').then(r => r.json()),
                    fetch('/api/veiculos').then(r => r.json())
                ]);
                
                const selectVeiculo = document.getElementById('selectVeiculo');
                selectVeiculo.innerHTML = '';
                veiculos.forEach(v => {
                    const option = document.createElement('option');
                    option.value = v.veiculo;
                    option.textContent = v.veiculo;
                    selectVeiculo.appendChild(option);
                });
                
                const selectObra = document.getElementById('selectObra');
                selectObra.innerHTML = '';
                obras.forEach(o => {
                    const option = document.createElement('option');
                    option.value = o.nome_obra;
                    option.textContent = o.nome_obra;
                    selectObra.appendChild(option);
                });
                
                const selectMotorista = document.getElementById('selectMotorista');
                selectMotorista.innerHTML = '';
                [...new Set(veiculos.map(v => v.motorista))].forEach(m => {
                    const option = document.createElement('option');
                    option.value = m;
                    option.textContent = m;
                    selectMotorista.appendChild(option);
                });
                
                const selectServico = document.getElementById('selectServico');
                selectServico.innerHTML = '';
                [...new Set(obras.map(o => o.servico))].forEach(s => {
                    const option = document.createElement('option');
                    option.value = s;
                    option.textContent = s;
                    selectServico.appendChild(option);
                });
                
                const selectLocal = document.getElementById('selectLocal');
                selectLocal.innerHTML = '';
                [...new Set(obras.map(o => o.local))].forEach(l => {
                    const option = document.createElement('option');
                    option.value = l;
                    option.textContent = l;
                    selectLocal.appendChild(option);
                });
                
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
                
                const response = await fetch(`/api/diarias?${params}`);
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
                // Carregar veículos e motoristas filtrados
                try {
                    const veiculosPromises = obrasSelecionadas.map(obra => 
                        fetch(`/api/veiculos-por-obra?obra=${encodeURIComponent(obra)}`).then(r => r.json())
                    );
                    const motoristasPromises = obrasSelecionadas.map(obra => 
                        fetch(`/api/motoristas-por-obra?obra=${encodeURIComponent(obra)}`).then(r => r.json())
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
                    <td>
                        <span class="view-mode">${diaria.veiculo}</span>
                        <input type="text" class="form-control edit-mode" value="${diaria.veiculo}" style="display:none;">
                    </td>
                    <td>
                        <span class="view-mode">${diaria.placa}</span>
                        <input type="text" class="form-control edit-mode" value="${diaria.placa}" style="display:none;">
                    </td>
                    <td>
                        <span class="view-mode">${diaria.motorista}</span>
                        <select class="form-select edit-mode" style="display:none;">
                            <option value="${diaria.motorista}">${diaria.motorista}</option>
                        </select>
                    </td>
                    <td>
                        <span class="view-mode">${diaria.cubagem_m3}</span>
                        <input type="number" step="0.01" class="form-control edit-mode" value="${diaria.cubagem_m3}" style="display:none;">
                    </td>
                    <td class="text-center">${viagens}</td>
                    <td class="text-end">${volume.toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-btn me-1" onclick="toggleEditMode(this, ${diaria.id_veiculo})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="excluirVeiculo(${diaria.id_veiculo})">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="btn btn-sm btn-success save-btn me-1" onclick="salvarEdicaoInline(this, ${diaria.id_veiculo})" style="display:none;">
                            <i class="fas fa-save"></i>
                        </button>
                        <button class="btn btn-sm btn-secondary cancel-btn" onclick="cancelarEdicaoInline(this)" style="display:none;">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                `;
                row.style.cursor = 'pointer';
                tbody.appendChild(row);
            });
            
            const totalRow = document.createElement('tr');
            totalRow.className = 'table-warning fw-bold';
            totalRow.innerHTML = `
                <td colspan="4">TOTAIS</td>
                <td class="text-center">${totalViagens}</td>
                <td class="text-end">${totalVolume.toFixed(2)}</td>
                <td></td>
            `;
            tbody.appendChild(totalRow);
        }
        
        function toggleEditMode(button, veiculoId) {
            const row = button.closest('tr');
            const viewModes = row.querySelectorAll('.view-mode');
            const editModes = row.querySelectorAll('.edit-mode');
            const editBtn = row.querySelector('.edit-btn');
            const saveBtn = row.querySelector('.save-btn');
            const cancelBtn = row.querySelector('.cancel-btn');
            
            viewModes.forEach(el => el.style.display = 'none');
            editModes.forEach(el => el.style.display = 'block');
            
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
            
            const motoristaSelect = row.querySelector('select.edit-mode');
            carregarMotoristasInline(motoristaSelect);
        }
        
        function cancelarEdicaoInline(button) {
            const row = button.closest('tr');
            const viewModes = row.querySelectorAll('.view-mode');
            const editModes = row.querySelectorAll('.edit-mode');
            const editBtn = row.querySelector('.edit-btn');
            const saveBtn = row.querySelector('.save-btn');
            const cancelBtn = row.querySelector('.cancel-btn');
            
            viewModes.forEach(el => el.style.display = 'block');
            editModes.forEach(el => el.style.display = 'none');
            
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }
        
        async function salvarEdicaoInline(button, veiculoId) {
            const row = button.closest('tr');
            const inputs = row.querySelectorAll('.edit-mode');
            
            const dados = {
                veiculo: inputs[0].value,
                placa: inputs[1].value,
                motorista: inputs[2].value,
                cubagem_m3: parseFloat(inputs[3].value)
            };
            
            try {
                const response = await fetch(`/api/veiculos/${veiculoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                
                if (response.ok) {
                    alert('Veículo atualizado com sucesso!');
                    
                    const viewModes = row.querySelectorAll('.view-mode');
                    viewModes[0].textContent = dados.veiculo;
                    viewModes[1].textContent = dados.placa;
                    viewModes[2].textContent = dados.motorista;
                    viewModes[3].textContent = dados.cubagem_m3;
                    
                    cancelarEdicaoInline(button);
                    await carregarVeiculos();
                    await carregarDiarias();
                } else {
                    alert('Erro ao atualizar veículo');
                }
            } catch (error) {
                alert('Erro ao salvar: ' + error.message);
            }
        }
        
        function carregarMotoristasInline(selectElement) {
            const motoristas = profissionais.filter(p => p.funcao.toLowerCase().includes('motorista'));
            const currentValue = selectElement.value;
            
            selectElement.innerHTML = '';
            motoristas.forEach(motorista => {
                const option = document.createElement('option');
                option.value = motorista.nome;
                option.textContent = motorista.nome;
                if (motorista.nome === currentValue) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        }
        

        
        function editarVeiculo(id) {
            const veiculo = veiculos.find(v => v.id_veiculo === id);
            if (veiculo) {
                document.getElementById('nomeVeiculo').value = veiculo.veiculo;
                document.getElementById('placaVeiculo').value = veiculo.placa;
                document.getElementById('cubagemVeiculo').value = veiculo.cubagem_m3;
                carregarMotoristas();
                setTimeout(() => {
                    document.getElementById('motoristaVeiculo').value = veiculo.motorista;
                }, 100);
                document.getElementById('veiculoForm').setAttribute('data-edit-id', id);
                showSection('veiculos');
            }
        }
        
        function editarProfissional(id) {
            const profissional = profissionais.find(p => p.id_profissional === id);
            if (profissional) {
                document.getElementById('nomeProfissional').value = profissional.nome;
                document.getElementById('funcaoProfissional').value = profissional.funcao;
                document.getElementById('contatoProfissional').value = profissional.contato || '';
                document.getElementById('emailProfissional').value = profissional.email || '';
                document.getElementById('terceirizadoProfissional').checked = profissional.terceirizado;
                document.getElementById('empresaProfissional').value = profissional.empresa_terceirizada || '';
                document.getElementById('empresaDiv').style.display = profissional.terceirizado ? 'block' : 'none';
                document.getElementById('profissionalForm').setAttribute('data-edit-id', id);
                showSection('profissionais');
            }
        }
        
        async function editarVeiculoDiaria(id) {
            const veiculo = veiculos.find(v => v.id_veiculo === id);
            if (veiculo) {
                document.getElementById('nomeVeiculo').value = veiculo.veiculo;
                document.getElementById('placaVeiculo').value = veiculo.placa;
                document.getElementById('cubagemVeiculo').value = veiculo.cubagem_m3;
                carregarMotoristas();
                setTimeout(() => {
                    document.getElementById('motoristaVeiculo').value = veiculo.motorista;
                }, 100);
                document.getElementById('veiculoForm').setAttribute('data-edit-id', id);
                showSection('veiculos');
            }
        }
        
        function adicionarServico() {
            const container = document.getElementById('servicosContainer');
            const div = document.createElement('div');
            div.className = 'input-group mb-2';
            div.innerHTML = `
                <input type="text" class="form-control" placeholder="Digite um serviço" required>
                <button type="button" class="btn btn-outline-danger" onclick="removerCampo(this)"><i class="fas fa-minus"></i></button>
            `;
            container.appendChild(div);
        }
        
        function adicionarLocal() {
            const container = document.getElementById('locaisContainer');
            const div = document.createElement('div');
            div.className = 'input-group mb-2';
            div.innerHTML = `
                <input type="text" class="form-control" placeholder="Digite um local" required>
                <button type="button" class="btn btn-outline-danger" onclick="removerCampo(this)"><i class="fas fa-minus"></i></button>
            `;
            container.appendChild(div);
        }
        
        function removerCampo(button) {
            button.parentElement.remove();
        }
        
        function carregarServicoLocal() {
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
                carregarVeiculosPorObra(nomeObra);
            } else {
                // Se nenhuma obra selecionada, carregar todos os veículos
                carregarVeiculos();
            }
        }
        
        async function carregarVeiculosPorObra(obra) {
            try {
                const response = await fetch(`/api/veiculos-por-obra?obra=${encodeURIComponent(obra)}`);
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
        
        function toggleEditMode(button, veiculoId) {
            const row = button.closest('tr');
            const viewModes = row.querySelectorAll('.view-mode');
            const editModes = row.querySelectorAll('.edit-mode');
            const editBtn = row.querySelector('.edit-btn');
            const saveBtn = row.querySelector('.save-btn');
            const cancelBtn = row.querySelector('.cancel-btn');
            
            viewModes.forEach(el => el.style.display = 'none');
            editModes.forEach(el => el.style.display = 'block');
            
            editBtn.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
            
            const motoristaSelect = row.querySelector('select.edit-mode');
            carregarMotoristasInline(motoristaSelect);
        }
        
        function cancelarEdicaoInline(button) {
            const row = button.closest('tr');
            const viewModes = row.querySelectorAll('.view-mode');
            const editModes = row.querySelectorAll('.edit-mode');
            const editBtn = row.querySelector('.edit-btn');
            const saveBtn = row.querySelector('.save-btn');
            const cancelBtn = row.querySelector('.cancel-btn');
            
            viewModes.forEach(el => el.style.display = 'block');
            editModes.forEach(el => el.style.display = 'none');
            
            editBtn.style.display = 'inline-block';
            saveBtn.style.display = 'none';
            cancelBtn.style.display = 'none';
        }
        
        async function salvarEdicaoInline(button, veiculoId) {
            const row = button.closest('tr');
            const inputs = row.querySelectorAll('.edit-mode');
            
            const dados = {
                veiculo: inputs[0].value,
                placa: inputs[1].value,
                motorista: inputs[2].value,
                cubagem_m3: parseFloat(inputs[3].value)
            };
            
            try {
                const response = await fetch(`/api/veiculos/${veiculoId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                
                if (response.ok) {
                    alert('Veículo atualizado com sucesso!');
                    
                    const viewModes = row.querySelectorAll('.view-mode');
                    viewModes[0].textContent = dados.veiculo;
                    viewModes[1].textContent = dados.placa;
                    viewModes[2].textContent = dados.motorista;
                    viewModes[3].textContent = dados.cubagem_m3;
                    
                    cancelarEdicaoInline(button);
                    await carregarVeiculos();
                    await carregarDiarias();
                } else {
                    alert('Erro ao atualizar veículo');
                }
            } catch (error) {
                alert('Erro ao salvar: ' + error.message);
            }
        }
        
        function carregarMotoristasInline(selectElement) {
            const motoristas = profissionais.filter(p => p.funcao.toLowerCase().includes('motorista'));
            const currentValue = selectElement.value;
            
            selectElement.innerHTML = '';
            motoristas.forEach(motorista => {
                const option = document.createElement('option');
                option.value = motorista.nome;
                option.textContent = motorista.nome;
                if (motorista.nome === currentValue) {
                    option.selected = true;
                }
                selectElement.appendChild(option);
            });
        }
        
        async function excluirObra(id) {
            if (confirm('Tem certeza que deseja excluir esta obra?')) {
                try {
                    const response = await fetch(`/api/obras/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        alert('Obra excluída com sucesso!');
                        await carregarObras();
                        listarObras();
                    } else {
                        const error = await response.json();
                        alert(error.error || 'Erro ao excluir obra');
                    }
                } catch (error) {
                    alert('Erro ao excluir obra');
                }
            }
        }
        
        async function excluirVeiculo(id) {
            if (confirm('Tem certeza que deseja excluir este veículo?')) {
                try {
                    const response = await fetch(`/api/veiculos/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        alert('Veículo excluído com sucesso!');
                        await carregarVeiculos();
                        listarVeiculos();
                        await carregarDiarias();
                    } else {
                        const error = await response.json();
                        alert(error.error || 'Erro ao excluir veículo');
                    }
                } catch (error) {
                    alert('Erro ao excluir veículo');
                }
            }
        }
        
        async function excluirProfissional(id) {
            if (confirm('Tem certeza que deseja excluir este profissional?')) {
                try {
                    const response = await fetch(`/api/profissionais/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        alert('Profissional excluído com sucesso!');
                        await carregarProfissionais();
                        listarProfissionais();
                    } else {
                        const error = await response.json();
                        alert(error.error || 'Erro ao excluir profissional');
                    }
                } catch (error) {
                    alert('Erro ao excluir profissional');
                }
            }
        }
        
        async function verViagensVeiculo(veiculoId, nomeVeiculo) {
            try {
                const response = await fetch(`/api/viagens?veiculo=${encodeURIComponent(nomeVeiculo)}`);
                const viagens = await response.json();
                
                document.getElementById('nomeVeiculoModal').textContent = nomeVeiculo;
                const tbody = document.getElementById('tabelaViagensVeiculo');
                tbody.innerHTML = '';
                
                viagens.forEach(viagem => {
                    const row = document.createElement('tr');
                    const dataFormatada = new Date(viagem.data_hora).toLocaleString('pt-BR');
                    
                    row.innerHTML = `
                        <td>${dataFormatada}</td>
                        <td>${viagem.nome_obra}</td>
                        <td>${viagem.servico}</td>
                        <td>${viagem.local}</td>
                        <td class="text-center">${viagem.quantidade_viagens}</td>
                        <td><small class="text-muted">${viagem.nome_usuario || 'N/A'}</small></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="editarViagem(${viagem.id_viagem})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="excluirViagem(${viagem.id_viagem})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
                
                const modal = new bootstrap.Modal(document.getElementById('modalViagensVeiculo'));
                modal.show();
            } catch (error) {
                alert('Erro ao carregar viagens do veículo');
            }
        }
        
        async function excluirViagem(id) {
            if (confirm('Tem certeza que deseja excluir esta viagem?')) {
                try {
                    const response = await fetch(`/api/viagens/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        alert('Viagem excluída com sucesso!');
                        const modal = bootstrap.Modal.getInstance(document.getElementById('modalViagensVeiculo'));
                        modal.hide();
                        await carregarDiarias();
                    }
                } catch (error) {
                    alert('Erro ao excluir viagem');
                }
            }
        }
        
        function editarViagem(id) {
            // Fechar modal e ir para seção de viagens com dados preenchidos
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalViagensVeiculo'));
            modal.hide();
            
            // Buscar dados da viagem e preencher formulário
            fetch(`/api/viagens`)
                .then(r => r.json())
                .then(viagens => {
                    const viagem = viagens.find(v => v.id_viagem === id);
                    if (viagem) {
                        // Preencher formulário
                        document.getElementById('obraSelect').value = viagem.nome_obra;
                        carregarServicoLocal();
                        setTimeout(() => {
                            document.getElementById('servicoSelect').value = viagem.servico;
                            document.getElementById('localSelect').value = viagem.local;
                        }, 100);
                        document.getElementById('veiculoSelect').value = viagem.id_veiculo;
                        document.getElementById('dataHoraViagem').value = viagem.data_hora.slice(0, 16);
                        document.getElementById('quantidadeViagens').value = viagem.quantidade_viagens;
                        
                        // Marcar formulário como edição
                        document.getElementById('viagemForm').setAttribute('data-edit-id', id);
                        
                        // Ir para seção de viagens
                        showSection('viagens');
                    }
                });
        }
        
        // PAINEL DE CONTROLE
        async function carregarPainelControle() {
            await carregarUsuarios();
            await carregarProfissionaisParaPermissao();
        }
        
        async function carregarUsuarios() {
            try {
                const response = await fetch('/api/usuarios');
                const usuarios = await response.json();
                
                const lista = document.getElementById('listaUsuarios');
                lista.innerHTML = '';
                
                usuarios.forEach(usuario => {
                    const item = document.createElement('div');
                    item.className = 'border-start border-info border-3 ps-3 mb-2';
                    item.innerHTML = `
                        <strong>${usuario.nome}</strong><br>
                        <small class="text-muted">Usuário: ${usuario.usuario}</small><br>
                        <small class="text-muted">Função: ${usuario.funcao}</small>
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
            
            try {
                const response = await fetch(`/api/usuarios/${profissionalId}`);
                if (response.ok) {
                    const usuario = await response.json();
                    
                    document.getElementById('perm_adm').checked = usuario.adm;
                    document.getElementById('perm_dashboard').checked = usuario.dashboard;
                    document.getElementById('perm_registrar_viagem').checked = usuario.registrar_viagem;
                    document.getElementById('perm_obras').checked = usuario.obras;
                    document.getElementById('perm_veiculo').checked = usuario.veiculo;
                    document.getElementById('perm_profissionais').checked = usuario.profissionais;
                    document.getElementById('perm_diaria').checked = usuario.diaria;
                    document.getElementById('perm_meu_veiculo').checked = usuario.meu_veiculo;
                    
                    // Carregar veículo associado se existir
                    if (usuario.meu_veiculo) {
                        carregarVeiculoAssociado(profissionalId);
                    }
                    document.getElementById('perm_painel_controle').checked = usuario.painel_controle;
                    document.getElementById('perm_visualizar_ocorrencias_transportes').checked = usuario.visualizar_ocorrencias_transportes;
                    document.getElementById('perm_visualizar_clima_tempo').checked = usuario.visualizar_clima_tempo;
                    
                    document.getElementById('novoUsuario').value = usuario.usuario || '';
                    document.getElementById('novaSenha').value = '';
                } else {
                    // Limpar formulário para novo usuário
                    document.querySelectorAll('#permissoesContainer input[type="checkbox"]').forEach(cb => cb.checked = false);
                    document.getElementById('novoUsuario').value = '';
                    document.getElementById('novaSenha').value = '';
                }
            } catch (error) {
                console.error('Erro ao carregar permissões:', error);
            }
        }
        
        async function salvarPermissoes() {
            const profissionalId = document.getElementById('profissionalPermissao').value;
            const usuario = document.getElementById('novoUsuario').value;
            const senha = document.getElementById('novaSenha').value;
            
            if (!profissionalId) {
                alert('Selecione um profissional');
                return;
            }
            
            const dados = {
                id_profissional: profissionalId,
                usuario: usuario,
                senha: senha,
                adm: document.getElementById('perm_adm').checked,
                dashboard: document.getElementById('perm_dashboard').checked,
                registrar_viagem: document.getElementById('perm_registrar_viagem').checked,
                obras: document.getElementById('perm_obras').checked,
                veiculo: document.getElementById('perm_veiculo').checked,
                profissionais: document.getElementById('perm_profissionais').checked,
                diaria: document.getElementById('perm_diaria').checked,
                meu_veiculo: document.getElementById('perm_meu_veiculo').checked,
                painel_controle: document.getElementById('perm_painel_controle').checked,
                visualizar_ocorrencias_transportes: document.getElementById('perm_visualizar_ocorrencias_transportes').checked,
                visualizar_clima_tempo: document.getElementById('perm_visualizar_clima_tempo').checked
            };
            
            // Adicionar veículo selecionado se a permissão "Meu Veículo" estiver marcada
            if (dados.meu_veiculo && veiculoSelecionadoModal) {
                dados.id_veiculo = veiculoSelecionadoModal;
            }
            
            try {
                const response = await fetch('/api/permissoes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                
                if (response.ok) {
                    alert('Permissões salvas com sucesso!');
                    await carregarUsuarios();
                    // Limpar seleção de veículo
                    veiculoSelecionadoModal = null;
                } else {
                    alert('Erro ao salvar permissões');
                }
            } catch (error) {
                alert('Erro ao salvar permissões: ' + error.message);
            }
        }
        
        async function carregarEmpresaConfig() {
            try {
                const response = await fetch('/api/empresa-config');
                const config = await response.json();
                
                document.getElementById('nomeEmpresa').value = config.nome_empresa || '';
                document.getElementById('telefoneEmpresa').value = config.telefone || '';
                document.getElementById('enderecoEmpresa').value = config.endereco || '';
                document.getElementById('cnpjEmpresa').value = config.cnpj || '';
                document.getElementById('logomarcaEmpresa').value = config.logomarca || '';
                
                const preview = document.getElementById('previewLogo');
                const noLogo = document.getElementById('noLogo');
                
                if (config.logomarca) {
                    preview.src = config.logomarca;
                    preview.style.display = 'block';
                    noLogo.style.display = 'none';
                } else {
                    preview.style.display = 'none';
                    noLogo.style.display = 'block';
                }
            } catch (error) {
                console.error('Erro ao carregar configurações da empresa:', error);
            }
        }
        
        async function salvarEmpresa(e) {
            e.preventDefault();
            
            const dados = {
                nome_empresa: document.getElementById('nomeEmpresa').value,
                telefone: document.getElementById('telefoneEmpresa').value,
                endereco: document.getElementById('enderecoEmpresa').value,
                cnpj: document.getElementById('cnpjEmpresa').value,
                logomarca: document.getElementById('logomarcaEmpresa').value
            };
            
            try {
                const response = await fetch('/api/empresa-config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dados)
                });
                
                if (response.ok) {
                    alert('Configurações da empresa salvas com sucesso!');
                } else {
                    alert('Erro ao salvar configurações');
                }
            } catch (error) {
                alert('Erro ao salvar: ' + error.message);
            }
        }
        
        function navegarData(direcao) {
            dataAtualVisualizacao.setDate(dataAtualVisualizacao.getDate() + direcao);
            carregarViagensUsuario();
        }
        
        async function carregarViagensUsuario() {
            try {
                const dataFormatada = dataAtualVisualizacao.toISOString().split('T')[0];
                document.getElementById('dataAtualViagens').textContent = dataAtualVisualizacao.toLocaleDateString('pt-BR');
                
                const response = await fetch(`/api/viagens-usuario?data=${dataFormatada}&usuario=${currentUser.id}`);
                const viagens = await response.json();
                
                const tbody = document.getElementById('tabelaViagensUsuario');
                const semViagens = document.getElementById('semViagens');
                
                if (viagens.length === 0) {
                    tbody.innerHTML = '';
                    semViagens.style.display = 'block';
                } else {
                    semViagens.style.display = 'none';
                    
                    viagens.sort((a, b) => a.nome_obra.localeCompare(b.nome_obra));
                    
                    tbody.innerHTML = viagens.map(viagem => {
                        const dataHora = new Date(viagem.data_hora);
                        const hora = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        
                        return `
                            <tr>
                                <td><small>${viagem.nome_obra}</small></td>
                                <td><small>${viagem.servico}</small></td>
                                <td><small>${viagem.local}</small></td>
                                <td><small>${viagem.veiculo}</small></td>
                                <td><small>${hora}</small></td>
                                <td class="text-center"><span class="badge bg-primary">${viagem.quantidade_viagens}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editarViagemUsuario(${viagem.id_viagem})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="excluirViagemUsuario(${viagem.id_viagem})">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (error) {
                console.error('Erro ao carregar viagens do usuário:', error);
            }
        }
        
        async function editarViagemUsuario(id) {
            try {
                const response = await fetch('/api/viagens');
                const todasViagens = await response.json();
                const viagem = todasViagens.find(v => v.id_viagem === id);
                
                if (viagem) {
                    document.getElementById('obraSelect').value = viagem.nome_obra;
                    carregarServicoLocal();
                    setTimeout(() => {
                        document.getElementById('servicoSelect').value = viagem.servico;
                        document.getElementById('localSelect').value = viagem.local;
                    }, 100);
                    document.getElementById('veiculoSelect').value = viagem.id_veiculo;
                    document.getElementById('dataHoraViagem').value = viagem.data_hora.slice(0, 16);
                    document.getElementById('quantidadeViagens').value = viagem.quantidade_viagens;
                    document.getElementById('viagemForm').setAttribute('data-edit-id', id);
                }
            } catch (error) {
                alert('Erro ao carregar dados da viagem');
            }
        }
        
        async function excluirViagemUsuario(id) {
            if (confirm('Tem certeza que deseja excluir esta viagem?')) {
                try {
                    const response = await fetch(`/api/viagens/${id}`, { method: 'DELETE' });
                    if (response.ok) {
                        alert('Viagem excluída com sucesso!');
                        carregarViagensUsuario();
                    }
                } catch (error) {
                    alert('Erro ao excluir viagem');
                }
            }
        }
        
        function gerarComprovanteDiaria() {
            const dataFormatada = dataAtualVisualizacao.toISOString().split('T')[0];
            const dataExibicao = dataAtualVisualizacao.toLocaleDateString('pt-BR');
            
            const url = `/api/comprovante-diaria?data=${dataFormatada}&usuario=${currentUser.id}&data_exibicao=${encodeURIComponent(dataExibicao)}`;
            
            window.open(url, '_blank');
        }
        
        async function carregarMeuVeiculo() {
            await carregarEmpresaConfigMeuVeiculo();
            await carregarViagensMeuVeiculo();
        }
        
        async function verificarVeiculoAssociado() {
            try {
                const response = await fetch(`/api/usuario-veiculo/${currentUser.id}`);
                const veiculo = await response.json();
                
                if (!veiculo.id_veiculo) {
                    // Sem veículo associado - limpar cache e exibir mensagem
                    veiculoAssociadoAtual = null;
                    document.getElementById('nomeVeiculoMeuVeiculo').textContent = 'Nenhum veículo associado ao seu perfil. Selecione um veículo no Painel de Controle.';
                    document.getElementById('totalViagensMeuVeiculo').textContent = '0';
                    document.getElementById('volumeTotalMeuVeiculo').textContent = '0';
                    
                    // Limpar tabela
                    document.getElementById('tabelaViagensMeuVeiculo').innerHTML = '';
                    document.getElementById('semViagensMeuVeiculo').style.display = 'block';
                    document.getElementById('semViagensMeuVeiculo').innerHTML = '<i class="fas fa-info-circle"></i> Nenhum veículo associado ao seu perfil. Selecione um veículo no Painel de Controle.';
                    
                    return null;
                } else {
                    // Veículo encontrado - armazenar e exibir
                    veiculoAssociadoAtual = veiculo;
                    document.getElementById('nomeVeiculoMeuVeiculo').textContent = veiculo.veiculo;
                    document.getElementById('semViagensMeuVeiculo').style.display = 'none';
                    return veiculo;
                }
            } catch (error) {
                console.error('Erro ao verificar veículo associado:', error);
                veiculoAssociadoAtual = null;
                document.getElementById('nomeVeiculoMeuVeiculo').textContent = 'Erro ao carregar dados do veículo';
                return null;
            }
        }
        
        async function carregarEmpresaConfigMeuVeiculo() {
            try {
                const response = await fetch('/api/empresa-config');
                const config = await response.json();
                
                document.getElementById('nomeEmpresaMeuVeiculo').textContent = config.nome_empresa || 'Empresa';
                document.getElementById('enderecoEmpresaMeuVeiculo').textContent = config.endereco || '';
                document.getElementById('telefoneEmpresaMeuVeiculo').textContent = config.telefone || '';
                document.getElementById('cnpjEmpresaMeuVeiculo').textContent = config.cnpj || '';
                
                if (config.logomarca) {
                    document.getElementById('logoEmpresaMeuVeiculo').src = config.logomarca;
                    document.getElementById('logoMeuVeiculo').style.display = 'block';
                }
            } catch (error) {
                console.error('Erro ao carregar configurações da empresa:', error);
            }
        }
        
        function navegarDataMeuVeiculo(direcao) {
            dataAtualMeuVeiculo.setDate(dataAtualMeuVeiculo.getDate() + direcao);
            // Manter consistência do veículo ao navegar entre datas
            carregarViagensMeuVeiculo();
        }
        
        async function carregarViagensMeuVeiculo() {
            try {
                const dataFormatada = dataAtualMeuVeiculo.toISOString().split('T')[0];
                document.getElementById('dataAtualMeuVeiculo').textContent = dataAtualMeuVeiculo.toLocaleDateString('pt-BR');
                
                // Usar veículo já verificado ou verificar novamente
                let veiculoAssociado = veiculoAssociadoAtual;
                if (!veiculoAssociado) {
                    veiculoAssociado = await verificarVeiculoAssociado();
                }
                
                if (!veiculoAssociado) {
                    return;
                }
                
                // Carregar viagens APENAS do veículo associado (filtro por veículo, não por usuário)
                const response = await fetch(`/api/viagens-veiculo?data=${dataFormatada}&veiculo_id=${veiculoAssociado.id_veiculo}`);
                const viagens = await response.json();
                
                const tbody = document.getElementById('tabelaViagensMeuVeiculo');
                const semViagens = document.getElementById('semViagensMeuVeiculo');
                
                if (viagens.length === 0) {
                    tbody.innerHTML = '';
                    semViagens.style.display = 'block';
                    semViagens.innerHTML = '<i class="fas fa-info-circle"></i> Nenhuma viagem registrada nesta data';
                    document.getElementById('totalViagensMeuVeiculo').textContent = '0';
                    document.getElementById('volumeTotalMeuVeiculo').textContent = '0';
                } else {
                    semViagens.style.display = 'none';
                    
                    // Calcular totais EXCLUSIVAMENTE do veículo associado
                    let totalViagens = 0;
                    let volumeTotal = 0;
                    
                    viagens.forEach(viagem => {
                        totalViagens += viagem.quantidade_viagens;
                        volumeTotal += viagem.quantidade_viagens * parseFloat(veiculoAssociado.cubagem_m3);
                    });
                    
                    document.getElementById('totalViagensMeuVeiculo').textContent = totalViagens;
                    document.getElementById('volumeTotalMeuVeiculo').textContent = volumeTotal.toFixed(2);
                    
                    // Preencher tabela com dados do veículo associado (já filtrados pela API)
                    tbody.innerHTML = viagens.map(viagem => {
                        const dataHora = new Date(viagem.data_hora);
                        const dataHoraFormatada = dataHora.toLocaleString('pt-BR');
                        
                        return `
                            <tr>
                                <td><small>${dataHoraFormatada}</small></td>
                                <td><small>${viagem.nome_obra}</small></td>
                                <td><small>${viagem.servico}</small></td>
                                <td><small>${viagem.local}</small></td>
                                <td class="text-center"><span class="badge bg-primary">${viagem.quantidade_viagens}</span></td>
                                <td><small>${viagem.nome_usuario || 'N/A'}</small></td>
                            </tr>
                        `;
                    }).join('');
                }
            } catch (error) {
                console.error('Erro ao carregar viagens do meu veículo:', error);
            }
        }
        
        function gerarComprovanteMeuVeiculo() {
            const dataFormatada = dataAtualMeuVeiculo.toISOString().split('T')[0];
            const dataExibicao = dataAtualMeuVeiculo.toLocaleDateString('pt-BR');
            
            const url = `/api/comprovante-veiculo?data=${dataFormatada}&data_exibicao=${encodeURIComponent(dataExibicao)}`;
            
            window.open(url, '_blank');
        }
        
        // Funções para modal de seleção de veículo
        function abrirModalSelecaoVeiculo(profissionalId) {
            profissionalSelecionadoModal = profissionalId;
            
            // Carregar veículos no select
            const select = document.getElementById('selectVeiculoModal');
            select.innerHTML = '<option value="">Selecione um veículo</option>';
            
            veiculos.forEach(veiculo => {
                const option = document.createElement('option');
                option.value = veiculo.id_veiculo;
                option.textContent = `${veiculo.veiculo} - ${veiculo.placa} (${veiculo.motorista})`;
                select.appendChild(option);
            });
            
            const modal = new bootstrap.Modal(document.getElementById('modalSelecaoVeiculo'));
            modal.show();
        }
        
        function cancelarSelecaoVeiculo() {
            // Desmarcar checkbox
            document.getElementById('perm_meu_veiculo').checked = false;
            veiculoSelecionadoModal = null;
            profissionalSelecionadoModal = null;
        }
        
        function confirmarSelecaoVeiculo() {
            const veiculoId = document.getElementById('selectVeiculoModal').value;
            
            if (!veiculoId) {
                alert('Por favor, selecione um veículo.');
                return;
            }
            
            veiculoSelecionadoModal = veiculoId;
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalSelecaoVeiculo'));
            modal.hide();
        }
        
        async function carregarVeiculoAssociado(profissionalId) {
            try {
                const response = await fetch(`/api/usuarios/${profissionalId}`);
                if (response.ok) {
                    const usuario = await response.json();
                    if (usuario.id_usuario) {
                        const veiculoResponse = await fetch(`/api/usuario-veiculo/${usuario.id_usuario}`);
                        if (veiculoResponse.ok) {
                            const veiculo = await veiculoResponse.json();
                            if (veiculo.id_veiculo) {
                                veiculoSelecionadoModal = veiculo.id_veiculo;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Erro ao carregar veículo associado:', error);
            }
        }
        
        function handleMeuVeiculoChange() {
            const checkbox = document.getElementById('perm_meu_veiculo');
            const profissionalId = document.getElementById('profissionalPermissao').value;
            
            if (checkbox.checked && profissionalId) {
                // Abrir modal para seleção de veículo
                abrirModalSelecaoVeiculo(profissionalId);
            } else if (!checkbox.checked) {
                // Limpar seleção
                veiculoSelecionadoModal = null;
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
                    <button class="edit-btn" onclick="event.stopPropagation(); editarServico('${servico.nome_servico}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="event.stopPropagation(); excluirServico('${servico.nome_servico}')">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                container.appendChild(box);
            });
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
                    <button class="edit-btn" onclick="event.stopPropagation(); editarLocal('${local.nome_local}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="event.stopPropagation(); excluirLocal('${local.nome_local}')">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                container.appendChild(box);
            });
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
        
        function toggleLocal(local) {
            const index = locaisSelecionados.indexOf(local);
            if (index > -1) {
                locaisSelecionados.splice(index, 1);
            } else {
                locaisSelecionados.push(local);
            }
            renderizarLocaisBoxes();
        }
        
        function adicionarNovoServico() {
            const input = document.getElementById('novoServico');
            const servico = input.value.trim();
            if (servico && !servicos.some(s => s.nome_servico === servico)) {
                servicos.push({ nome_servico: servico });
                servicosSelecionados.push(servico);
                renderizarServicosBoxes();
                input.value = '';
                alert('Serviço adicionado com sucesso!');
            } else if (servico) {
                alert('Serviço já existe!');
            }
        }
        
        function adicionarNovoLocal() {
            const input = document.getElementById('novoLocal');
            const local = input.value.trim();
            if (local && !locais.some(l => l.nome_local === local)) {
                locais.push({ nome_local: local });
                locaisSelecionados.push(local);
                renderizarLocaisBoxes();
                input.value = '';
                alert('Local adicionado com sucesso!');
            } else if (local) {
                alert('Local já existe!');
            }
        }
        
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
                    alert('Serviço editado com sucesso!');
                }
            }
        }
        
        function excluirServico(servico) {
            if (confirm(`Excluir o serviço "${servico}"?`)) {
                servicos = servicos.filter(s => s.nome_servico !== servico);
                servicosSelecionados = servicosSelecionados.filter(s => s !== servico);
                renderizarServicosBoxes();
                alert('Serviço excluído com sucesso!');
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
                    alert('Local editado com sucesso!');
                }
            }
        }
        
        function excluirLocal(local) {
            if (confirm(`Excluir o local "${local}"?`)) {
                locais = locais.filter(l => l.nome_local !== local);
                locaisSelecionados = locaisSelecionados.filter(l => l !== local);
                renderizarLocaisBoxes();
                alert('Local excluído com sucesso!');
            }
        }
        
        // FUNÇÕES PARA OCORRÊNCIAS/TRANSPORTES
        let mesAtualClima = new Date();
        
        async function carregarOcorrencias() {
            try {
                const response = await fetch('/api/ocorrencias-transportes');
                const ocorrencias = await response.json();
                
                const tbody = document.getElementById('listaOcorrencias');
                tbody.innerHTML = '';
                
                ocorrencias.forEach(ocorrencia => {
                    const row = document.createElement('tr');
                    const dataFormatada = new Date(ocorrencia.data_hora_inicio).toLocaleString('pt-BR');
                    
                    row.innerHTML = `
                        <td>${dataFormatada}</td>
                        <td>${ocorrencia.veiculo || 'N/A'}</td>
                        <td>${ocorrencia.motivo_paralizacao}</td>
                        <td>${ocorrencia.tipo_manutencao || 'N/A'}</td>
                        <td><span class="badge ${ocorrencia.status === 'concluído' ? 'bg-success' : 'bg-warning'}">${ocorrencia.status}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="editarOcorrencia(${ocorrencia.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="excluirOcorrencia(${ocorrencia.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } catch (error) {
                console.error('Erro ao carregar ocorrências:', error);
            }
        }
        
        async function salvarOcorrencia(e) {
            e.preventDefault();
            const form = document.getElementById('ocorrenciaForm');
            const editId = form.getAttribute('data-edit-id');
            
            const dados = {
                obra_local_id: document.getElementById('obraLocalOcorrencia').value,
                veiculo_id: document.getElementById('veiculoOcorrencia').value,
                motivo_paralizacao: document.getElementById('motivoParalizacao').value,
                tipo_manutencao: document.getElementById('tipoManutencao').value,
                descricao_manutencao: document.getElementById('descricaoManutencao').value,
                data_hora_inicio: document.getElementById('dataHoraInicio').value,
                data_hora_retorno: document.getElementById('dataHoraRetorno').value,
                observacoes: document.getElementById('observacoesOcorrencia').value,
                status: document.getElementById('statusOcorrencia').value,
                indicador_preventiva: document.getElementById('indicadorPreventiva').checked,
                usuario_id: currentUser.id
            };
            
            try {
                let response;
                if (editId) {
                    response = await fetch(`/api/ocorrencias-transportes/${editId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                } else {
                    response = await fetch('/api/ocorrencias-transportes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                }
                
                const result = await response.json();
                
                if (result.success) {
                    alert(editId ? 'Ocorrência atualizada com sucesso!' : 'Ocorrência registrada com sucesso!');
                    form.reset();
                    form.removeAttribute('data-edit-id');
                    carregarOcorrencias();
                } else {
                    alert('Erro: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                alert('Erro ao salvar ocorrência: ' + error.message);
            }
        }
        
        async function editarOcorrencia(id) {
            try {
                const response = await fetch('/api/ocorrencias-transportes');
                const ocorrencias = await response.json();
                const ocorrencia = ocorrencias.find(o => o.id === id);
                
                if (ocorrencia) {
                    document.getElementById('obraLocalOcorrencia').value = ocorrencia.obra_local_id || '';
                    document.getElementById('veiculoOcorrencia').value = ocorrencia.veiculo_id || '';
                    document.getElementById('motivoParalizacao').value = ocorrencia.motivo_paralizacao || '';
                    document.getElementById('tipoManutencao').value = ocorrencia.tipo_manutencao || '';
                    document.getElementById('descricaoManutencao').value = ocorrencia.descricao_manutencao || '';
                    document.getElementById('dataHoraInicio').value = ocorrencia.data_hora_inicio ? ocorrencia.data_hora_inicio.slice(0, 16) : '';
                    document.getElementById('dataHoraRetorno').value = ocorrencia.data_hora_retorno ? ocorrencia.data_hora_retorno.slice(0, 16) : '';
                    document.getElementById('observacoesOcorrencia').value = ocorrencia.observacoes || '';
                    document.getElementById('statusOcorrencia').value = ocorrencia.status || 'em andamento';
                    document.getElementById('indicadorPreventiva').checked = ocorrencia.indicador_preventiva || false;
                    
                    document.getElementById('ocorrenciaForm').setAttribute('data-edit-id', id);
                }
            } catch (error) {
                alert('Erro ao carregar dados da ocorrência: ' + error.message);
            }
        }
        
        // FUNÇÕES PARA CLIMA TEMPO
        async function carregarClimaRegistros() {
            try {
                const response = await fetch('/api/clima-tempo');
                const registros = await response.json();
                
                const tbody = document.getElementById('listaClima');
                tbody.innerHTML = '';
                
                let totalFraca = 0, totalModerada = 0, totalForte = 0;
                
                // Filtrar registros do mês atual
                const registrosMes = registros.filter(registro => {
                    const dataRegistro = new Date(registro.data_ocorrencia);
                    return dataRegistro.getMonth() === mesAtualClima.getMonth() && 
                           dataRegistro.getFullYear() === mesAtualClima.getFullYear();
                });
                
                registrosMes.forEach(registro => {
                    const row = document.createElement('tr');
                    const dataFormatada = new Date(registro.data_ocorrencia).toLocaleDateString('pt-BR');
                    
                    // Contar totais por tipo
                    if (registro.tipo_chuva === 'fraca') totalFraca++;
                    else if (registro.tipo_chuva === 'moderada') totalModerada++;
                    else if (registro.tipo_chuva === 'forte') totalForte++;
                    
                    // Calcular tempo total
                    let tempoTotal = '';
                    if (registro.hora_inicio && registro.hora_fim) {
                        const inicio = new Date(`2000-01-01 ${registro.hora_inicio}`);
                        const fim = new Date(`2000-01-01 ${registro.hora_fim}`);
                        const diff = (fim - inicio) / (1000 * 60); // em minutos
                        tempoTotal = `${Math.floor(diff / 60)}h ${diff % 60}min`;
                    }
                    
                    const corTipo = registro.tipo_chuva === 'fraca' ? 'success' : 
                                   registro.tipo_chuva === 'moderada' ? 'primary' : 'danger';
                    
                    row.innerHTML = `
                        <td>${dataFormatada}</td>
                        <td>${registro.nome_obra || 'N/A'}</td>
                        <td><span class="badge bg-${corTipo}">${registro.tipo_chuva}</span></td>
                        <td>${registro.hora_inicio || ''} - ${registro.hora_fim || ''}</td>
                        <td>${tempoTotal}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="editarClima(${registro.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="excluirClima(${registro.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
                
                // Atualizar totais
                document.getElementById('totalFraca').textContent = totalFraca;
                document.getElementById('totalModerada').textContent = totalModerada;
                document.getElementById('totalForte').textContent = totalForte;
                document.getElementById('totalGeral').textContent = totalFraca + totalModerada + totalForte;
                
                // Atualizar cabeçalho do mês
                document.getElementById('mesAtualClima').textContent = 
                    mesAtualClima.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                    
            } catch (error) {
                console.error('Erro ao carregar registros de clima:', error);
            }
        }
        
        async function salvarClima(e) {
            e.preventDefault();
            const form = document.getElementById('climaForm');
            const editId = form.getAttribute('data-edit-id');
            
            const dados = {
                data_ocorrencia: document.getElementById('dataOcorrencia').value,
                obra_local_id: document.getElementById('obraLocalClima').value,
                tipo_chuva: document.getElementById('tipoChuva').value,
                hora_inicio: document.getElementById('horaInicio').value,
                hora_fim: document.getElementById('horaFim').value,
                observacoes: document.getElementById('observacoesClima').value,
                usuario_id: currentUser.id
            };
            
            try {
                let response;
                if (editId) {
                    response = await fetch(`/api/clima-tempo/${editId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                } else {
                    response = await fetch('/api/clima-tempo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dados)
                    });
                }
                
                const result = await response.json();
                
                if (result.success) {
                    alert(editId ? 'Registro de clima atualizado com sucesso!' : 'Registro de clima salvo com sucesso!');
                    form.reset();
                    form.removeAttribute('data-edit-id');
                    carregarClimaRegistros();
                } else {
                    alert('Erro: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                alert('Erro ao salvar registro: ' + error.message);
            }
        }
        
        async function editarClima(id) {
            try {
                const response = await fetch('/api/clima-tempo');
                const registros = await response.json();
                const registro = registros.find(r => r.id === id);
                
                if (registro) {
                    document.getElementById('dataOcorrencia').value = registro.data_ocorrencia || '';
                    document.getElementById('obraLocalClima').value = registro.obra_local_id || '';
                    document.getElementById('tipoChuva').value = registro.tipo_chuva || '';
                    document.getElementById('horaInicio').value = registro.hora_inicio || '';
                    document.getElementById('horaFim').value = registro.hora_fim || '';
                    document.getElementById('observacoesClima').value = registro.observacoes || '';
                    
                    document.getElementById('climaForm').setAttribute('data-edit-id', id);
                }
            } catch (error) {
                alert('Erro ao carregar dados do registro: ' + error.message);
            }
        }
        
        function navegarMesClima(direcao) {
            mesAtualClima.setMonth(mesAtualClima.getMonth() + direcao);
            carregarClimaRegistros();
        }
        
        async function carregarDadosNovosModulos() {
            // Carregar obras para os selects
            try {
                const response = await fetch('/api/obras');
                const obras = await response.json();
                
                const selectOcorrencia = document.getElementById('obraLocalOcorrencia');
                const selectClima = document.getElementById('obraLocalClima');
                
                if (selectOcorrencia) {
                    selectOcorrencia.innerHTML = '<option value="">Selecione uma obra</option>';
                    // Filtrar apenas obras ativas e exibir apenas o nome da obra
                    const obrasAtivasUnicas = [...new Set(obras.filter(obra => obrasAtivas.has(obra.nome_obra)).map(o => o.nome_obra))];
                    obrasAtivasUnicas.forEach(nomeObra => {
                        const option = document.createElement('option');
                        option.value = nomeObra;
                        option.textContent = nomeObra;
                        selectOcorrencia.appendChild(option);
                    });
                }
                
                if (selectClima) {
                    selectClima.innerHTML = '<option value="">Selecione uma obra</option>';
                    // Filtrar apenas obras ativas e exibir apenas o nome da obra
                    const obrasAtivasUnicas = [...new Set(obras.filter(obra => obrasAtivas.has(obra.nome_obra)).map(o => o.nome_obra))];
                    obrasAtivasUnicas.forEach(nomeObra => {
                        const option = document.createElement('option');
                        option.value = nomeObra;
                        option.textContent = nomeObra;
                        selectClima.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Erro ao carregar obras:', error);
            }
            
            // Carregar veículos para ocorrências
            try {
                const response = await fetch('/api/veiculos');
                const veiculos = await response.json();
                
                const selectVeiculo = document.getElementById('veiculoOcorrencia');
                if (selectVeiculo) {
                    selectVeiculo.innerHTML = '<option value="">Selecione um veículo</option>';
                    veiculos.forEach(veiculo => {
                        const option = document.createElement('option');
                        option.value = veiculo.id_veiculo;
                        option.textContent = `${veiculo.veiculo} - ${veiculo.placa}`;
                        selectVeiculo.appendChild(option);
                    });
                }
            } catch (error) {
                console.error('Erro ao carregar veículos:', error);
            }
        }
        
        async function toggleObraAtiva(nomeObra, isAtiva) {
            try {
                const response = await fetch('/api/obras-ativas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome_obra: nomeObra, ativa: isAtiva })
                });
                
                if (response.ok) {
                    if (isAtiva) {
                        obrasAtivas.add(nomeObra);
                    } else {
                        obrasAtivas.delete(nomeObra);
                    }
                    // Atualizar o select de obras na página de viagens
                    carregarObras();
                } else {
                    alert('Erro ao salvar estado da obra');
                    // Reverter checkbox
                    const checkbox = event.target;
                    checkbox.checked = !isAtiva;
                }
            } catch (error) {
                alert('Erro ao salvar estado da obra');
                // Reverter checkbox
                const checkbox = event.target;
                checkbox.checked = !isAtiva;
            }
        }
        
        function editarObra(nomeObra) {
            // Buscar dados da obra
            const obrasObra = obras.filter(o => o.nome_obra === nomeObra);
            if (obrasObra.length === 0) return;
            
            // Preencher o formulário com os dados existentes
            document.getElementById('nomeObra').value = nomeObra;
            
            // Limpar seleções atuais
            servicosSelecionados = [];
            locaisSelecionados = [];
            
            // Selecionar serviços e locais da obra
            const servicosObra = [...new Set(obrasObra.map(o => o.servico))];
            const locaisObra = [...new Set(obrasObra.map(o => o.local))];
            
            servicosObra.forEach(servico => {
                if (!servicos.some(s => s.nome_servico === servico)) {
                    servicos.push({ nome_servico: servico });
                }
                servicosSelecionados.push(servico);
            });
            
            locaisObra.forEach(local => {
                if (!locais.some(l => l.nome_local === local)) {
                    locais.push({ nome_local: local });
                }
                locaisSelecionados.push(local);
            });
            
            // Atualizar as caixinhas
            renderizarServicosBoxes();
            renderizarLocaisBoxes();
            
            // Marcar formulário como edição
            document.getElementById('obraForm').setAttribute('data-edit-obra', nomeObra);
            
            // Rolar para o formulário
            document.getElementById('obraForm').scrollIntoView({ behavior: 'smooth' });
        }
        
        function excluirObra(nomeObra) {
            if (confirm(`Tem certeza que deseja excluir a obra "${nomeObra}"?`)) {
                // Remover todas as entradas da obra
                obras = obras.filter(o => o.nome_obra !== nomeObra);
                obrasAtivas.delete(nomeObra);
                listarObras();
                carregarObras();
                alert('Obra excluída com sucesso!');
            }
        }
    </script>
</body>
</html>
'''

# Template de Login
LOGIN_TEMPLATE = '''
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APONTADOR - Login</title>
    <link rel="icon" type="image/png" href="/favicon.ico">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        body {
            background: url('https://tracsul.com/wp-content/uploads/2022/11/terraplanagem.jpg') center/cover no-repeat;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 100%);
            z-index: 1;
        }
        .login-card {
            background: white;
            border-radius: 15px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1);
            overflow: hidden;
            max-width: 400px;
            width: 100%;
        }
        .login-header {
            background: #0d6efd;
            color: white;
            padding: 2rem;
            text-align: center;
        }
        .login-body {
            padding: 2rem;
        }
        .form-control {
            border-radius: 10px;
            padding: 12px 15px;
            border: 2px solid #e9ecef;
            transition: all 0.3s;
        }
        .form-control:focus {
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.2rem rgba(13,110,253,0.25);
        }
        .btn-login {
            background: #0d6efd;
            border: none;
            border-radius: 10px;
            padding: 12px;
            font-weight: 600;
            transition: all 0.3s;
        }
        .btn-login:hover {
            background: #0b5ed7;
            transform: translateY(-2px);
        }
        .input-group-text {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-right: none;
        }
        .form-control {
            border-left: none;
        }
        .alert {
            border-radius: 10px;
        }
        .login-card {
            z-index: 2;
            position: relative;
        }
        #logoContainer {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 3;
        }
        #logoEmpresa {
            max-height: 80px;
            max-width: 150px;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
        @media (max-width: 768px) {
            #logoContainer {
                top: 15px;
                left: 15px;
            }
            #logoEmpresa {
                max-height: 60px !important;
                max-width: 120px !important;
            }
        }
    </style>
</head>
<body>
    <div id="logoContainer" style="display: none;">
        <img id="logoEmpresa" src="" alt="Logo da Empresa">
    </div>
    <div class="login-card">
            <div class="login-header">
                <i class="fas fa-truck fa-3x mb-3"></i>
                <h3>APONTADOR</h3>
                <p class="mb-0">Sistema de Viagens e Serviços</p>
            </div>
        <div class="login-body">
            <form method="POST">
                <div class="mb-3">
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="fas fa-user"></i>
                        </span>
                        <input type="text" class="form-control" name="usuario" placeholder="Usuário" required>
                    </div>
                </div>
                <div class="mb-4">
                    <div class="input-group">
                        <span class="input-group-text">
                            <i class="fas fa-lock"></i>
                        </span>
                        <input type="password" class="form-control" name="senha" placeholder="Senha" required>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary btn-login w-100">
                    <i class="fas fa-sign-in-alt me-2"></i>ENTRAR
                </button>
            </form>
            {% if error %}
            <div class="alert alert-danger mt-3">{{ error }}</div>
            {% endif %}
        </div>
    </div>
    
    <script>
        // Carregar logo da empresa
        fetch('/api/empresa-config')
            .then(response => response.json())
            .then(config => {
                if (config.logomarca) {
                    document.getElementById('logoEmpresa').src = config.logomarca;
                    document.getElementById('logoContainer').style.display = 'block';
                }
            })
            .catch(error => console.log('Logo não carregada'));
    </script>
</body>
</html>
'''

def verificar_permissao(permissao_necessaria):
    """Decorator para verificar permissões"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Não autenticado'}), 401
            
            conn = get_db_connection()
            query = '''
                SELECT pr.* FROM permissoes pr
                JOIN usuarios u ON pr.id_usuario = u.id_usuario
                WHERE u.id_usuario = ?
            '''
            perms = conn.execute(query, (session['user_id'],)).fetchone()
            conn.close()
            
            # Se é admin ou tem a permissão específica, permite acesso
            if perms and (perms['adm'] == 1 or perms[permissao_necessaria] == 1):
                return f(*args, **kwargs)
            
            return jsonify({'error': 'Sem permissão'}), 403
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

@app.route('/')
def index():
    """Página principal"""
    if 'user_id' not in session:
        return redirect('/login')
    
    # Buscar permissões do usuário
    conn = get_db_connection()
    query = '''
        SELECT u.*, p.nome, pr.* 
        FROM usuarios u
        JOIN profissionais p ON u.id_profissional = p.id_profissional
        LEFT JOIN permissoes pr ON u.id_usuario = pr.id_usuario
        WHERE u.id_usuario = ?
    '''
    user = conn.execute(query, (session['user_id'],)).fetchone()
    conn.close()
    
    if not user:
        return redirect('/login')
    
    # Passar permissões para o template
    # Se for administrador (adm=1), tem todas as permissões
    is_admin = user['adm'] == 1
    permissoes = {
        'adm': user['adm'] or False,
        'dashboard': is_admin or user['dashboard'] or False,
        'registrar_viagem': is_admin or user['registrar_viagem'] or False,
        'obras': is_admin or user['obras'] or False,
        'veiculo': is_admin or user['veiculo'] or False,
        'profissionais': is_admin or user['profissionais'] or False,
        'diaria': is_admin or user['diaria'] or False,
        'meu_veiculo': is_admin or user['meu_veiculo'] or False,
        'painel_controle': is_admin or user['painel_controle'] or False,
        'visualizar_ocorrencias_transportes': is_admin or user['visualizar_ocorrencias_transportes'] or False,
        'visualizar_clima_tempo': is_admin or user['visualizar_clima_tempo'] or False
    }
    
    response = make_response(render_template_string(HTML_TEMPLATE, permissoes=permissoes, user_name=user['nome'], user_id=user['id_usuario']))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        usuario = request.form['usuario']
        senha = request.form['senha']
        
        conn = get_db_connection()
        query = '''
            SELECT u.*, p.nome, pr.* 
            FROM usuarios u
            JOIN profissionais p ON u.id_profissional = p.id_profissional
            LEFT JOIN permissoes pr ON u.id_usuario = pr.id_usuario
            WHERE u.usuario = ? AND u.senha = ?
        '''
        user = conn.execute(query, (usuario, senha)).fetchone()
        conn.close()
        
        if user:
            session['user_id'] = user['id_usuario']
            session['user_name'] = user['nome']
            return redirect('/')
        else:
            return render_template_string(LOGIN_TEMPLATE, error='Usuário ou senha inválidos')
    
    return render_template_string(LOGIN_TEMPLATE)

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/login')

@app.route('/favicon.ico')
def favicon():
    """Serve o favicon do projeto"""
    import os
    from flask import make_response
    try:
        favicon_path = os.path.join(os.path.dirname(__file__), 'faviconAPONTADOR.png')
        if os.path.exists(favicon_path):
            response = make_response(send_file(favicon_path, mimetype='image/png'))
            response.headers['Cache-Control'] = 'public, max-age=86400'
            return response
        else:
            return '', 404
    except Exception as e:
        return '', 404

# ROTAS API - AUTENTICAÇÃO E USUÁRIOS
@app.route('/api/usuarios', methods=['GET'])
def get_usuarios():
    conn = get_db_connection()
    query = '''
        SELECT u.*, p.nome, p.funcao, pr.*
        FROM usuarios u
        JOIN profissionais p ON u.id_profissional = p.id_profissional
        LEFT JOIN permissoes pr ON u.id_usuario = pr.id_usuario
    '''
    usuarios = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(usuario) for usuario in usuarios])

@app.route('/api/usuarios/<int:profissional_id>', methods=['GET'])
def get_usuario_by_profissional(profissional_id):
    conn = get_db_connection()
    query = '''
        SELECT u.*, pr.*
        FROM usuarios u
        LEFT JOIN permissoes pr ON u.id_usuario = pr.id_usuario
        WHERE u.id_profissional = ?
    '''
    usuario = conn.execute(query, (profissional_id,)).fetchone()
    conn.close()
    
    if usuario:
        return jsonify(dict(usuario))
    else:
        return jsonify({'error': 'Usuário não encontrado'}), 404

@app.route('/api/permissoes', methods=['POST'])
@verificar_permissao('painel_controle')
def salvar_permissoes():
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar se usuário já existe
        cursor.execute('SELECT id_usuario FROM usuarios WHERE id_profissional = ?', (data['id_profissional'],))
        usuario_existente = cursor.fetchone()
        
        if not usuario_existente and data.get('usuario') and data.get('senha'):
            # Criar novo usuário
            cursor.execute('INSERT INTO usuarios (id_profissional, usuario, senha) VALUES (?, ?, ?)',
                          (data['id_profissional'], data['usuario'], data['senha']))
            user_id = cursor.lastrowid
            
            # Criar permissões
            cursor.execute('''
                INSERT INTO permissoes (id_usuario, adm, dashboard, registrar_viagem, obras, veiculo, profissionais, diaria, meu_veiculo, painel_controle, visualizar_ocorrencias_transportes, visualizar_clima_tempo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, data.get('adm', False), data.get('dashboard', False), data.get('registrar_viagem', False),
                  data.get('obras', False), data.get('veiculo', False), data.get('profissionais', False),
                  data.get('diaria', False), data.get('meu_veiculo', False), data.get('painel_controle', False),
                  data.get('visualizar_ocorrencias_transportes', False), data.get('visualizar_clima_tempo', False)))
        elif usuario_existente:
            # Atualizar permissões existentes
            user_id = usuario_existente[0]
            cursor.execute('''
                UPDATE permissoes SET adm=?, dashboard=?, registrar_viagem=?, obras=?, veiculo=?, profissionais=?, diaria=?, meu_veiculo=?, painel_controle=?, visualizar_ocorrencias_transportes=?, visualizar_clima_tempo=?
                WHERE id_usuario=?
            ''', (data.get('adm', False), data.get('dashboard', False), data.get('registrar_viagem', False),
                  data.get('obras', False), data.get('veiculo', False), data.get('profissionais', False),
                  data.get('diaria', False), data.get('meu_veiculo', False), data.get('painel_controle', False),
                  data.get('visualizar_ocorrencias_transportes', False), data.get('visualizar_clima_tempo', False), user_id))
        
        # Associar veículo se fornecido e permissão "meu_veiculo" estiver ativa
        if data.get('meu_veiculo') and data.get('id_veiculo') and (usuario_existente or user_id):
            final_user_id = usuario_existente[0] if usuario_existente else user_id
            cursor.execute('''
                INSERT OR REPLACE INTO usuario_veiculo (id_usuario, id_veiculo) VALUES (?, ?)
            ''', (final_user_id, data['id_veiculo']))
        elif not data.get('meu_veiculo') and (usuario_existente or user_id):
            # Se a permissão "meu_veiculo" foi desabilitada, remover associação
            final_user_id = usuario_existente[0] if usuario_existente else user_id
            cursor.execute('DELETE FROM usuario_veiculo WHERE id_usuario = ?', (final_user_id,))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/usuario-veiculo/<int:usuario_id>', methods=['GET'])
def get_usuario_veiculo(usuario_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    # Permitir acesso se é admin, tem permissão painel_controle OU é o próprio usuário consultando
    conn = get_db_connection()
    query = '''
        SELECT pr.* FROM permissoes pr
        JOIN usuarios u ON pr.id_usuario = u.id_usuario
        WHERE u.id_usuario = ?
    '''
    perms = conn.execute(query, (session['user_id'],)).fetchone()
    
    # Verificar se tem permissão ou se é o próprio usuário
    if not perms or (perms['adm'] != 1 and perms['painel_controle'] != 1 and session['user_id'] != usuario_id):
        conn.close()
        return jsonify({'error': 'Sem permissão'}), 403
    
    query = '''
        SELECT uv.id_veiculo, v.veiculo, v.placa, v.cubagem_m3, v.motorista
        FROM usuario_veiculo uv
        JOIN veiculos v ON uv.id_veiculo = v.id_veiculo
        WHERE uv.id_usuario = ?
    '''
    veiculo = conn.execute(query, (usuario_id,)).fetchone()
    conn.close()
    
    if veiculo:
        return jsonify(dict(veiculo))
    else:
        return jsonify({'id_veiculo': None})

@app.route('/api/empresa-config', methods=['GET'])
def get_empresa_config():
    conn = get_db_connection()
    config = conn.execute('SELECT * FROM empresa_config WHERE id = 1').fetchone()
    conn.close()
    
    if config:
        return jsonify(dict(config))
    else:
        return jsonify({'nome_empresa': '', 'telefone': '', 'endereco': '', 'cnpj': '', 'logomarca': ''})

@app.route('/api/empresa-config', methods=['POST'])
@verificar_permissao('painel_controle')
def salvar_empresa_config():
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE empresa_config SET nome_empresa=?, telefone=?, endereco=?, cnpj=?, logomarca=?
            WHERE id=1
        ''', (data.get('nome_empresa', ''), data.get('telefone', ''), data.get('endereco', ''),
              data.get('cnpj', ''), data.get('logomarca', '')))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/obras-ativas', methods=['GET'])
def get_obras_ativas():
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    obras_ativas = conn.execute('SELECT nome_obra FROM obras_ativas WHERE ativa = 1').fetchall()
    conn.close()
    return jsonify([obra['nome_obra'] for obra in obras_ativas])

@app.route('/api/obras-ativas', methods=['POST'])
@verificar_permissao('obras')
def toggle_obra_ativa():
    try:
        data = request.get_json()
        nome_obra = data.get('nome_obra')
        ativa = data.get('ativa', True)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO obras_ativas (nome_obra, ativa) VALUES (?, ?)
        ''', (nome_obra, ativa))
        
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/viagens-usuario', methods=['GET'])
@verificar_permissao('registrar_viagem')
def get_viagens_usuario():
    data = request.args.get('data')
    usuario_id = request.args.get('usuario')
    
    conn = get_db_connection()
    query = '''
        SELECT v.*, o.nome_obra, o.servico, o.local, ve.veiculo, ve.placa
        FROM viagens v
        JOIN obras o ON v.id_obra = o.id_obra
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        WHERE DATE(v.data_hora) = ? AND v.id_usuario = ?
        ORDER BY o.nome_obra, v.data_hora
    '''
    
    viagens = conn.execute(query, (data, usuario_id)).fetchall()
    conn.close()
    return jsonify([dict(viagem) for viagem in viagens])

@app.route('/api/viagens-veiculo', methods=['GET'])
@verificar_permissao('meu_veiculo')
def get_viagens_veiculo():
    data = request.args.get('data')
    veiculo_id = request.args.get('veiculo_id')
    
    conn = get_db_connection()
    query = '''
        SELECT v.*, o.nome_obra, o.servico, o.local, ve.veiculo, ve.placa, u.usuario, p.nome as nome_usuario
        FROM viagens v
        JOIN obras o ON v.id_obra = o.id_obra
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        LEFT JOIN usuarios u ON v.id_usuario = u.id_usuario
        LEFT JOIN profissionais p ON u.id_profissional = p.id_profissional
        WHERE DATE(v.data_hora) = ? AND v.id_veiculo = ?
        ORDER BY v.data_hora DESC
    '''
    
    viagens = conn.execute(query, (data, veiculo_id)).fetchall()
    conn.close()
    return jsonify([dict(viagem) for viagem in viagens])

@app.route('/api/comprovante-diaria', methods=['GET'])
def gerar_comprovante_diaria():
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    if not REPORTLAB_AVAILABLE:
        return jsonify({'error': 'Biblioteca PDF não disponível'}), 500
    
    data = request.args.get('data')
    usuario_id = request.args.get('usuario')
    data_exibicao = request.args.get('data_exibicao')
    
    conn = get_db_connection()
    
    # Buscar dados do usuário
    user_query = '''
        SELECT u.*, p.nome FROM usuarios u
        JOIN profissionais p ON u.id_profissional = p.id_profissional
        WHERE u.id_usuario = ?
    '''
    usuario = conn.execute(user_query, (usuario_id,)).fetchone()
    
    # Buscar viagens
    query = '''
        SELECT v.*, o.nome_obra, o.servico, o.local, ve.veiculo, ve.placa, ve.cubagem_m3
        FROM viagens v
        JOIN obras o ON v.id_obra = o.id_obra
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        WHERE DATE(v.data_hora) = ? AND v.id_usuario = ?
        ORDER BY ve.veiculo, o.nome_obra, o.servico, v.data_hora
    '''
    
    viagens = conn.execute(query, (data, usuario_id)).fetchall()
    conn.close()
    
    # Calcular totais gerais antes de montar o PDF
    Total_Qtd_Final = 0
    Total_Volume_Final = 0
    for viagem in viagens:
        Total_Qtd_Final += viagem['quantidade_viagens']
        Total_Volume_Final += viagem['quantidade_viagens'] * float(viagem['cubagem_m3'])
    
    # Gerar PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=16, spaceAfter=20, alignment=1)
    normal_style = styles['Normal']
    
    story = []
    
    # Cabeçalho
    story.append(Paragraph('DIÁRIA - Relatório de Lançamentos dos Veículos', title_style))
    story.append(Paragraph(f'Data: {data_exibicao}', normal_style))
    story.append(Paragraph(f'Responsável: {usuario["nome"] if usuario else "N/A"}', normal_style))
    story.append(Spacer(1, 10))
    
    # Produção
    story.append(Paragraph('<b><font size="10">RESUMO TOTAL DOS REGISTROS:</font></b>', normal_style))
    story.append(Paragraph(
        f'<b>Produção: {Total_Qtd_Final:.2f} viagem(ns), {Total_Volume_Final:.2f}m³</b>',
        normal_style
    ))
    story.append(Spacer(1, 10))
    
    # Registros
    story.append(Paragraph('********************************************', normal_style))
    
    # Agrupar por veículo
    veiculos_agrupados = {}
    for viagem in viagens:
        veiculo_key = f"{viagem['veiculo']}|{viagem['cubagem_m3']}"
        if veiculo_key not in veiculos_agrupados:
            veiculos_agrupados[veiculo_key] = []
        veiculos_agrupados[veiculo_key].append(viagem)
    
    for veiculo_key, viagens_veiculo in veiculos_agrupados.items():
        veiculo_nome, cubagem_str = veiculo_key.split('|')
        cubagem = float(cubagem_str)
        
        # Totais por veículo
        total_veiculo_qtd = sum(v['quantidade_viagens'] for v in viagens_veiculo)
        total_veiculo_volume = total_veiculo_qtd * cubagem
        
        story.append(Paragraph(
            f'<b><font size="12">REGISTRO: {veiculo_nome}</font></b>',
            normal_style
        ))
        story.append(Spacer(1, 5))
        
        story.append(Paragraph(
            f'<b><font size="10">Subtotal: {total_veiculo_qtd:.2f} viagem(ns), {total_veiculo_volume:.2f}m³</font></b>',
            normal_style
        ))
        story.append(Spacer(1, 5))
        
        # Agrupar por obra
        obras_agrupadas = {}
        for viagem in viagens_veiculo:
            obra = viagem['nome_obra']
            if obra not in obras_agrupadas:
                obras_agrupadas[obra] = []
            obras_agrupadas[obra].append(viagem)
        
        for obra, viagens_obra in obras_agrupadas.items():
            story.append(Paragraph(f'  OBRA: {obra}', normal_style))
            
            # Agrupar por serviço
            servicos_agrupados = {}
            for viagem in viagens_obra:
                servico = viagem['servico']
                if servico not in servicos_agrupados:
                    servicos_agrupados[servico] = []
                servicos_agrupados[servico].append(viagem)
            
            for servico, viagens_servico in servicos_agrupados.items():
                subtotal_servico_qtd = sum(v['quantidade_viagens'] for v in viagens_servico)
                subtotal_servico_volume = subtotal_servico_qtd * cubagem
                
                story.append(Paragraph(
                    f'    SERVIÇO: {servico}',
                    normal_style
                ))
                story.append(Spacer(1, 5))
                
                # Cabeçalho da tabela de viagens em negrito
                story.append(Paragraph('<b><font size="8.5">HORA | LOCAL</font></b>', normal_style))
                
                # Detalhes das viagens
                for viagem in viagens_servico:
                    data_hora_str = viagem['data_hora']
                    try:
                        if 'T' in data_hora_str:
                            if len(data_hora_str) == 16:
                                dt = datetime.strptime(data_hora_str, '%Y-%m-%dT%H:%M')
                            else:
                                dt = datetime.strptime(data_hora_str, '%Y-%m-%dT%H:%M:%S')
                        else:
                            dt = datetime.strptime(data_hora_str, '%Y-%m-%d %H:%M:%S')
                        hora = dt.strftime('%H:%M')
                    except ValueError:
                        hora = data_hora_str[-5:] if len(data_hora_str) >= 5 else data_hora_str
                    
                    story.append(Paragraph(
                        f'      {hora} | {viagem["local"]}',
                        normal_style
                    ))
                
                # Totais do serviço
                story.append(Paragraph(
                    f'    <b><font size="10">Total: {subtotal_servico_qtd:.2f} viagem(ns), {subtotal_servico_volume:.2f}m³</font></b>',
                    normal_style
                ))
                story.append(Spacer(1, 5))
            
            story.append(Spacer(1, 10))
        
        story.append(Spacer(1, 15))
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'cupom_diaria_{data}_{usuario["nome"] if usuario else "usuario"}.pdf',
        mimetype='application/pdf'
    )

# API endpoints para filtros dinâmicos
@verificar_permissao('dashboard')
def get_dashboard_kpis():
    conn = get_db_connection()
    
    # Ocorrências em andamento
    try:
        ocorrencias_andamento = conn.execute(
            "SELECT COUNT(*) as count FROM ocorrencias_transportes WHERE status = 'em andamento'"
        ).fetchone()['count']
    except:
        ocorrencias_andamento = 0
    
    # Chuvas do mês atual
    from datetime import datetime
    mes_atual = datetime.now().strftime('%Y-%m')
    try:
        chuvas_mes = conn.execute(
            "SELECT COUNT(*) as count FROM clima_tempo WHERE strftime('%Y-%m', data_ocorrencia) = ?",
            (mes_atual,)
        ).fetchone()['count']
    except:
        chuvas_mes = 0
    
    # Veículos ativos
    veiculos_ativos = conn.execute("SELECT COUNT(*) as count FROM veiculos").fetchone()['count']
    
    # Total de viagens
    total_viagens = conn.execute(
        "SELECT COALESCE(SUM(quantidade_viagens), 0) as total FROM viagens"
    ).fetchone()['total']
    
    conn.close()
    
    return jsonify({
        'ocorrencias_andamento': ocorrencias_andamento,
        'chuvas_mes': chuvas_mes,
        'veiculos_ativos': veiculos_ativos,
        'total_viagens': total_viagens
    })

@app.route('/api/viagens', methods=['GET'])
@verificar_permissao('registrar_viagem')
def get_viagens_filtradas():
    conn = get_db_connection()
    
    # Parâmetros de filtro
    obra = request.args.get('obra')
    veiculo = request.args.get('veiculo')
    motorista = request.args.get('motorista')
    servico = request.args.get('servico')
    local = request.args.get('local')
    data_inicio = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')
    
    # Query base
    query = '''
        SELECT v.*, o.nome_obra, o.servico, o.local, ve.veiculo, ve.placa, ve.motorista, ve.cubagem_m3
        FROM viagens v
        JOIN obras o ON v.id_obra = o.id_obra
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        WHERE 1=1
    '''
    
    params = []
    
    # Aplicar filtros dinamicamente
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        query += f' AND o.nome_obra IN ({placeholders})'
        params.extend(obras_list)
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        query += f' AND ve.veiculo IN ({placeholders})'
        params.extend(veiculos_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        query += f' AND ve.motorista IN ({placeholders})'
        params.extend(motoristas_list)
    
    if servico:
        servicos_list = servico.split(',')
        placeholders = ','.join(['?' for _ in servicos_list])
        query += f' AND o.servico IN ({placeholders})'
        params.extend(servicos_list)
    
    if local:
        locais_list = local.split(',')
        placeholders = ','.join(['?' for _ in locais_list])
        query += f' AND o.local IN ({placeholders})'
        params.extend(locais_list)
    
    if data_inicio and data_fim:
        query += ' AND DATE(v.data_hora) BETWEEN ? AND ?'
        params.extend([data_inicio, data_fim])
    
    query += ' ORDER BY v.data_hora DESC'
    
    viagens = conn.execute(query, params).fetchall()
    conn.close()
    
    return jsonify([dict(viagem) for viagem in viagens])

@app.route('/api/diarias', methods=['GET'])
@verificar_permissao('diaria')
def get_diarias_filtradas():
    conn = get_db_connection()
    
    # Parâmetros de filtro
    obra = request.args.get('obra')
    veiculo = request.args.get('veiculo')
    motorista = request.args.get('motorista')
    servico = request.args.get('servico')
    local = request.args.get('local')
    
    # Query base para diárias
    query = '''
        SELECT 
            v.id_veiculo,
            v.veiculo,
            v.placa,
            v.motorista,
            v.cubagem_m3,
            COALESCE(SUM(vi.quantidade_viagens), 0) as total_viagens,
            COALESCE(SUM(vi.quantidade_viagens * v.cubagem_m3), 0) as volume_total
        FROM veiculos v
        LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        LEFT JOIN obras o ON vi.id_obra = o.id_obra
        WHERE 1=1
    '''
    
    params = []
    
    # Aplicar filtros
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        query += f' AND (o.nome_obra IN ({placeholders}) OR o.nome_obra IS NULL)'
        params.extend(obras_list)
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        query += f' AND v.veiculo IN ({placeholders})'
        params.extend(veiculos_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        query += f' AND v.motorista IN ({placeholders})'
        params.extend(motoristas_list)
    
    if servico:
        servicos_list = servico.split(',')
        placeholders = ','.join(['?' for _ in servicos_list])
        query += f' AND (o.servico IN ({placeholders}) OR o.servico IS NULL)'
        params.extend(servicos_list)
    
    if local:
        locais_list = local.split(',')
        placeholders = ','.join(['?' for _ in locais_list])
        query += f' AND (o.local IN ({placeholders}) OR o.local IS NULL)'
        params.extend(locais_list)
    
    query += ' GROUP BY v.id_veiculo, v.veiculo, v.placa, v.motorista, v.cubagem_m3'
    query += ' ORDER BY v.veiculo'
    
    diarias = conn.execute(query, params).fetchall()
    conn.close()
    
    return jsonify([dict(diaria) for diaria in diarias])

@app.route('/api/veiculos-por-obra', methods=['GET'])
@verificar_permissao('registrar_viagem')
def get_veiculos_por_obra():
    obra = request.args.get('obra')
    
    if not obra:
        return jsonify([])
    
    conn = get_db_connection()
    
    # Buscar veículos que já foram usados na obra selecionada
    query = '''
        SELECT DISTINCT v.id_veiculo, v.veiculo, v.placa, v.motorista, v.cubagem_m3
        FROM veiculos v
        JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        JOIN obras o ON vi.id_obra = o.id_obra
        WHERE o.nome_obra = ?
        UNION
        SELECT v.id_veiculo, v.veiculo, v.placa, v.motorista, v.cubagem_m3
        FROM veiculos v
        ORDER BY veiculo
    '''
    
    veiculos = conn.execute(query, (obra,)).fetchall()
    conn.close()
    
    return jsonify([dict(veiculo) for veiculo in veiculos])

@app.route('/api/motoristas-por-obra', methods=['GET'])
@verificar_permissao('registrar_viagem')
def get_motoristas_por_obra():
    obra = request.args.get('obra')
    
    if not obra:
        return jsonify([])
    
    conn = get_db_connection()
    
    # Buscar motoristas que já trabalharam na obra selecionada
    query = '''
        SELECT DISTINCT v.motorista
        FROM veiculos v
        JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        JOIN obras o ON vi.id_obra = o.id_obra
        WHERE o.nome_obra = ?
        UNION
        SELECT DISTINCT motorista FROM veiculos
        ORDER BY motorista
    '''
    
    motoristas = conn.execute(query, (obra,)).fetchall()
    conn.close()
    
    return jsonify([{'motorista': row['motorista']} for row in motoristas])
def get_dashboard_kpis():
    conn = get_db_connection()
    
    # Ocorrências em andamento
    ocorrencias_andamento = conn.execute(
        "SELECT COUNT(*) as count FROM ocorrencias_transportes WHERE status = 'em andamento'"
    ).fetchone()['count']
    
    # Chuvas do mês atual
    from datetime import datetime
    mes_atual = datetime.now().strftime('%Y-%m')
    chuvas_mes = conn.execute(
        "SELECT COUNT(*) as count FROM clima_tempo WHERE strftime('%Y-%m', data_ocorrencia) = ?",
        (mes_atual,)
    ).fetchone()['count']
    
    # Veículos ativos
    veiculos_ativos = conn.execute("SELECT COUNT(*) as count FROM veiculos").fetchone()['count']
    
    # Total de viagens
    total_viagens = conn.execute(
        "SELECT COALESCE(SUM(quantidade_viagens), 0) as total FROM viagens"
    ).fetchone()['total']
    
    conn.close()
    
    return jsonify({
        'ocorrencias_andamento': ocorrencias_andamento,
        'chuvas_mes': chuvas_mes,
        'veiculos_ativos': veiculos_ativos,
        'total_viagens': total_viagens
    })

@verificar_permissao('dashboard')
def get_relatorio_produtividade():
    conn = get_db_connection()
    
    # Produtividade por motorista
    motoristas = conn.execute('''
        SELECT v.motorista, COALESCE(SUM(vi.quantidade_viagens), 0) as quantidade_total
        FROM veiculos v
        LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        GROUP BY v.motorista
        ORDER BY quantidade_total DESC
    ''').fetchall()
    
    # Utilização da frota
    frota = conn.execute('''
        SELECT v.veiculo, COALESCE(SUM(vi.quantidade_viagens), 0) as total_viagens
        FROM veiculos v
        LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        GROUP BY v.veiculo
        ORDER BY total_viagens DESC
    ''').fetchall()
    
    conn.close()
    
    return jsonify({
        'motoristas': [dict(row) for row in motoristas],
        'frota': [dict(row) for row in frota]
    })

@verificar_permissao('dashboard')
def get_relatorio_paralizacoes():
    conn = get_db_connection()
    
    paralizacoes = conn.execute('''
        SELECT ot.*, v.veiculo
        FROM ocorrencias_transportes ot
        JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
        ORDER BY ot.data_hora_inicio DESC
    ''').fetchall()
    
    conn.close()
    
    return jsonify([dict(row) for row in paralizacoes])

@verificar_permissao('dashboard')
def get_relatorio_chuvas():
    conn = get_db_connection()
    
    chuvas = conn.execute('''
        SELECT * FROM clima_tempo
        ORDER BY data_ocorrencia DESC
    ''').fetchall()
    
    conn.close()
    
    return jsonify([dict(row) for row in chuvas])

@verificar_permissao('dashboard')
def gerar_relatorio_pdf(tipo):
    if not REPORTLAB_AVAILABLE:
        return jsonify({'error': 'Biblioteca PDF não disponível'}), 500
    
    conn = get_db_connection()
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    
    styles = getSampleStyleSheet()
    story = []
    
    if tipo == 'produtividade':
        story.append(Paragraph('Relatório de Produtividade', styles['Title']))
        
        # Dados de produtividade por motorista
        motoristas = conn.execute('''
            SELECT v.motorista, COALESCE(SUM(vi.quantidade_viagens), 0) as total
            FROM veiculos v
            LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
            GROUP BY v.motorista
            ORDER BY total DESC
        ''').fetchall()
        
        data = [['Motorista', 'Total Viagens']]
        for m in motoristas:
            data.append([m['motorista'], str(m['total'])])
        
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
        
    elif tipo == 'paralizacoes':
        story.append(Paragraph('Relatório de Paralizações', styles['Title']))
        
        paralizacoes = conn.execute('''
            SELECT ot.*, v.veiculo
            FROM ocorrencias_transportes ot
            JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
            ORDER BY ot.data_hora_inicio DESC
            LIMIT 50
        ''').fetchall()
        
        data = [['Veículo', 'Motivo', 'Status', 'Data Início']]
        for p in paralizacoes:
            data.append([
                p['veiculo'],
                p['motivo_paralizacao'],
                p['status'],
                p['data_hora_inicio'][:10] if p['data_hora_inicio'] else ''
            ])
        
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
        
    elif tipo == 'chuvas':
        story.append(Paragraph('Relatório de Chuvas', styles['Title']))
        
        chuvas = conn.execute('''
            SELECT * FROM clima_tempo
            ORDER BY data_ocorrencia DESC
            LIMIT 50
        ''').fetchall()
        
        data = [['Data', 'Tipo Chuva', 'Hora Início', 'Hora Fim']]
        for c in chuvas:
            data.append([
                c['data_ocorrencia'],
                c['tipo_chuva'],
                c['hora_inicio'] or '',
                c['hora_fim'] or ''
            ])
        
        table = Table(data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
    
    conn.close()
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'relatorio_{tipo}_{datetime.now().strftime("%Y%m%d")}.pdf',
        mimetype='application/pdf'
    )



# Removed duplicate route - using separate GET/POST routes below
    conn = get_db_connection()
    
    if request.method == 'GET':
        mes = request.args.get('mes')
        ano = request.args.get('ano')
        
        if mes and ano:
            clima = conn.execute('''
                SELECT * FROM clima_tempo
                WHERE strftime('%m', data_ocorrencia) = ? AND strftime('%Y', data_ocorrencia) = ?
                ORDER BY data_ocorrencia DESC
            ''', (mes, ano)).fetchall()
        else:
            clima = conn.execute('''
                SELECT * FROM clima_tempo
                ORDER BY data_ocorrencia DESC
            ''').fetchall()
        
        conn.close()
        return jsonify([dict(row) for row in clima])
    
    elif request.method == 'POST':
        data = request.get_json()
        
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO clima_tempo (
                data_ocorrencia, obra_local_id, tipo_chuva,
                hora_inicio, hora_fim, observacoes
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            data.get('data_ocorrencia'),
            data.get('obra_local_id'),
            data.get('tipo_chuva'),
            data.get('hora_inicio'),
            data.get('hora_fim'),
            data.get('observacoes')
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})

@app.route('/api/ocorrencias-transportes', methods=['GET', 'POST'])
@verificar_permissao('visualizar_ocorrencias_transportes')
def handle_ocorrencias():
    conn = get_db_connection()
    
    if request.method == 'GET':
        try:
            ocorrencias = conn.execute('''
                SELECT ot.*, v.veiculo
                FROM ocorrencias_transportes ot
                JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
                ORDER BY ot.data_hora_inicio DESC
            ''').fetchall()
        except:
            ocorrencias = []
        
        conn.close()
        return jsonify([dict(row) for row in ocorrencias])
    
    elif request.method == 'POST':
        data = request.get_json()
        
        try:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO ocorrencias_transportes (
                    obra_local_id, veiculo_id, motivo_paralizacao, tipo_manutencao,
                    descricao_manutencao, data_hora_inicio, data_hora_retorno,
                    status, indicador_preventiva, observacoes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data.get('obra_local_id'),
                data.get('veiculo_id'),
                data.get('motivo_paralizacao'),
                data.get('tipo_manutencao'),
                data.get('descricao_manutencao'),
                data.get('data_hora_inicio'),
                data.get('data_hora_retorno'),
                data.get('status', 'em andamento'),
                data.get('indicador_preventiva', False),
                data.get('observacoes')
            ))
            
            conn.commit()
            conn.close()
            
            return jsonify({'success': True})
        except Exception as e:
            conn.close()
            return jsonify({'error': str(e)}), 500

        except Exception as e:
            conn.close()
            return jsonify({'error': str(e)}), 500

@verificar_permissao('dashboard')
def get_relatorio_produtividade():
    conn = get_db_connection()
    
    motoristas = conn.execute('''
        SELECT v.motorista, COALESCE(SUM(vi.quantidade_viagens), 0) as quantidade_total
        FROM veiculos v
        LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        GROUP BY v.motorista
        ORDER BY quantidade_total DESC
    ''').fetchall()
    
    frota = conn.execute('''
        SELECT v.veiculo, COALESCE(SUM(vi.quantidade_viagens), 0) as total_viagens
        FROM veiculos v
        LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        GROUP BY v.veiculo
        ORDER BY total_viagens DESC
    ''').fetchall()
    
    conn.close()
    
    return jsonify({
        'motoristas': [dict(row) for row in motoristas],
        'frota': [dict(row) for row in frota]
    })

@verificar_permissao('dashboard')
def get_relatorio_paralizacoes():
    conn = get_db_connection()
    
    try:
        paralizacoes = conn.execute('''
            SELECT ot.*, v.veiculo
            FROM ocorrencias_transportes ot
            JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
            ORDER BY ot.data_hora_inicio DESC
        ''').fetchall()
    except:
        paralizacoes = []
    
    conn.close()
    return jsonify([dict(row) for row in paralizacoes])

@verificar_permissao('dashboard')
def get_relatorio_chuvas():
    conn = get_db_connection()
    
    try:
        chuvas = conn.execute('''
            SELECT * FROM clima_tempo
            ORDER BY data_ocorrencia DESC
        ''').fetchall()
    except:
        chuvas = []
    
    conn.close()
    return jsonify([dict(row) for row in chuvas])

@app.route('/api/comprovante-veiculo', methods=['GET'])
def gerar_comprovante_veiculo():
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    if not REPORTLAB_AVAILABLE:
        return jsonify({'error': 'Biblioteca PDF não disponível'}), 500
    
    data = request.args.get('data')
    data_exibicao = request.args.get('data_exibicao')
    
    conn = get_db_connection()
    
    # Buscar dados do usuário logado
    user_query = '''
        SELECT u.*, p.nome FROM usuarios u
        JOIN profissionais p ON u.id_profissional = p.id_profissional
        WHERE u.id_usuario = ?
    '''
    usuario = conn.execute(user_query, (session['user_id'],)).fetchone()
    
    # Buscar veículo associado ao usuário
    veiculo_query = '''
        SELECT uv.id_veiculo, v.veiculo, v.placa, v.cubagem_m3, v.motorista
        FROM usuario_veiculo uv
        JOIN veiculos v ON uv.id_veiculo = v.id_veiculo
        WHERE uv.id_usuario = ?
    '''
    veiculo = conn.execute(veiculo_query, (session['user_id'],)).fetchone()
    
    if not veiculo:
        conn.close()
        return jsonify({'error': 'Nenhum veículo associado ao usuário'}), 400
    
    # Buscar viagens do veículo na data especificada
    query = '''
        SELECT v.*, o.nome_obra, o.servico, o.local, ve.veiculo, ve.placa, ve.cubagem_m3
        FROM viagens v
        JOIN obras o ON v.id_obra = o.id_obra
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        WHERE DATE(v.data_hora) = ? AND v.id_veiculo = ?
        ORDER BY o.nome_obra, o.servico, v.data_hora
    '''
    
    viagens = conn.execute(query, (data, veiculo['id_veiculo'])).fetchall()
    conn.close()
    
    # Gerar PDF
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=16, spaceAfter=20, alignment=1)
    normal_style = styles['Normal']
    
    story = []
    
    # Cabeçalho
    story.append(Paragraph('DIÁRIA - Relatório de Lançamentos do Veículo', title_style))
    story.append(Paragraph(f'Data: {data_exibicao}', normal_style))
    story.append(Paragraph(f'Motorista: {usuario["nome"] if usuario else "N/A"}', normal_style))
    story.append(Spacer(1, 10))
    
    # Separador visual
    story.append(Paragraph('********************************************', normal_style))
    story.append(Spacer(1, 10))
    
    if not viagens:
        story.append(Paragraph('Nenhuma viagem registrada nesta data.', normal_style))
    else:
        # Calcular totais do veículo
        total_viagens = sum(v['quantidade_viagens'] for v in viagens)
        total_volume = total_viagens * float(veiculo['cubagem_m3'])
        
        # REGISTRO (nome do veículo)
        story.append(Paragraph(
            f'<b><font size="12">REGISTRO: {veiculo["veiculo"]}</font></b>',
            normal_style
        ))
        story.append(Paragraph(
            f'<b>Subtotal: {total_viagens:.2f} viagem(ns), {total_volume:.2f}m³</b>',
            normal_style
        ))
        story.append(Spacer(1, 10))
        
        # Agrupar por obra
        obras_agrupadas = {}
        for viagem in viagens:
            obra = viagem['nome_obra']
            if obra not in obras_agrupadas:
                obras_agrupadas[obra] = []
            obras_agrupadas[obra].append(viagem)
        
        for obra, viagens_obra in obras_agrupadas.items():
            story.append(Paragraph(f'OBRA: {obra}', normal_style))
            
            # Agrupar por serviço
            servicos_agrupados = {}
            for viagem in viagens_obra:
                servico = viagem['servico']
                if servico not in servicos_agrupados:
                    servicos_agrupados[servico] = []
                servicos_agrupados[servico].append(viagem)
            
            for servico, viagens_servico in servicos_agrupados.items():
                subtotal_servico_qtd = sum(v['quantidade_viagens'] for v in viagens_servico)
                subtotal_servico_volume = subtotal_servico_qtd * float(veiculo['cubagem_m3'])
                
                story.append(Paragraph(f'SERVIÇO: {servico}', normal_style))
                story.append(Paragraph('<b>HORA | LOCAL</b>', normal_style))
                
                # Detalhes das viagens
                for viagem in viagens_servico:
                    data_hora_str = viagem['data_hora']
                    try:
                        if 'T' in data_hora_str:
                            if len(data_hora_str) == 16:
                                dt = datetime.strptime(data_hora_str, '%Y-%m-%dT%H:%M')
                            else:
                                dt = datetime.strptime(data_hora_str, '%Y-%m-%dT%H:%M:%S')
                        else:
                            dt = datetime.strptime(data_hora_str, '%Y-%m-%d %H:%M:%S')
                        hora = dt.strftime('%H:%M')
                    except ValueError:
                        hora = data_hora_str[-5:] if len(data_hora_str) >= 5 else data_hora_str
                    
                    story.append(Paragraph(f'{hora} | {viagem["local"]}', normal_style))
                
                # Total do serviço
                story.append(Paragraph(
                    f'<b>Total: {subtotal_servico_qtd:.2f} viagem(ns), {subtotal_servico_volume:.2f}m³</b>',
                    normal_style
                ))
                story.append(Spacer(1, 10))
            
            story.append(Spacer(1, 5))
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'diaria_veiculo_{data}_{veiculo["veiculo"]}.pdf',
        mimetype='application/pdf'
    )

# ROTAS API - PROFISSIONAIS
@app.route('/api/profissionais', methods=['GET'])
def get_profissionais():
    # Permitir acesso se tem permissão para profissionais OU veiculo OU registrar_viagem (precisam dos motoristas)
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    query = '''
        SELECT pr.* FROM permissoes pr
        JOIN usuarios u ON pr.id_usuario = u.id_usuario
        WHERE u.id_usuario = ?
    '''
    perms = conn.execute(query, (session['user_id'],)).fetchone()
    
    if not perms or (perms['adm'] != 1 and perms['profissionais'] != 1 and perms['veiculo'] != 1 and perms['registrar_viagem'] != 1):
        conn.close()
        return jsonify({'error': 'Sem permissão'}), 403
    profissionais = conn.execute('SELECT * FROM profissionais ORDER BY nome').fetchall()
    conn.close()
    return jsonify([dict(profissional) for profissional in profissionais])

@app.route('/api/profissionais', methods=['POST'])
@verificar_permissao('profissionais')
def create_profissional():
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO profissionais (nome, funcao, contato, email, terceirizado, empresa_terceirizada) VALUES (?, ?, ?, ?, ?, ?)',
            (data['nome'], data['funcao'], data.get('contato'), data.get('email'), data.get('terceirizado', False), data.get('empresa_terceirizada'))
        )
        conn.commit()
        profissional_id = cursor.lastrowid
        conn.close()
        return jsonify({'success': True, 'id': profissional_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/profissionais/<int:profissional_id>', methods=['PUT'])
@verificar_permissao('profissionais')
def update_profissional(profissional_id):
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE profissionais SET nome=?, funcao=?, contato=?, email=?, terceirizado=?, empresa_terceirizada=? WHERE id_profissional=?',
            (data['nome'], data['funcao'], data.get('contato'), data.get('email'), data.get('terceirizado', False), data.get('empresa_terceirizada'), profissional_id)
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ROTAS API - OBRAS
@app.route('/api/obras', methods=['GET'])
def get_obras():
    # Permitir acesso se tem permissão para obras OU registrar_viagem (precisa dos dados)
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    query = '''
        SELECT pr.* FROM permissoes pr
        JOIN usuarios u ON pr.id_usuario = u.id_usuario
        WHERE u.id_usuario = ?
    '''
    perms = conn.execute(query, (session['user_id'],)).fetchone()
    
    if not perms or (perms['adm'] != 1 and perms['obras'] != 1 and perms['registrar_viagem'] != 1):
        conn.close()
        return jsonify({'error': 'Sem permissão'}), 403
    obras = conn.execute('SELECT * FROM obras').fetchall()
    conn.close()
    return jsonify([dict(obra) for obra in obras])

@app.route('/api/obras', methods=['POST'])
@verificar_permissao('obras')
def create_obra():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO obras (nome_obra, servico, local) VALUES (?, ?, ?)',
        (data['nome_obra'], data['servico'], data['local'])
    )
    # Marcar obra como ativa por padrão
    cursor.execute(
        'INSERT OR IGNORE INTO obras_ativas (nome_obra, ativa) VALUES (?, 1)',
        (data['nome_obra'],)
    )
    conn.commit()
    obra_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': obra_id})

@app.route('/api/obras/<int:obra_id>', methods=['PUT'])
@verificar_permissao('obras')
def update_obra(obra_id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE obras SET nome_obra=?, servico=?, local=? WHERE id_obra=?',
        (data['nome_obra'], data['servico'], data['local'], obra_id)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

# ROTAS API - VEÍCULOS
@app.route('/api/veiculos', methods=['GET'])
def get_veiculos():
    # Permitir acesso se tem permissão para veiculo OU registrar_viagem OU diaria (precisam dos dados)
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    query = '''
        SELECT pr.* FROM permissoes pr
        JOIN usuarios u ON pr.id_usuario = u.id_usuario
        WHERE u.id_usuario = ?
    '''
    perms = conn.execute(query, (session['user_id'],)).fetchone()
    
    if not perms or (perms['adm'] != 1 and perms['veiculo'] != 1 and perms['registrar_viagem'] != 1 and perms['diaria'] != 1):
        conn.close()
        return jsonify({'error': 'Sem permissão'}), 403
    veiculos = conn.execute('SELECT * FROM veiculos').fetchall()
    conn.close()
    return jsonify([dict(veiculo) for veiculo in veiculos])

@app.route('/api/veiculos', methods=['POST'])
@verificar_permissao('veiculo')
def create_veiculo():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO veiculos (veiculo, placa, cubagem_m3, motorista) VALUES (?, ?, ?, ?)',
        (data['veiculo'], data['placa'], data['cubagem_m3'], data['motorista'])
    )
    conn.commit()
    veiculo_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': veiculo_id})

@app.route('/api/veiculos/<int:veiculo_id>', methods=['PUT'])
@verificar_permissao('veiculo')
def update_veiculo(veiculo_id):
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'UPDATE veiculos SET veiculo=?, placa=?, cubagem_m3=?, motorista=? WHERE id_veiculo=?',
        (data['veiculo'], data['placa'], data['cubagem_m3'], data['motorista'], veiculo_id)
    )
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/obras/<int:obra_id>', methods=['DELETE'])
@verificar_permissao('obras')
def delete_obra(obra_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Para edição, permitir exclusão mesmo com viagens (será recriada)
    # Verificar se é uma exclusão definitiva ou parte de uma edição
    force_delete = request.args.get('force', 'false').lower() == 'true'
    
    if not force_delete:
        # Verificar se existem viagens relacionadas apenas para exclusão definitiva
        cursor.execute('SELECT COUNT(*) FROM viagens WHERE id_obra = ?', (obra_id,))
        viagens_count = cursor.fetchone()[0]
        
        if viagens_count > 0:
            conn.close()
            return jsonify({'error': f'Não é possível excluir esta obra. Existem {viagens_count} viagem(ns) registrada(s) que dependem dela.'}), 400
    
    # Buscar nome da obra antes de excluir
    cursor.execute('SELECT nome_obra FROM obras WHERE id_obra = ?', (obra_id,))
    obra = cursor.fetchone()
    
    cursor.execute('DELETE FROM obras WHERE id_obra = ?', (obra_id,))
    
    # Remover da tabela de obras ativas apenas se for exclusão definitiva
    if obra and not force_delete:
        cursor.execute('DELETE FROM obras_ativas WHERE nome_obra = ?', (obra['nome_obra'],))
    
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/veiculos/<int:veiculo_id>', methods=['DELETE'])
@verificar_permissao('veiculo')
def delete_veiculo(veiculo_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se existem viagens relacionadas
    cursor.execute('SELECT COUNT(*) FROM viagens WHERE id_veiculo = ?', (veiculo_id,))
    viagens_count = cursor.fetchone()[0]
    
    if viagens_count > 0:
        conn.close()
        return jsonify({'error': f'Não é possível excluir este veículo. Existem {viagens_count} viagem(ns) registrada(s) que dependem dele.'}), 400
    
    cursor.execute('DELETE FROM veiculos WHERE id_veiculo = ?', (veiculo_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/profissionais/<int:profissional_id>', methods=['DELETE'])
@verificar_permissao('profissionais')
def delete_profissional(profissional_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verificar se existem usuários relacionados
    cursor.execute('SELECT COUNT(*) FROM usuarios WHERE id_profissional = ?', (profissional_id,))
    usuarios_count = cursor.fetchone()[0]
    
    if usuarios_count > 0:
        conn.close()
        return jsonify({'error': f'Não é possível excluir este profissional. Existem {usuarios_count} usuário(s) relacionado(s).'}), 400
    
    cursor.execute('DELETE FROM profissionais WHERE id_profissional = ?', (profissional_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/viagens/<int:viagem_id>', methods=['DELETE'])
@verificar_permissao('registrar_viagem')
def delete_viagem(viagem_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('DELETE FROM viagens WHERE id_viagem = ?', (viagem_id,))
    conn.commit()
    conn.close()
    return jsonify({'success': True})

@app.route('/api/viagens/<int:viagem_id>', methods=['PUT'])
@verificar_permissao('registrar_viagem')
def update_viagem(viagem_id):
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verificar se temos nome_obra, servico, local ou id_obra
        if 'nome_obra' in data and 'servico' in data and 'local' in data:
            # Buscar ou criar a combinação obra/serviço/local
            cursor.execute(
                'SELECT id_obra FROM obras WHERE nome_obra = ? AND servico = ? AND local = ?',
                (data['nome_obra'], data['servico'], data['local'])
            )
            obra = cursor.fetchone()
            
            if not obra:
                # Criar nova entrada na tabela obras
                cursor.execute(
                    'INSERT INTO obras (nome_obra, servico, local) VALUES (?, ?, ?)',
                    (data['nome_obra'], data['servico'], data['local'])
                )
                obra_id = cursor.lastrowid
            else:
                obra_id = obra['id_obra']
        else:
            obra_id = data.get('id_obra')
        
        cursor.execute(
            'UPDATE viagens SET id_obra=?, id_veiculo=?, data_hora=?, quantidade_viagens=?, id_usuario=?, nome_usuario=? WHERE id_viagem=?',
            (obra_id, data['id_veiculo'], data['data_hora'], data['quantidade_viagens'], data.get('id_usuario'), data.get('nome_usuario'), viagem_id)
        )
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ROTAS API - VIAGENS
@app.route('/api/viagens', methods=['GET'])
def get_viagens():
    # Permitir acesso se tem permissão para registrar_viagem OU diaria OU dashboard (precisam dos dados)
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    query = '''
        SELECT pr.* FROM permissoes pr
        JOIN usuarios u ON pr.id_usuario = u.id_usuario
        WHERE u.id_usuario = ?
    '''
    perms = conn.execute(query, (session['user_id'],)).fetchone()
    
    if not perms or (perms['adm'] != 1 and perms['registrar_viagem'] != 1 and perms['diaria'] != 1 and perms['dashboard'] != 1):
        conn.close()
        return jsonify({'error': 'Sem permissão'}), 403
    
    filtros = []
    params = []
    
    obra = request.args.get('obra', '')
    veiculo = request.args.get('veiculo', '')
    motorista = request.args.get('motorista', '')
    servico = request.args.get('servico', '')
    local = request.args.get('local', '')
    data_inicio = request.args.get('data_inicio', '')
    data_fim = request.args.get('data_fim', '')
    
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        filtros.append(f'o.nome_obra IN ({placeholders})')
        params.extend(obras_list)
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        filtros.append(f've.veiculo IN ({placeholders})')
        params.extend(veiculos_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        filtros.append(f've.motorista IN ({placeholders})')
        params.extend(motoristas_list)
    
    if servico:
        servicos_list = servico.split(',')
        placeholders = ','.join(['?' for _ in servicos_list])
        filtros.append(f'o.servico IN ({placeholders})')
        params.extend(servicos_list)
    
    if local:
        locais_list = local.split(',')
        placeholders = ','.join(['?' for _ in locais_list])
        filtros.append(f'o.local IN ({placeholders})')
        params.extend(locais_list)
    
    if data_inicio and data_fim:
        filtros.append('DATE(v.data_hora) BETWEEN ? AND ?')
        params.extend([data_inicio, data_fim])
    
    where_clause = ' AND '.join(filtros) if filtros else '1=1'
    
    query = f'''
        SELECT v.*, o.nome_obra, o.servico, o.local, ve.veiculo, ve.placa, ve.motorista
        FROM viagens v
        JOIN obras o ON v.id_obra = o.id_obra
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        WHERE {where_clause}
        ORDER BY v.data_hora DESC
    '''
    
    viagens = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(viagem) for viagem in viagens])

@app.route('/api/viagens', methods=['POST'])
@verificar_permissao('registrar_viagem')
def create_viagem():
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'Dados não fornecidos'}), 400
        
        # Verificar se temos nome_obra, servico, local ou id_obra
        if 'nome_obra' in data and 'servico' in data and 'local' in data:
            # Buscar ou criar a combinação obra/serviço/local
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Tentar encontrar a obra existente
            cursor.execute(
                'SELECT id_obra FROM obras WHERE nome_obra = ? AND servico = ? AND local = ?',
                (data['nome_obra'], data['servico'], data['local'])
            )
            obra = cursor.fetchone()
            
            if not obra:
                # Criar nova entrada na tabela obras
                cursor.execute(
                    'INSERT INTO obras (nome_obra, servico, local) VALUES (?, ?, ?)',
                    (data['nome_obra'], data['servico'], data['local'])
                )
                obra_id = cursor.lastrowid
            else:
                obra_id = obra['id_obra']
                
        elif 'id_obra' in data:
            obra_id = int(data['id_obra'])
            conn = get_db_connection()
            cursor = conn.cursor()
        else:
            return jsonify({'error': 'Dados da obra são obrigatórios'}), 400
            
        required_fields = ['id_veiculo', 'data_hora', 'quantidade_viagens']
        for field in required_fields:
            if field not in data or not data[field]:
                conn.close()
                return jsonify({'error': f'Campo {field} é obrigatório'}), 400
            
        cursor.execute('SELECT id_veiculo FROM veiculos WHERE id_veiculo = ?', (int(data['id_veiculo']),))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Veículo não encontrado'}), 400
        
        cursor.execute(
            'INSERT INTO viagens (id_obra, id_veiculo, data_hora, quantidade_viagens, id_usuario, nome_usuario) VALUES (?, ?, ?, ?, ?, ?)',
            (obra_id, int(data['id_veiculo']), data['data_hora'], int(data['quantidade_viagens']), data.get('id_usuario'), data.get('nome_usuario'))
        )
        conn.commit()
        viagem_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'success': True, 'id': viagem_id})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ROTA API - DIÁRIAS
@app.route('/api/diarias', methods=['GET'])
def get_diarias():
    # Permitir acesso se tem permissão para diaria OU dashboard (precisam dos dados)
    if 'user_id' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    conn = get_db_connection()
    query = '''
        SELECT pr.* FROM permissoes pr
        JOIN usuarios u ON pr.id_usuario = u.id_usuario
        WHERE u.id_usuario = ?
    '''
    perms = conn.execute(query, (session['user_id'],)).fetchone()
    
    if not perms or (perms['adm'] != 1 and perms['diaria'] != 1 and perms['dashboard'] != 1):
        conn.close()
        return jsonify({'error': 'Sem permissão'}), 403
    
    filtros = []
    params = []
    
    veiculo = request.args.get('veiculo', '')
    obra = request.args.get('obra', '')
    motorista = request.args.get('motorista', '')
    servico = request.args.get('servico', '')
    local = request.args.get('local', '')
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        filtros.append(f've.veiculo IN ({placeholders})')
        params.extend(veiculos_list)
    
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        filtros.append(f'o.nome_obra IN ({placeholders})')
        params.extend(obras_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        filtros.append(f've.motorista IN ({placeholders})')
        params.extend(motoristas_list)
    
    if servico:
        servicos_list = servico.split(',')
        placeholders = ','.join(['?' for _ in servicos_list])
        filtros.append(f'o.servico IN ({placeholders})')
        params.extend(servicos_list)
    
    if local:
        locais_list = local.split(',')
        placeholders = ','.join(['?' for _ in locais_list])
        filtros.append(f'o.local IN ({placeholders})')
        params.extend(locais_list)
    
    where_clause = ' AND '.join(filtros) if filtros else '1=1'
    
    query = f'''
        SELECT ve.id_veiculo, ve.veiculo, ve.placa, ve.motorista, ve.cubagem_m3,
               COALESCE(SUM(v.quantidade_viagens), 0) as total_viagens,
               COALESCE(ve.cubagem_m3 * SUM(v.quantidade_viagens), 0) as volume_total
        FROM veiculos ve
        LEFT JOIN viagens v ON ve.id_veiculo = v.id_veiculo
        LEFT JOIN obras o ON v.id_obra = o.id_obra
        WHERE {where_clause}
        GROUP BY ve.id_veiculo
        ORDER BY ve.veiculo
    '''
    
    diarias = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(diaria) for diaria in diarias])

# ROTA - EXPORTAR EXCEL
@app.route('/export/excel')
def export_excel():
    if 'user_id' not in session:
        return redirect('/login')
    try:
        conn = get_db_connection()
        
        viagens_query = '''
            SELECT v.*, o.nome_obra, o.servico, o.local, ve.veiculo, ve.placa, ve.motorista, v.nome_usuario as registrado_por
            FROM viagens v
            JOIN obras o ON v.id_obra = o.id_obra
            JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        '''
        viagens = pd.read_sql_query(viagens_query, conn)
        
        diarias_query = '''
            SELECT 
                ve.veiculo, ve.placa, ve.motorista, ve.cubagem_m3,
                COALESCE(SUM(v.quantidade_viagens), 0) as total_viagens,
                COALESCE(ve.cubagem_m3 * SUM(v.quantidade_viagens), 0) as volume_total
            FROM veiculos ve
            LEFT JOIN viagens v ON ve.id_veiculo = v.id_veiculo
            GROUP BY ve.id_veiculo
        '''
        diarias = pd.read_sql_query(diarias_query, conn)
        conn.close()
        
        filename = f'apontador_{datetime.now().strftime("%Y%m%d")}.xlsx'
        filepath = os.path.join(os.getcwd(), filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            viagens.to_excel(writer, sheet_name='Viagens', index=False)
            diarias.to_excel(writer, sheet_name='Diárias', index=False)
        
        return send_file(filepath, as_attachment=True, download_name=filename)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ROTAS API - OCORRÊNCIAS/TRANSPORTES
@app.route('/api/ocorrencias-transportes', methods=['GET'])
@verificar_permissao('visualizar_ocorrencias_transportes')
def get_ocorrencias_transportes():
    conn = get_db_connection()
    query = '''
        SELECT ot.*, o.nome_obra, o.servico, o.local, v.veiculo, v.placa, u.usuario as nome_usuario
        FROM ocorrencias_transportes ot
        LEFT JOIN obras o ON ot.obra_local_id = o.nome_obra
        LEFT JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
        LEFT JOIN usuarios u ON ot.usuario_id = u.id_usuario
        ORDER BY ot.data_hora_inicio DESC
    '''
    ocorrencias = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(ocorrencia) for ocorrencia in ocorrencias])

@app.route('/api/ocorrencias-transportes', methods=['POST'])
@verificar_permissao('visualizar_ocorrencias_transportes')
def create_ocorrencia_transporte():
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO ocorrencias_transportes 
            (obra_local_id, veiculo_id, motivo_paralizacao, tipo_manutencao, descricao_manutencao,
             data_hora_inicio, data_hora_retorno, observacoes, usuario_id, foto_anexo, 
             status, indicador_preventiva)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('obra_local_id'), data.get('veiculo_id'), data.get('motivo_paralizacao'),
            data.get('tipo_manutencao'), data.get('descricao_manutencao'), data.get('data_hora_inicio'),
            data.get('data_hora_retorno'), data.get('observacoes'), data.get('usuario_id'),
            data.get('foto_anexo'), data.get('status', 'em andamento'), 
            data.get('indicador_preventiva', False)
        ))
        
        conn.commit()
        ocorrencia_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'success': True, 'id': ocorrencia_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/ocorrencias-transportes/<int:id>', methods=['PUT'])
@verificar_permissao('visualizar_ocorrencias_transportes')
def update_ocorrencia_transporte(id):
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE ocorrencias_transportes SET
            obra_local_id=?, veiculo_id=?, motivo_paralizacao=?, tipo_manutencao=?, descricao_manutencao=?,
            data_hora_inicio=?, data_hora_retorno=?, observacoes=?, foto_anexo=?, 
            status=?, indicador_preventiva=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        ''', (
            data.get('obra_local_id'), data.get('veiculo_id'), data.get('motivo_paralizacao'),
            data.get('tipo_manutencao'), data.get('descricao_manutencao'), data.get('data_hora_inicio'),
            data.get('data_hora_retorno'), data.get('observacoes'), data.get('foto_anexo'),
            data.get('status'), data.get('indicador_preventiva'), id
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ROTAS API - CLIMA TEMPO
@app.route('/api/clima-tempo', methods=['GET'])
@verificar_permissao('visualizar_clima_tempo')
def get_clima_tempo():
    conn = get_db_connection()
    query = '''
        SELECT ct.*, o.nome_obra, o.servico, o.local, u.usuario as nome_usuario
        FROM clima_tempo ct
        LEFT JOIN obras o ON ct.obra_local_id = o.nome_obra
        LEFT JOIN usuarios u ON ct.usuario_id = u.id_usuario
        ORDER BY ct.data_ocorrencia DESC, ct.hora_inicio DESC
    '''
    registros = conn.execute(query).fetchall()
    conn.close()
    return jsonify([dict(registro) for registro in registros])

@app.route('/api/clima-tempo', methods=['POST'])
@verificar_permissao('visualizar_clima_tempo')
def create_clima_tempo():
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO clima_tempo 
            (data_ocorrencia, obra_local_id, tipo_chuva, hora_inicio, hora_fim, observacoes, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('data_ocorrencia'), data.get('obra_local_id'), data.get('tipo_chuva'),
            data.get('hora_inicio'), data.get('hora_fim'), data.get('observacoes'),
            data.get('usuario_id')
        ))
        
        conn.commit()
        registro_id = cursor.lastrowid
        conn.close()
        
        return jsonify({'success': True, 'id': registro_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clima-tempo/<int:id>', methods=['PUT'])
@verificar_permissao('visualizar_clima_tempo')
def update_clima_tempo(id):
    try:
        data = request.get_json()
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE clima_tempo SET
            data_ocorrencia=?, obra_local_id=?, tipo_chuva=?, hora_inicio=?, hora_fim=?, 
            observacoes=?, updated_at=CURRENT_TIMESTAMP
            WHERE id=?
        ''', (
            data.get('data_ocorrencia'), data.get('obra_local_id'), data.get('tipo_chuva'),
            data.get('hora_inicio'), data.get('hora_fim'), data.get('observacoes'), id
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ROTAS API - RELATÓRIOS AVANÇADOS








# API endpoint for filtered vehicles by obra
@app.route('/api/veiculos-filtrados', methods=['GET'])
@verificar_permissao('dashboard')
def get_veiculos_filtrados():
    conn = get_db_connection()
    obra = request.args.get('obra', '')
    
    if obra:
        # Get vehicles that have trips for the selected obra
        query = '''
            SELECT DISTINCT ve.id_veiculo, ve.veiculo, ve.placa, ve.motorista, ve.cubagem_m3
            FROM veiculos ve
            JOIN viagens v ON ve.id_veiculo = v.id_veiculo
            JOIN obras o ON v.id_obra = o.id_obra
            WHERE o.nome_obra = ?
            ORDER BY ve.veiculo
        '''
        veiculos = conn.execute(query, (obra,)).fetchall()
    else:
        # Return all vehicles
        query = 'SELECT * FROM veiculos ORDER BY veiculo'
        veiculos = conn.execute(query).fetchall()
    
    conn.close()
    return jsonify([dict(v) for v in veiculos])

# API endpoint for filtered drivers by obra
@app.route('/api/motoristas-filtrados', methods=['GET'])
@verificar_permissao('dashboard')
def get_motoristas_filtrados():
    conn = get_db_connection()
    obra = request.args.get('obra', '')
    
    if obra:
        # Get drivers that have trips for the selected obra
        query = '''
            SELECT DISTINCT ve.motorista
            FROM veiculos ve
            JOIN viagens v ON ve.id_veiculo = v.id_veiculo
            JOIN obras o ON v.id_obra = o.id_obra
            WHERE o.nome_obra = ?
            ORDER BY ve.motorista
        '''
        motoristas = conn.execute(query, (obra,)).fetchall()
    else:
        # Return all drivers
        query = 'SELECT DISTINCT motorista FROM veiculos ORDER BY motorista'
        motoristas = conn.execute(query).fetchall()
    
    conn.close()
    return jsonify([{'motorista': m[0]} for m in motoristas])

@app.route('/api/relatorio-pdf/<tipo>', methods=['GET'])
@verificar_permissao('dashboard')
def gerar_relatorio_pdf(tipo):
    if not REPORTLAB_AVAILABLE:
        return jsonify({'error': 'Biblioteca PDF não disponível'}), 500
    
    # Get filter parameters
    obra = request.args.get('obra', '')
    veiculo = request.args.get('veiculo', '')
    motorista = request.args.get('motorista', '')
    data_inicio = request.args.get('data_inicio', '')
    data_fim = request.args.get('data_fim', '')
    
    # Build filter info for display
    filter_info = []
    if obra: filter_info.append(f'Obra: {obra}')
    if veiculo: filter_info.append(f'Veículo: {veiculo}')
    if motorista: filter_info.append(f'Motorista: {motorista}')
    if data_inicio and data_fim: filter_info.append(f'Período: {data_inicio} a {data_fim}')
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=16, spaceAfter=20, alignment=1)
    
    story = []
    
    if tipo == 'produtividade':
        story.append(Paragraph('RELATÓRIO DE PRODUTIVIDADE', title_style))
        story.append(Paragraph(f'Data: {datetime.now().strftime("%d/%m/%Y")}', styles['Normal']))
        if filter_info:
            story.append(Paragraph(f'Filtros: {" | ".join(filter_info)}', styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Build filter conditions for produtividade
        filtros = []
        params = []
        
        if obra:
            obras_list = obra.split(',')
            placeholders = ','.join(['?' for _ in obras_list])
            filtros.append(f'o.nome_obra IN ({placeholders})')
            params.extend(obras_list)
        
        if veiculo:
            veiculos_list = veiculo.split(',')
            placeholders = ','.join(['?' for _ in veiculos_list])
            filtros.append(f've.veiculo IN ({placeholders})')
            params.extend(veiculos_list)
        
        if motorista:
            motoristas_list = motorista.split(',')
            placeholders = ','.join(['?' for _ in motoristas_list])
            filtros.append(f've.motorista IN ({placeholders})')
            params.extend(motoristas_list)
        
        if data_inicio and data_fim:
            filtros.append('DATE(v.data_hora) BETWEEN ? AND ?')
            params.extend([data_inicio, data_fim])
        
        where_clause = ' AND '.join(filtros) if filtros else '1=1'
        
        # Buscar dados de produtividade com filtros
        conn = get_db_connection()
        query = f'''
            SELECT ve.motorista, 
                   SUM(v.quantidade_viagens) as total_viagens,
                   SUM(v.quantidade_viagens * ve.cubagem_m3) as volume_total
            FROM viagens v
            JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
            LEFT JOIN obras o ON v.id_obra = o.id_obra
            WHERE {where_clause}
            GROUP BY ve.motorista
            ORDER BY total_viagens DESC
        '''
        dados = conn.execute(query, params).fetchall()
        conn.close()
        
        # Criar tabela
        table_data = [['Motorista', 'Total Viagens', 'Volume (m³)']]
        for row in dados:
            table_data.append([row['motorista'], str(row['total_viagens']), f"{row['volume_total']:.2f}"])
        
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
    
    elif tipo == 'paralizacoes':
        story.append(Paragraph('RELATÓRIO DE PARALIZAÇÕES', title_style))
        story.append(Paragraph(f'Data: {datetime.now().strftime("%d/%m/%Y")}', styles['Normal']))
        if filter_info:
            story.append(Paragraph(f'Filtros: {" | ".join(filter_info)}', styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Build filter conditions for paralizacoes
        filtros = []
        params = []
        
        if veiculo:
            veiculos_list = veiculo.split(',')
            placeholders = ','.join(['?' for _ in veiculos_list])
            filtros.append(f'v.veiculo IN ({placeholders})')
            params.extend(veiculos_list)
        
        if motorista:
            motoristas_list = motorista.split(',')
            placeholders = ','.join(['?' for _ in motoristas_list])
            filtros.append(f'v.motorista IN ({placeholders})')
            params.extend(motoristas_list)
        
        if data_inicio and data_fim:
            filtros.append('DATE(ot.data_hora_inicio) BETWEEN ? AND ?')
            params.extend([data_inicio, data_fim])
        
        where_clause = ' AND '.join(filtros) if filtros else '1=1'
        
        conn = get_db_connection()
        query = f'''
            SELECT v.veiculo, ot.motivo_paralizacao, ot.tipo_manutencao, 
                   ot.data_hora_inicio, ot.status
            FROM ocorrencias_transportes ot
            LEFT JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
            WHERE {where_clause}
            ORDER BY ot.data_hora_inicio DESC
            LIMIT 50
        '''
        dados = conn.execute(query, params).fetchall()
        conn.close()
        
        table_data = [['Veículo', 'Motivo', 'Tipo', 'Data Início', 'Status']]
        for row in dados:
            data_inicio = datetime.fromisoformat(row['data_hora_inicio']).strftime('%d/%m/%Y %H:%M') if row['data_hora_inicio'] else ''
            table_data.append([
                row['veiculo'] or 'N/A',
                row['motivo_paralizacao'] or '',
                row['tipo_manutencao'] or '',
                data_inicio,
                row['status'] or ''
            ])
        
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
    
    elif tipo == 'chuvas':
        story.append(Paragraph('RELATÓRIO DE CLIMA TEMPO', title_style))
        story.append(Paragraph(f'Data: {datetime.now().strftime("%d/%m/%Y")}', styles['Normal']))
        if filter_info:
            story.append(Paragraph(f'Filtros: {" | ".join(filter_info)}', styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Build filter conditions for clima
        filtros = []
        params = []
        
        if obra:
            obras_list = obra.split(',')
            placeholders = ','.join(['?' for _ in obras_list])
            filtros.append(f'o.nome_obra IN ({placeholders})')
            params.extend(obras_list)
        
        if data_inicio and data_fim:
            filtros.append('DATE(ct.data_ocorrencia) BETWEEN ? AND ?')
            params.extend([data_inicio, data_fim])
        
        where_clause = ' AND '.join(filtros) if filtros else '1=1'
        
        conn = get_db_connection()
        query = f'''
            SELECT ct.data_ocorrencia, o.nome_obra, ct.tipo_chuva, 
                   ct.hora_inicio, ct.hora_fim
            FROM clima_tempo ct
            LEFT JOIN obras o ON ct.obra_local_id = o.nome_obra
            WHERE {where_clause}
            ORDER BY ct.data_ocorrencia DESC
            LIMIT 50
        '''
        dados = conn.execute(query, params).fetchall()
        conn.close()
        
        table_data = [['Data', 'Obra', 'Tipo Chuva', 'Início', 'Fim']]
        for row in dados:
            data_ocorrencia = datetime.fromisoformat(row['data_ocorrencia']).strftime('%d/%m/%Y') if row['data_ocorrencia'] else ''
            table_data.append([
                data_ocorrencia,
                row['nome_obra'] or 'N/A',
                row['tipo_chuva'] or '',
                row['hora_inicio'] or '',
                row['hora_fim'] or ''
            ])
        
        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)
    
    doc.build(story)
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=True,
        download_name=f'relatorio_{tipo}_{datetime.now().strftime("%Y%m%d")}.pdf',
        mimetype='application/pdf'
    )

# Add missing endpoints for advanced dashboard data
@app.route('/api/relatorio-produtividade', methods=['GET'])
@verificar_permissao('dashboard')
def get_relatorio_produtividade():
    conn = get_db_connection()
    
    # Get filter parameters
    obra = request.args.get('obra', '')
    veiculo = request.args.get('veiculo', '')
    motorista = request.args.get('motorista', '')
    data_inicio = request.args.get('data_inicio', '')
    data_fim = request.args.get('data_fim', '')
    
    # Build filter conditions
    filtros = []
    params = []
    
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        filtros.append(f'o.nome_obra IN ({placeholders})')
        params.extend(obras_list)
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        filtros.append(f've.veiculo IN ({placeholders})')
        params.extend(veiculos_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        filtros.append(f've.motorista IN ({placeholders})')
        params.extend(motoristas_list)
    
    if data_inicio and data_fim:
        filtros.append('DATE(v.data_hora) BETWEEN ? AND ?')
        params.extend([data_inicio, data_fim])
    
    where_clause = ' AND '.join(filtros) if filtros else '1=1'
    
    # Motoristas data with filters
    motoristas_query = f'''
        SELECT ve.motorista, SUM(v.quantidade_viagens) as quantidade_total
        FROM viagens v
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        LEFT JOIN obras o ON v.id_obra = o.id_obra
        WHERE {where_clause}
        GROUP BY ve.motorista
        ORDER BY quantidade_total DESC
    '''
    motoristas = conn.execute(motoristas_query, params).fetchall()
    
    # Frota data with filters
    frota_query = f'''
        SELECT ve.veiculo, SUM(v.quantidade_viagens) as total_viagens
        FROM viagens v
        JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
        LEFT JOIN obras o ON v.id_obra = o.id_obra
        WHERE {where_clause}
        GROUP BY ve.veiculo
        ORDER BY total_viagens DESC
    '''
    frota = conn.execute(frota_query, params).fetchall()
    
    conn.close()
    
    return jsonify({
        'motoristas': [dict(m) for m in motoristas],
        'frota': [dict(f) for f in frota]
    })

@app.route('/api/relatorio-paralizacoes', methods=['GET'])
@verificar_permissao('dashboard')
def get_relatorio_paralizacoes():
    conn = get_db_connection()
    
    # Get filter parameters
    obra = request.args.get('obra', '')
    veiculo = request.args.get('veiculo', '')
    motorista = request.args.get('motorista', '')
    data_inicio = request.args.get('data_inicio', '')
    data_fim = request.args.get('data_fim', '')
    
    # Build filter conditions
    filtros = []
    params = []
    
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        filtros.append(f'o.nome_obra IN ({placeholders})')
        params.extend(obras_list)
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        filtros.append(f'v.veiculo IN ({placeholders})')
        params.extend(veiculos_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        filtros.append(f'v.motorista IN ({placeholders})')
        params.extend(motoristas_list)
    
    if data_inicio and data_fim:
        filtros.append('DATE(ot.data_hora_inicio) BETWEEN ? AND ?')
        params.extend([data_inicio, data_fim])
    
    where_clause = ' AND '.join(filtros) if filtros else '1=1'
    
    query = f'''
        SELECT ot.*, v.veiculo
        FROM ocorrencias_transportes ot
        LEFT JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
        LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        LEFT JOIN obras o ON vi.id_obra = o.id_obra
        WHERE {where_clause}
        GROUP BY ot.id
        ORDER BY ot.data_hora_inicio DESC
        LIMIT 50
    '''
    paralizacoes = conn.execute(query, params).fetchall()
    
    conn.close()
    return jsonify([dict(p) for p in paralizacoes])

@app.route('/api/relatorio-chuvas', methods=['GET'])
@verificar_permissao('dashboard')
def get_relatorio_chuvas():
    conn = get_db_connection()
    
    # Get filter parameters
    obra = request.args.get('obra', '')
    data_inicio = request.args.get('data_inicio', '')
    data_fim = request.args.get('data_fim', '')
    
    # Build filter conditions
    filtros = []
    params = []
    
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        filtros.append(f'o.nome_obra IN ({placeholders})')
        params.extend(obras_list)
    
    if data_inicio and data_fim:
        filtros.append('DATE(ct.data_ocorrencia) BETWEEN ? AND ?')
        params.extend([data_inicio, data_fim])
    
    where_clause = ' AND '.join(filtros) if filtros else '1=1'
    
    query = f'''
        SELECT ct.*, o.nome_obra
        FROM clima_tempo ct
        LEFT JOIN obras o ON ct.obra_local_id = o.nome_obra
        WHERE {where_clause}
        ORDER BY ct.data_ocorrencia DESC
        LIMIT 50
    '''
    chuvas = conn.execute(query, params).fetchall()
    
    conn.close()
    return jsonify([dict(c) for c in chuvas])

# Add missing dashboard KPIs endpoint with filtering
@app.route('/api/dashboard-kpis', methods=['GET'])
@verificar_permissao('dashboard')
def get_dashboard_kpis():
    conn = get_db_connection()
    
    # Get filter parameters
    obra = request.args.get('obra', '')
    veiculo = request.args.get('veiculo', '')
    motorista = request.args.get('motorista', '')
    data_inicio = request.args.get('data_inicio', '')
    data_fim = request.args.get('data_fim', '')
    
    print(f"DEBUG: Filtros recebidos - obra: {obra}, veiculo: {veiculo}, motorista: {motorista}")
    
    # Build filter conditions
    filtros = []
    params = []
    
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        filtros.append(f'o.nome_obra IN ({placeholders})')
        params.extend(obras_list)
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        filtros.append(f've.veiculo IN ({placeholders})')
        params.extend(veiculos_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        filtros.append(f've.motorista IN ({placeholders})')
        params.extend(motoristas_list)
    
    if data_inicio and data_fim:
        filtros.append('DATE(v.data_hora) BETWEEN ? AND ?')
        params.extend([data_inicio, data_fim])
    
    where_clause = ' AND '.join(filtros) if filtros else '1=1'
    
    # Count active vehicles (filtered)
    if filtros:
        veiculos_query = f'''
            SELECT COUNT(DISTINCT ve.id_veiculo)
            FROM veiculos ve
            JOIN viagens v ON ve.id_veiculo = v.id_veiculo
            LEFT JOIN obras o ON v.id_obra = o.id_obra
            WHERE {where_clause}
        '''
        veiculos_ativos = conn.execute(veiculos_query, params).fetchone()[0]
    else:
        veiculos_ativos = conn.execute('SELECT COUNT(*) FROM veiculos').fetchone()[0]
    
    # Count ongoing occurrences (filtered)
    if filtros:
        ocorrencias_query = f'''
            SELECT COUNT(DISTINCT ot.id)
            FROM ocorrencias_transportes ot
            LEFT JOIN veiculos ve ON ot.veiculo_id = ve.id_veiculo
            LEFT JOIN viagens v ON ve.id_veiculo = v.id_veiculo
            LEFT JOIN obras o ON v.id_obra = o.id_obra
            WHERE ot.status = 'em andamento' AND {where_clause}
        '''
        ocorrencias_andamento = conn.execute(ocorrencias_query, params).fetchone()[0]
    else:
        ocorrencias_andamento = conn.execute(
            "SELECT COUNT(*) FROM ocorrencias_transportes WHERE status = 'em andamento'"
        ).fetchone()[0]
    
    # Count rain days this month (filtered by obra if specified)
    current_month = datetime.now().strftime('%Y-%m')
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        chuvas_query = f'''
            SELECT COUNT(DISTINCT DATE(ct.data_ocorrencia))
            FROM clima_tempo ct
            LEFT JOIN obras o ON ct.obra_local_id = o.nome_obra
            WHERE strftime('%Y-%m', ct.data_ocorrencia) = ? AND o.nome_obra IN ({placeholders})
        '''
        chuvas_mes = conn.execute(chuvas_query, [current_month] + obras_list).fetchone()[0]
    else:
        chuvas_mes = conn.execute(
            "SELECT COUNT(DISTINCT DATE(data_ocorrencia)) FROM clima_tempo WHERE strftime('%Y-%m', data_ocorrencia) = ?",
            (current_month,)
        ).fetchone()[0]
    
    # Total trips (filtered)
    if filtros:
        viagens_query = f'''
            SELECT SUM(v.quantidade_viagens)
            FROM viagens v
            JOIN veiculos ve ON v.id_veiculo = ve.id_veiculo
            LEFT JOIN obras o ON v.id_obra = o.id_obra
            WHERE {where_clause}
        '''
        total_viagens = conn.execute(viagens_query, params).fetchone()[0] or 0
    else:
        total_viagens = conn.execute('SELECT SUM(quantidade_viagens) FROM viagens').fetchone()[0] or 0
    
    # Use exact same query as /api/relatorio-paralizacoes to get vehicles
    filtros_paral = []
    params_paral = []
    
    if obra:
        obras_list = obra.split(',')
        placeholders = ','.join(['?' for _ in obras_list])
        filtros_paral.append(f'o.nome_obra IN ({placeholders})')
        params_paral.extend(obras_list)
    
    if veiculo:
        veiculos_list = veiculo.split(',')
        placeholders = ','.join(['?' for _ in veiculos_list])
        filtros_paral.append(f'v.veiculo IN ({placeholders})')
        params_paral.extend(veiculos_list)
    
    if motorista:
        motoristas_list = motorista.split(',')
        placeholders = ','.join(['?' for _ in motoristas_list])
        filtros_paral.append(f'v.motorista IN ({placeholders})')
        params_paral.extend(motoristas_list)
    
    if data_inicio and data_fim:
        filtros_paral.append('DATE(ot.data_hora_inicio) BETWEEN ? AND ?')
        params_paral.extend([data_inicio, data_fim])
    
    where_clause_paral = ' AND '.join(filtros_paral) if filtros_paral else '1=1'
    
    # Exact same query as relatorio-paralizacoes
    query_paral = f'''
        SELECT ot.*, v.veiculo
        FROM ocorrencias_transportes ot
        LEFT JOIN veiculos v ON ot.veiculo_id = v.id_veiculo
        LEFT JOIN viagens vi ON v.id_veiculo = vi.id_veiculo
        LEFT JOIN obras o ON vi.id_obra = o.id_obra
        WHERE {where_clause_paral}
        GROUP BY ot.id
        ORDER BY ot.data_hora_inicio DESC
        LIMIT 50
    '''
    
    paralizacoes_data = conn.execute(query_paral, params_paral).fetchall()
    
    print(f"DEBUG: Paralizações encontradas: {len(paralizacoes_data)}")
    
    if paralizacoes_data:
        # Conjunto V = IDs únicos de veículos na tabela Detalhamento de Paralizações
        veiculos_unicos = {}
        
        for p in paralizacoes_data:
            veiculo_nome = p['veiculo']
            if veiculo_nome:
                # Calcular TOTAL HORAS (mesma lógica do frontend)
                if p['data_hora_inicio'] and p['data_hora_retorno']:
                    inicio = datetime.fromisoformat(p['data_hora_inicio'].replace('Z', '+00:00'))
                    retorno = datetime.fromisoformat(p['data_hora_retorno'].replace('Z', '+00:00'))
                    horas = abs((retorno - inicio).total_seconds()) / 3600
                elif p['status'] == 'em andamento':
                    horas = 8.0  # Em andamento
                else:
                    horas = 0.0
                
                # Passo 1: Agregar por veículo (deduplicar)
                if veiculo_nome not in veiculos_unicos:
                    veiculos_unicos[veiculo_nome] = 0.0
                veiculos_unicos[veiculo_nome] += horas
        
        print(f"DEBUG: Conjunto V (veículos únicos): {veiculos_unicos}")
        
        if veiculos_unicos:
            # |V| = quantidade de veículos únicos
            V_size = len(veiculos_unicos)
            total_horas_agregadas = list(veiculos_unicos.values())
            
            # Passo 2: Tempo_Parado_Geral = (Σ Total_Horas_Agregadas(v) para v ∈ V) ÷ |V|
            tempo_parado_medio = sum(total_horas_agregadas) / V_size
            
            # Disponibilidade_Geral = (Σ Disponibilidade(v) para v ∈ V) ÷ |V|
            disponibilidades = [max(0, (24 - h) / 24 * 100) for h in total_horas_agregadas]
            disponibilidade_media = sum(disponibilidades) / V_size
            
            # Eficiencia_Geral = (Σ Eficiencia(v) para v ∈ V) ÷ |V|
            eficiencias = [min(100, max(0, (24 - h) / 24 * 100)) for h in total_horas_agregadas]
            eficiencia_media = sum(eficiencias) / V_size
            
            print(f"DEBUG: |V|={V_size}, Tempo_Parado_Geral={tempo_parado_medio:.1f}h")
        else:
            tempo_parado_medio = 0.0
            disponibilidade_media = 100.0
            eficiencia_media = 100.0
    else:
        tempo_parado_medio = 0.0
        disponibilidade_media = 100.0
        eficiencia_media = 100.0
    
    conn.close()
    
    result = {
        'veiculos_ativos': veiculos_ativos,
        'ocorrencias_andamento': ocorrencias_andamento,
        'chuvas_mes': chuvas_mes,
        'total_viagens': total_viagens,
        'disponibilidade_media': round(disponibilidade_media, 1),
        'tempo_parado_medio': round(tempo_parado_medio, 1),
        'eficiencia_media': round(eficiencia_media, 1)
    }
    print(f"DEBUG: Resultado final: {result}")
    return jsonify(result)

if __name__ == '__main__':
    init_db()
    print("APONTADOR - Sistema de Viagens")
    print("Acesse: http://localhost:5000")
    print("Banco de dados: SQLite (apontador.db)")
    app.run(debug=True, host='0.0.0.0', port=5000)
