import pandas as pd

# Dados do fluxo padronizado
dados_fluxo = [
    {
        "ID": "start",
        "Título do Passo": "Passo 1: Baixo",
        "Descrição": "Nível de criticidade identificado como baixo.",
        "Tipo": "direto",
        "Próximo Direto": "aguarde",
        "Email Para": "",
        "Email CC": "",
        "Assunto Email": "",
        "Prioridade": "Baixa",
        "Responsável": "Equipe de Monitoramento"
    },
    {
        "ID": "aguarde",
        "Título do Passo": "Passo 2: Aguarde",
        "Descrição": "Aguarde 30 minutos a tentativa automática de correção do problema.",
        "Tipo": "direto",
        "Próximo Direto": "resolvido1",
        "Email Para": "",
        "Email CC": "",
        "Assunto Email": "",
        "Prioridade": "Média",
        "Responsável": "Sistema Automático"
    },
    {
        "ID": "resolvido1",
        "Título do Passo": "Passo 3: Foi resolvido?",
        "Descrição": "Verifique se o problema foi resolvido após a tentativa automática.",
        "Tipo": "decisao",
        "Próximo Sim": "relate",
        "Próximo Não": "reporte",
        "Email Para": "",
        "Email CC": "",
        "Assunto Email": "",
        "Prioridade": "Alta",
        "Responsável": "Operador"
    },
    {
        "ID": "relate",
        "Título do Passo": "Passo 4: Relate",
        "Descrição": "Formalize via e-mail descrevendo o ocorrido à Gestão de Monitoramento de Barragens.",
        "Tipo": "direto",
        "Próximo Direto": "resolvido2",
        "Email Para": "monitoramento@empresa.com",
        "Email CC": "supervisor@empresa.com",
        "Assunto Email": "Relato de Ocorrência - Sistema de Monitoramento",
        "Prioridade": "Alta",
        "Responsável": "Técnico",
        "Formulário": "Formulário-0045"
    },
    {
        "ID": "resolvido2",
        "Título do Passo": "Passo 5: Foi resolvido após o relato?",
        "Descrição": "Verifique novamente após o relato se o problema foi resolvido.",
        "Tipo": "decisao",
        "Próximo Sim": "final",
        "Próximo Não": "reporte",
        "Email Para": "",
        "Email CC": "",
        "Assunto Email": "",
        "Prioridade": "Alta",
        "Responsável": "Coordenador"
    },
    {
        "ID": "reporte",
        "Título do Passo": "Passo 6: Reporte",
        "Descrição": "Registre o problema para escalonamento via e-mail à Gestão do CMG e à equipe de Manutenção.",
        "Tipo": "direto",
        "Próximo Direto": "resolvido3",
        "Email Para": "cmg@empresa.com",
        "Email CC": "manutencao@empresa.com,engenharia@empresa.com",
        "Assunto Email": "Reporte de Problema - Requer Ação Imediata",
        "Prioridade": "Crítica",
        "Responsável": "Gerente",
        "Checklist": "Verificar itens 5,7,12"
    },
    {
        "ID": "resolvido3",
        "Título do Passo": "Passo 7: Foi resolvido após o reporte?",
        "Descrição": "Verifique se após reportar, o problema foi resolvido.",
        "Tipo": "decisao",
        "Próximo Sim": "final",
        "Próximo Não": "reporte",
        "Email Para": "",
        "Email CC": "",
        "Assunto Email": "",
        "Prioridade": "Crítica",
        "Responsável": "Diretoria"
    },
    {
        "ID": "final",
        "Título do Passo": "Passo Final: Resolvido",
        "Descrição": "Ótimo! O processo foi concluído com sucesso.",
        "Tipo": "final",
        "Próximo Direto": "",
        "Email Para": "",
        "Email CC": "",
        "Assunto Email": "",
        "Prioridade": "",
        "Responsável": "",
        "Ações Concluídas": "Sim"
    }
]

# Criar DataFrame
df_fluxo = pd.DataFrame(dados_fluxo)

# Ordenar colunas (obrigatórias primeiro, opcionais depois)
colunas_ordenadas = [
    'ID', 'Título do Passo', 'Descrição', 'Tipo',
    'Próximo Direto', 'Próximo Sim', 'Próximo Não',
    'Email Para', 'Email CC', 'Assunto Email'
] + [col for col in df_fluxo.columns if col not in [
    'ID', 'Título do Passo', 'Descrição', 'Tipo',
    'Próximo Direto', 'Próximo Sim', 'Próximo Não',
    'Email Para', 'Email CC', 'Assunto Email'
]]

df_fluxo = df_fluxo[colunas_ordenadas]

# Gerar arquivo Excel com múltiplas abas
with pd.ExcelWriter('fluxo_decisao_completo.xlsx', engine='xlsxwriter') as writer:
    # Planilha principal
    df_fluxo.to_excel(writer, sheet_name='Fluxo', index=False)
    
    # Planilha de documentação
    docs = pd.DataFrame({
        'Coluna': [
            'ID', 'Título do Passo', 'Descrição', 'Tipo', 
            'Próximo Direto', 'Próximo Sim', 'Próximo Não',
            'Email Para', 'Email CC', 'Assunto Email'
        ],
        'Descrição': [
            'Identificador único do passo (não usar espaços ou caracteres especiais)',
            'Título que aparecerá no sistema',
            'Descrição detalhada do passo',
            'Tipo de passo (direto, decisao ou final)',
            'Próximo passo para fluxos diretos',
            'Próximo passo para resposta "Sim" em decisões',
            'Próximo passo para resposta "Não" em decisões',
            'E-mail principal para envio (se aplicável)',
            'E-mails em cópia (separar por vírgula)',
            'Assunto do e-mail (se aplicável)'
        ],
        'Obrigatório': [
            'Sim', 'Sim', 'Sim', 'Sim',
            'Para tipo "direto"', 'Para tipo "decisao"', 'Para tipo "decisao"',
            'Não', 'Não', 'Não'
        ]
    })
    
    docs.to_excel(writer, sheet_name='Documentação', index=False)
    
    # Ajustar largura das colunas automaticamente
    for sheet in writer.sheets:
        worksheet = writer.sheets[sheet]
        for idx, col in enumerate(writer.sheets[sheet]._worksheet.columns):
            max_length = max((
                len(str(col.value)) for col in col[1:] if col.value
            ), default=10)
            worksheet.set_column(idx, idx, max_length + 2)

print("Planilha gerada com sucesso: 'fluxo_decisao_completo.xlsx'")
print("Contém:")
print("- Aba 'Fluxo' com o processo completo")
print("- Aba 'Documentação' com instruções de preenchimento")