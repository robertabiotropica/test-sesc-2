# Roteiro

A programação do seu evento, ao vivo no celular. Cada evento ganha um endereço próprio, como `seusite.vercel.app/e/sesc-sorocaba-2026-11`, com filtros por dia e trilha, favoritos, busca e o destaque do que está acontecendo agora.

O site é estático: não tem servidor nem banco de dados. A programação vem de um arquivo do evento e, se você quiser, de uma planilha do Google Sheets que o organizador edita e o site lê sozinho.

## Estrutura

```
index.html                 página inicial, lista os eventos
evento.html                página de qualquer evento (/e/<código>)
assets/app.js              motor da página do evento
assets/style.css           visual
eventos/index.json         lista de eventos da página inicial e nome da plataforma
eventos/<código>/evento.json   dados do evento
eventos/<código>/sessoes.csv   programação em planilha (para importar no Google Sheets)
vercel.json / _redirects   fazem /e/<código> abrir a página do evento (Vercel / Netlify)
```

## Colocar no ar (GitHub + Vercel, grátis)

1. **Crie uma conta no GitHub** em github.com.
2. **Crie um repositório**: botão "New", dê um nome (por exemplo `roteiro`), deixe como Public e clique em "Create repository".
3. **Envie os arquivos**: na página do repositório, clique em "uploading an existing file" e arraste **o conteúdo** desta pasta (os arquivos e pastas de dentro, não a pasta em si). Clique em "Commit changes".
4. **Crie uma conta na Vercel** em vercel.com, entrando com o GitHub.
5. Clique em **Add New → Project**, escolha o repositório e clique em **Deploy**. Não precisa mudar nenhuma configuração.
6. Em um minuto o site está no ar em `nome-do-projeto.vercel.app`. O evento fica em `nome-do-projeto.vercel.app/e/sesc-sorocaba-2026-11`.

Para trocar o endereço, vá em Settings → Domains no projeto da Vercel. Dá para usar outro nome `.vercel.app` livre, ou um domínio próprio (um `.com.br` custa cerca de R$ 40 por ano no registro.br).

Toda vez que você alterar um arquivo no GitHub, a Vercel publica a nova versão sozinha.

**Alternativa sem GitHub:** em app.netlify.com/drop, arraste esta pasta e o site entra no ar na hora. Para atualizar os arquivos, é preciso arrastar de novo, mas as mudanças feitas na planilha aparecem sem isso.

## Ligar a planilha do Google Sheets

Assim a programação muda sem mexer em nenhum arquivo.

1. No Google Sheets, crie uma planilha e use **Arquivo → Importar → Upload** com o `sessoes.csv` do evento. Escolha "Substituir planilha".
2. Vá em **Arquivo → Compartilhar → Publicar na Web**. Escolha a aba da planilha, o formato **Valores separados por vírgula (.csv)** e clique em Publicar.
3. Copie o link gerado (termina em `output=csv`).
4. No `evento.json` do evento, cole o link no campo `"planilha_csv"`.

Pronto: o site lê a planilha a cada minuto. O Google pode levar alguns minutos para refletir uma edição no link publicado. Se a planilha ficar fora do ar, o site usa as sessões guardadas no próprio `evento.json`.

### Colunas da planilha

| Coluna | Obrigatória | Exemplo |
|---|---|---|
| titulo | sim | Floresta de Odé |
| data | sim | 2026-11-14 ou 14/11/2026 |
| inicio | sim | 20:00 ou 20h |
| fim | | 21:00 |
| local | | Teatro |
| trilhas | | Iorubrá; Shows e espetáculos |
| tipo | | Espetáculo |
| com | | Cia. Treme Terra |
| descricao | | Texto curto |
| entrada | | Grátis, ou os preços |
| classificacao | | Livre, 12+, 4 a 12 anos |
| acessibilidade | | Libras |
| como_participar | | Retirada de ingressos 1 hora antes |
| atividade | | Código que liga várias datas da mesma atividade |
| link_inscricao | | Link do botão "Inscreva-se" desta sessão |

### Botão "Inscreva-se"

No `evento.json`, o bloco `"inscricao"` define o texto do botão e o link padrão. O botão aparece nas sessões cujo "como participar" fala em inscrição. Para usar outro link numa sessão, preencha a coluna `link_inscricao`. Sessões com retirada de senha mostram "Senha no local" em vez do botão.

### Mapa

O bloco `"mapa"` do `evento.json` desenha a aba Mapa. Cada item de `"areas"` é uma sala: posição (`x`, `y`), tamanho (`w`, `h`), nome e os `locais` da planilha que pertencem a ela. As salas acendem quando há atividade agora ou no dia. Sem o bloco `"mapa"`, a aba não aparece.

### Formulário de inscrição

Quando `inscricao.endpoint` está preenchido no `evento.json`, o botão "Inscreva-se" abre um formulário no próprio site (nome, e-mail, telefone, faixa etária, acessibilidade e aceite da LGPD). Cada envio vira uma linha numa planilha do Google. Com o campo vazio, o botão leva ao link de `inscricao.link`.

Para criar a planilha que recebe as inscrições:

1. Crie uma planilha nova no Google Sheets.
2. Vá em **Extensões → Apps Script**, apague o conteúdo e cole o arquivo `integracoes/inscricoes.gs`. Salve.
3. Clique em **Implantar → Nova implantação**, escolha o tipo **App da Web**, com "Executar como: Eu" e "Quem pode acessar: Qualquer pessoa". Implante e autorize.
4. Copie o **URL do app da Web** (termina em `/exec`) e cole em `inscricao.endpoint`.

As inscrições aparecem na aba "Inscrições" da planilha. Um mesmo e-mail não é registrado duas vezes na mesma atividade.

## Criar um novo evento

1. Copie a pasta `eventos/sesc-sorocaba-2026-11` com um novo código, por exemplo `eventos/festival-2027`. Use só letras minúsculas, números e hífens.
2. Edite o `evento.json`: nome, local, período, primeiro e último dia (`inicio` e `fim`), dias fechados, trilhas, "Em cartaz" e informações.
3. Ligue a planilha do novo evento, ou preencha `sessoes` direto no arquivo.
4. Acrescente o evento em `eventos/index.json` para ele aparecer na página inicial.

O evento fica em `/e/festival-2027`.

## Testar no computador

Com Python instalado, abra o terminal nesta pasta e rode `python3 -m http.server 8000`. Depois acesse `http://localhost:8000/evento.html?e=sesc-sorocaba-2026-11`. No computador o endereço `/e/...` não funciona; ele só funciona depois de publicado.
