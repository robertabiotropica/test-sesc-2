# Histórico de alterações

Registro do que mudou no site, da mais recente para a mais antiga.

## 06/11/2026 · Planilha, app instalável, agenda e vagas

**Programação pela planilha**
- O site passa a ler a programação da aba **Programação** da planilha do evento, a mesma que recebe as inscrições. Mudanças na planilha aparecem no site em até um minuto.
- Se a aba não existir ou estiver vazia, o site continua usando a programação do arquivo do evento.

**App instalável e sem internet**
- Ícones do app (Android e iPhone) e manifesto próprio do evento: instalado, abre direto na programação, em tela cheia.
- Painel "Tenha a programação no celular" na aba Info, com o botão Instalar (Android) ou as instruções para iPhone.
- O site guarda uma cópia de si e da última programação no aparelho e abre mesmo sem internet. Sem conexão, a linha de status avisa que está mostrando a última versão salva.

**Agenda e compartilhamento**
- Na janela de cada atividade: **Google Agenda**, **Outro calendário (.ics)** com lembrete 1 hora antes e todas as datas da atividade, e **Compartilhar** (menu do celular ou link copiado).
- Link direto para cada atividade: quem abre o link compartilhado cai na atividade, já aberta.

**Vagas e e-mails**
- Nova coluna `vagas` na planilha. Com vagas definidas, o site mostra "Restam N vagas" quando sobram 5 ou menos e "Vagas esgotadas" quando acabam; o script recusa inscrições além do limite.
- E-mail automático de confirmação para quem se inscreve, com atividade, datas, local e como participar.
- Opção de aviso por e-mail para a equipe a cada nova inscrição (configurável no topo do script).

**Ajustes**
- Favoritos salvos antes desta versão continuam marcados.

## 06/11/2026 · Contagem por dia
- Os números ao lado de cada trilha passam a contar só as atividades do dia selecionado (respeitando busca e local). Trilhas sem atividades no dia ficam esmaecidas.

## 06/11/2026 · Cara de aplicativo
- Barra de navegação inferior com ícones no celular: Agenda, Mapa, Favoritos, Em cartaz e Info. No computador, as abas continuam no topo.
- Favoritos ganhou tela própria, com contador no ícone.
- O botão Voltar do celular fecha a janela de detalhe em vez de sair do site; também dá para fechar arrastando para baixo.
- O site abre no dia de hoje. O botão flutuante **Agora** aparece quando você muda de dia, filtra ou rola a lista, e volta para o que está acontecendo.
- Selo "Agora" com texto escuro no tema escuro, para melhor leitura.
- Tamanhos de letra acompanham a configuração de fonte do celular.
- "Entrada gratuita" passa a aparecer como Grátis.

## 06/11/2026 · Identidade e conteúdo
- Rodapé: "Feito por Roberta Carvalho".
- Removido o aviso de protótipo do topo.
- Nova paleta: base marrom e destaque verde, nos temas claro e escuro; ícone e cor da barra do navegador em verde.

## 06/11/2026 · Inscrições
- Formulário de inscrição no próprio site (nome, e-mail, telefone, faixa etária, acessibilidade e aceite da LGPD), gravando cada inscrição numa planilha do Google. O mesmo e-mail não é registrado duas vezes na mesma atividade.
- Botão "Inscreva-se" nas atividades com inscrição online; atividades com retirada de senha mostram "Senha no local".

## 06/11/2026 · Mapa
- Aba Mapa com o desenho esquemático da unidade. Salas acendem quando há atividade agora ou no dia; tocar mostra o que está acontecendo e o que vem a seguir.

## 06/11/2026 · Primeira versão
- Página inicial com a lista de eventos e página do evento em `/e/<código>`.
- Programação por dia e por trilha, busca, favoritos, destaque de "Agora" e "Em N min", abas Em cartaz, Locais e Informações.
