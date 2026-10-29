# Migração do WordPress — guia do dia da mudança

> Para fazer tudo com o Claude no Chrome: [PROMPT_CHROME_PRODUCAO.md](PROMPT_CHROME_PRODUCAO.md) (mesmos passos, com pausas para as passwords e para a decisão de mudar o DNS).

Este guia passa o Portal do Trespasse do WordPress para o site novo sem perder anúncios, contas nem endereços.
A importação foi ensaiada com o dump de 27/10/2026 numa base de dados vazia (ver "Ensaio" no fim).

## O que passa e o que fica

| Do WordPress | No site novo |
|---|---|
| 63 contas verificadas (62 depois de juntar uma conta duplicada) e os autores de anúncios | Contas com a **mesma password**. É convertida para o formato novo no primeiro login. |
| 860 contas nunca verificadas (registos automáticos) | **Não passam** (decisão de 27/10/2026) |
| 17 anúncios publicados + 5 expirados | Mesmo endereço, dono, categoria, localização, preço, campos, características, horário, visitas e cliques no telefone |
| 89 fotografias dos anúncios, pela ordem original | WebP em 3 tamanhos (400, 800, 1600 px) |
| 336 artigos publicados + 2 rascunhos | Mesmo endereço, data, etiquetas, imagem de destaque, título e descrição do Yoast |
| 58 mensagens do formulário de contacto | Back-office → Mensagens (sem o IP) |
| 415 endereços públicos | Todos respondem (386 diretamente, 29 com redirect 301) |
| Páginas (Elementor) | Reescritas à mão no site novo |
| Google Tag Manager `GTM-T6S7GRGN` (estatísticas) | Mesmo contentor, só em produção e só depois de o visitante aceitar o aviso de cookies |
| 436 comentários (todos spam), sessões, Wordfence, Yoast indexables | Não passam |

Os favoritos não existem no dump (nenhum utilizador tinha favoritos guardados).

## Antes do dia

1. O site de testes (`dev.portaldotrespasse.pt`, ramo `dev`) está a funcionar com uma importação recente e foi revisto, e o ramo `main` tem a mesma versão.
2. A produção já existe, ainda sem dados e sem tráfego: no Cloud Shell, `./deploy/gcp-setup.sh ID-DO-PROJETO production`
   (cria a base `portal_producao`, o bucket, o serviço, a tarefa diária e o deploy automático do ramo `main`; mostra os registos DNS, que **só** se mudam no dia).
3. Escolher um dia e uma hora calmos (ex.: domingo de manhã). A mudança leva cerca de 1 hora.
4. Na Cloudflare, baixar o TTL do registo de `portaldotrespasse.pt` para 5 minutos, pelo menos um dia antes.
5. Decidir se vai enviar o email "O Portal do Trespasse tem um site novo" (passo 8). É opcional.
6. Ter à mão: acesso ao painel do WordPress, ao phpMyAdmin, ao Google Cloud (Cloud Shell) e à Cloudflare.

## No dia

### 1. Congelar o WordPress
Para não se perderem anúncios ou contas criados durante a mudança:
- WordPress → Elementor → Ferramentas → **Modo de manutenção** → "Modo de manutenção" → Guardar.
  Os visitantes veem a página de manutenção; quem tem sessão de administrador continua a ver o site.

### 2. Exportar
- phpMyAdmin → base de dados → **Exportar** → Rápido → SQL. Guardar o `.sql` (ou `.sql.zip`).
- `wp-content/uploads` em ZIP (pelo gestor de ficheiros do alojamento), como da primeira vez.
- **Nunca** pôr estes ficheiros no Git: têm dados pessoais.

### 3. Importar para a produção
No Cloud Shell, carregar o dump e os uploads para uma pasta **fora** do repositório (ex.: `~/wp/`) e:

```bash
cd portal-do-trespasse && git pull
./deploy/gcp-import.sh ID-DO-PROJETO production ~/wp/dump.sql ~/wp/uploads-pasta
```

- Aplica as migrações e importa: contas, anúncios, fotografias (diretamente para o Cloud Storage), artigos e mensagens.
- Demora poucos minutos e pode ser repetida sem duplicar nada.
- No fim corre o `wp-verify`, que compara o dump com a base nova, anúncio a anúncio:
  - contas e passwords;
  - dono, categoria, localização, preço, campos e fotografias de cada anúncio;
  - artigos, imagens e mensagens.
