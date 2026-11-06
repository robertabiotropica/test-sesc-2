/**
 * Roteiro · recebe as inscrições do site e grava na planilha.
 *
 * Como usar:
 * 1. Crie uma planilha no Google Sheets.
 * 2. Menu Extensões → Apps Script. Apague o conteúdo e cole este arquivo inteiro. Salve.
 * 3. Implantar → Nova implantação → tipo "App da Web".
 *    Executar como: Eu. Quem pode acessar: Qualquer pessoa. Clique em Implantar e autorize.
 * 4. Copie o "URL do app da Web" (termina em /exec) e coloque no campo
 *    inscricao.endpoint do evento.json.
 */

const ABA = "Inscrições";
const CABECALHO = [
  "Recebida em", "Evento", "Atividade", "Código da atividade", "Datas", "Local",
  "Nome", "E-mail", "Telefone", "Faixa etária", "Acessibilidade", "Aceite de dados", "Origem"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // armadilha simples contra robôs: campo invisível que pessoas não preenchem
    if (d.site) return resposta({ ok: true });

    const nome = limpa(d.nome, 120), email = limpa(d.email, 160).toLowerCase(), telefone = limpa(d.telefone, 40);
    if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || telefone.replace(/\D/g, "").length < 8 || d.aceite !== true) {
      return resposta({ ok: false, erro: "dados_invalidos" });
    }

    const aba = pegaAba();
    const atividade = limpa(d.atividade_id, 80);
    const linhas = aba.getLastRow() > 1 ? aba.getRange(2, 1, aba.getLastRow() - 1, CABECALHO.length).getValues() : [];
    const repetida = linhas.some(l => String(l[3]) === atividade && String(l[7]).toLowerCase() === email);
    if (repetida) return resposta({ ok: true, repetida: true });

    aba.appendRow([
      new Date(), limpa(d.evento, 120), limpa(d.atividade, 200), atividade, limpa(d.datas, 300), limpa(d.local, 120),
      nome, email, telefone, limpa(d.faixa_etaria, 40), limpa(d.acessibilidade, 300), "Sim", limpa(d.origem, 200)
    ]);
    return resposta({ ok: true });
  } catch (err) {
    return resposta({ ok: false, erro: "falha_interna" });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function doGet() {
  return resposta({ ok: true, servico: "inscricoes" });
}

function pegaAba() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(ABA);
  if (!aba) aba = planilha.insertSheet(ABA);
  if (aba.getLastRow() === 0) {
    aba.appendRow(CABECALHO);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, CABECALHO.length).setFontWeight("bold");
  }
  return aba;
}

// evita que um texto comece com =, +, - ou @ e vire fórmula na planilha
function limpa(v, max) {
  let s = String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
