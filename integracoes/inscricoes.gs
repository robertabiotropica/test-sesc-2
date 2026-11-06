/**
 * Roteiro · script da planilha do evento.
 *
 * Faz três coisas:
 * 1. Entrega a aba "Programação" para o site (o site lê a programação daqui).
 * 2. Recebe as inscrições do formulário e grava na aba "Inscrições",
 *    respeitando o limite da coluna "vagas" da Programação.
 * 3. Envia um e-mail de confirmação para quem se inscreve e, se quiser,
 *    um aviso para a equipe.
 *
 * Como atualizar uma implantação que já existe (o link continua o mesmo):
 *   Implantar → Gerenciar implantações → lápis (editar) → Versão: "Nova versão" → Implantar.
 *   Na primeira vez com esta versão, o Google pede autorização para enviar e-mails.
 *
 * Como criar do zero:
 *   Extensões → Apps Script → cole este arquivo → Salvar →
 *   Implantar → Nova implantação → App da Web → Executar como: Eu →
 *   Quem pode acessar: Qualquer pessoa → Implantar.
 */

// ---------- configurações ----------
const NOME_REMETENTE = "Sesc Sorocaba";   // aparece como remetente do e-mail de confirmação
const ENVIAR_CONFIRMACAO = true;          // false para não enviar e-mail a quem se inscreve
const EMAIL_EQUIPE = "";                  // e-mail que recebe aviso a cada inscrição (vazio = sem aviso)
const TEXTO_RODAPE_EMAIL = "Em caso de dúvidas, procure a Central de Atendimento do Sesc Sorocaba: (15) 3332-9933.";

// ---------- abas ----------
const ABA_INSCRICOES = "Inscrições";
const ABA_PROGRAMACAO = "Programação";
const CABECALHO = [
  "Recebida em", "Evento", "Atividade", "Código da atividade", "Datas", "Local",
  "Nome", "E-mail", "Telefone", "Faixa etária", "Acessibilidade", "Aceite de dados", "Origem"
];

// ---------- leitura: programação e vagas ----------
function doGet(e) {
  const acao = e && e.parameter && e.parameter.acao;
  if (acao === "programacao") {
    return resposta({ ok: true, sessoes: lerProgramacao(), inscritos: contarInscritos(), gerado_em: new Date().toISOString() });
  }
  if (acao === "vagas") return resposta({ ok: true, inscritos: contarInscritos() });
  return resposta({ ok: true, servico: "roteiro" });
}

function lerProgramacao() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PROGRAMACAO);
  if (!aba || aba.getLastRow() < 2) return [];
  const valores = aba.getRange(1, 1, aba.getLastRow(), aba.getLastColumn()).getDisplayValues();
  const cab = valores[0].map(normaliza);
  return valores.slice(1)
    .filter(l => l.some(v => String(v).trim() !== ""))
    .map(l => { const o = {}; cab.forEach((c, i) => { if (c) o[c] = String(l[i]).trim(); }); return o; });
}

function contarInscritos() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_INSCRICOES);
  const total = {};
  if (!aba || aba.getLastRow() < 2) return total;
  aba.getRange(2, 4, aba.getLastRow() - 1, 1).getValues().forEach(l => {
    const id = String(l[0]); if (id) total[id] = (total[id] || 0) + 1;
  });
  return total;
}

function vagasDa(atividadeId) {
  const codigo = String(atividadeId).split("/").pop();
  let vagas = 0;
  lerProgramacao().forEach(s => {
    const cod = s.atividade || "";
    const n = parseInt(s.vagas, 10);
    if (cod === codigo && n > 0) vagas = Math.max(vagas, n);
  });
  return vagas;
}

// ---------- escrita: inscrições ----------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (d.site) return resposta({ ok: true });   // armadilha contra robôs

    const nome = limpa(d.nome, 120), email = limpa(d.email, 160).toLowerCase(), telefone = limpa(d.telefone, 40);
    if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || telefone.replace(/\D/g, "").length < 8 || d.aceite !== true) {
      return resposta({ ok: false, erro: "dados_invalidos" });
    }

    const aba = pegaAba();
    const atividade = limpa(d.atividade_id, 80);
    const linhas = aba.getLastRow() > 1 ? aba.getRange(2, 1, aba.getLastRow() - 1, CABECALHO.length).getValues() : [];
    if (linhas.some(l => String(l[3]) === atividade && String(l[7]).toLowerCase() === email)) {
      return resposta({ ok: true, repetida: true });
    }
    const vagas = vagasDa(atividade);
    const ocupadas = linhas.filter(l => String(l[3]) === atividade).length;
    if (vagas > 0 && ocupadas >= vagas) return resposta({ ok: false, erro: "esgotado" });

    aba.appendRow([
      new Date(), limpa(d.evento, 120), limpa(d.atividade, 200), atividade, limpa(d.datas_texto || d.datas, 300), limpa(d.local, 120),
      nome, email, telefone, limpa(d.faixa_etaria, 40), limpa(d.acessibilidade, 300), "Sim", limpa(d.origem, 200)
    ]);
    lock.releaseLock();

    enviarEmails(d, nome, email, telefone);
    const restantes = vagas > 0 ? vagas - ocupadas - 1 : null;
    return resposta({ ok: true, restantes: restantes });
  } catch (err) {
    return resposta({ ok: false, erro: "falha_interna" });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function enviarEmails(d, nome, email, telefone) {
  const atividade = String(d.atividade || ""), datas = String(d.datas_texto || d.datas || ""), local = String(d.local || "");
  if (ENVIAR_CONFIRMACAO) {
    try {
      MailApp.sendEmail({
        to: email,
        name: NOME_REMETENTE,
        subject: "Inscrição recebida: " + atividade,
        htmlBody:
          "<p>Olá, " + html(nome) + "!</p>" +
          "<p>Recebemos sua inscrição em <b>" + html(atividade) + "</b>.</p>" +
          "<p><b>Quando:</b> " + html(datas).replace(/; /g, "<br>") + "<br><b>Onde:</b> " + html(local) + "</p>" +
          (d.como_participar ? "<p>" + html(d.como_participar) + "</p>" : "") +
          "<p>" + html(TEXTO_RODAPE_EMAIL) + "</p>" +
          (d.link ? "<p><a href=\"" + html(d.link) + "\">Ver a programação</a></p>" : "")
      });
    } catch (e) {}
  }
  if (EMAIL_EQUIPE) {
    try {
      MailApp.sendEmail({
        to: EMAIL_EQUIPE,
        name: "Inscrições do site",
        subject: "Nova inscrição: " + atividade,
        body: nome + " (" + email + ", " + telefone + ")\n" + atividade + "\n" + datas + "\n" + local +
              (d.acessibilidade ? "\nAcessibilidade: " + d.acessibilidade : "")
      });
    } catch (e) {}
  }
}

// ---------- utilidades ----------
function pegaAba() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName(ABA_INSCRICOES);
  if (!aba) aba = planilha.insertSheet(ABA_INSCRICOES);
  if (aba.getLastRow() === 0) {
    aba.appendRow(CABECALHO);
    aba.setFrozenRows(1);
    aba.getRange(1, 1, 1, CABECALHO.length).setFontWeight("bold");
  }
  return aba;
}

function normaliza(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// evita que um texto comece com =, +, - ou @ e vire fórmula na planilha
function limpa(v, max) {
  let s = String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function html(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