- Tem de terminar em **"migração confirmada"**. Os avisos (preços estranhos, anúncios quase a expirar) são para rever à mão e não impedem a mudança.

> Não correr `scripts/e2e-fixtures.ts` em produção (recusa-se a correr com `SITE_ENV=production`).

### 4. Ligar o domínio ao site novo
Na Cloudflare, substituir os registos de `portaldotrespasse.pt` e `www` pelos que o `gcp-setup.sh production` mostrou.
- Nuvem **cinzenta** até o certificado ser emitido (15 min a 1 h).
- O `www` redireciona para o endereço sem `www`.
- A tarefa diária e os emails a sério (SMTP `geral@portaldotrespasse.pt`) já ficaram configurados.

### 5. Apagar os ficheiros do WordPress do Cloud Shell
```bash
rm -rf ~/wp
```

### 6. Confirmar
```bash
node e2e/url-coverage.mjs https://portaldotrespasse.pt    # 415 URLs: 0 falham
```
E à mão:
- [ ] Entrar com a sua conta antiga (a password do WordPress).
- [ ] Back-office abre; o painel mostra os números certos.
- [ ] Publicar um anúncio de teste, aprová-lo, ver o email chegar e apagá-lo.
- [ ] Formulário de contacto envia e o email chega.
- [ ] Um anúncio e um artigo antigos abrem com fotografias.

### 7. Motores de busca
- Google Search Console: enviar `https://portaldotrespasse.pt/sitemap.xml`.
- Ver a cobertura nos dias seguintes. Os endereços antigos respondem com 200 ou 301, por isso não deve haver quedas.

### 8. (Opcional) Avisar os utilizadores
```bash
./deploy/gcp-run.sh ID-DO-PROJETO production npx tsx scripts/send-migration-notice.ts            # só conta
EMAIL_DRIVER=smtp ./deploy/gcp-run.sh ID-DO-PROJETO production npx tsx scripts/send-migration-notice.ts --enviar
```
O texto edita-se em Back-office → Emails → "Mudança de site".

## Se algo correr mal

- **Voltar atrás:** na Cloudflare, repor os registos antigos e desligar o modo de manutenção do WordPress. O WordPress não foi alterado.
- **Anúncios ou contas criados no site novo entretanto:** ficam na base nova e podem ser recuperados de lá.
- **A importação falha a meio:** corrigir e voltar a correr. É idempotente e atualiza pelo ID do WordPress.

## Depois da mudança

- **Durante 30 dias:** manter o alojamento do WordPress parado mas intacto, com o modo de manutenção ligado, como plano B.
- **Ao fim de 30 dias:** apagar os dumps `.sql` e os ZIPs de `uploads` de todos os computadores e do chat (RGPD), e cancelar o alojamento antigo.
- **Contas e anúncios antigos:**
  - As contas que nunca voltarem a entrar continuam com o hash do WordPress: 56 em bcrypt (formato do WordPress 6.8) e 6 no formato antigo phpass, que é mais fraco. Todas passam para bcrypt no primeiro login.
  - Os anúncios importados seguem as regras normais: aviso 3 dias antes de expirar, expiração e lembrete.

## Ensaio (27/10/2026)

Base de dados vazia → `migrate` → `seed` → `wp-import` → `wp-verify`:

- **Importação:**
  - 62 contas, 22 anúncios, 157 valores de campos, 89 fotografias;
  - 336 artigos + 2 rascunhos, 58 mensagens;
  - 427 imagens processadas em 128 s.
- **Verificação:** 20/20.
- **Segunda importação na mesma base:** nada duplicado, 20/20.
- **Site a correr sobre a base ensaiada:** 415/415 URLs; 27/27 verificações das páginas públicas.

Avisos encontrados:

- **Anúncio WP 2845:** preço de 15 € (por mês). Provavelmente falta um zero; confirmar com o anunciante.
- **9 anúncios expiram a 4/11/2026:** se a mudança for depois dessa data, expiram no primeiro dia e o dono recebe o email para renovar.
- **7 contas sem nome público:** ficam como "Anunciante" (o WordPress mostrava o email, que não deve ser público).
- **Conta com perfil "autor" no WordPress:** passa como anunciante. Se essa pessoa escreve no blog, dar-lhe o perfil "Editor" no back-office.
