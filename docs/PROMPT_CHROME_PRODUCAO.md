# Prompt para o Claude no Chrome: passar portaldotrespasse.pt para o site novo

Copiar tudo o que está abaixo da linha para o Claude no Chrome. A Parte A não mexe no site atual e pode ser feita antes; a Parte B é a mudança (escolher uma hora calma, conta com 1 a 2 horas).

---

Preciso que me ajudes a passar o domínio **portaldotrespasse.pt** do WordPress para o site novo, que corre no Google Cloud. O código e os scripts estão prontos no repositório público https://github.com/tiagomendesmarques/portal-do-trespasse (ramo `main`). O teu trabalho é correr os scripts no Cloud Shell e fazer os cliques no Google Cloud, no WordPress, no GitHub e na Cloudflare, seguindo esta ordem à risca.

## Regras (importante)
1. **Passwords:** nunca escrevas nem leias passwords. Quando for preciso uma (Cloud Shell, WordPress, back-office do site novo), para e pede-me para a escrever eu.
2. **Cloudflare:** antes de mudar qualquer registo, copia para o chat o valor atual de todos os registos de `portaldotrespasse.pt` (tipo, nome, conteúdo e proxy). É o plano de recuo.
   - Na Parte B só podes **substituir** os registos do domínio principal (`@`) e do `www`.
   - **Não toques** em MX, TXT (SPF, DKIM, verificações), `dev` nem noutros subdomínios (mail, webmail, ftp…).
3. **Pausas obrigatórias:**
   - Não mudes o DNS (passo B5) sem eu escrever "OK, muda o domínio".
   - Se aparecer um pedido de faturação ou custos, pergunta-me antes.
4. **Se um comando falhar:** copia-me a mensagem de erro exata e para. Não improvises alternativas.
5. **Se o Cloud Shell desligar:** volta a abrir, faz `cd ~/portal-do-trespasse` e repete o último comando. Os scripts podem ser repetidos sem problema.

## Parte A — Preparar (o site atual continua igual)

### A1. Projeto e Cloud Shell
- Abre https://console.cloud.google.com e pergunta-me qual é o projeto do Portal do Trespasse. Anota o **ID do projeto**; nos comandos é `ID-DO-PROJETO`.
- Se ainda não houver projeto, cria `portal-do-trespasse` e confirma comigo a faturação.
- Abre o Cloud Shell (ícone `>_`) e corre:

```bash
[ -d ~/portal-do-trespasse ] || git clone https://github.com/tiagomendesmarques/portal-do-trespasse.git ~/portal-do-trespasse
cd ~/portal-do-trespasse && git fetch && git checkout main && git pull
./deploy/gcp-setup.sh ID-DO-PROJETO production
```

- Se pedir a password do email `geral@portaldotrespasse.pt`, pede-me para a escrever.
- A primeira vez demora até 20 minutos.

### A2. Só se o script o pedir
- **"falta ligar o GitHub ao Cloud Build":**
  1. Abre o link que o script mostrou.
  2. Escolhe GitHub (Cloud Build GitHub App) e autentica. Se for preciso entrar no GitHub, pede-me.
  3. Instala a app só no repositório `tiagomendesmarques/portal-do-trespasse` e liga-o. **Não** cries gatilho aí.
- **"provar que o domínio é seu":**
  1. Corre `gcloud domains verify portaldotrespasse.pt` e abre o link da Search Console.
  2. Escolhe a verificação por registo TXT e copia o valor.
  3. Na Cloudflare, **adiciona** um registo `TXT`, nome `@`, com esse valor, e clica Verificar na Search Console.

Depois de qualquer um destes, volta a correr `./deploy/gcp-setup.sh ID-DO-PROJETO production`.

No fim, o script tem de dizer "Gatilho criado: cada push no ramo main…" (ou "já existe") e mostrar os **registos DNS** para `portaldotrespasse.pt` (vários A e AAAA) e para `www.portaldotrespasse.pt` (CNAME). **Copia-os para o chat mas não os apliques ainda.** Anota também o **endereço provisório** (`https://portal-do-trespasse-producao-….run.app`).

### A3. Cloudflare: só ler
Em https://dash.cloudflare.com → `portaldotrespasse.pt` → DNS → Records:
1. Copia para o chat todos os registos atuais (tipo, nome, conteúdo e proxy).
2. Vê para onde aponta o **MX**. Se o MX apontar para `portaldotrespasse.pt` (o próprio domínio) ou para `www`, **para e avisa-me**: mudar o domínio cortaria a receção de emails.

### A4. GitHub (pergunta-me antes)
Em https://github.com/tiagomendesmarques/portal-do-trespasse/settings, muda o **Default branch** para `main`, se ainda não estiver.

Diz-me quando a Parte A estiver feita e espera que eu diga para começar a Parte B.

## Parte B — A mudança

### B1. Congelar o WordPress
- Entra em https://portaldotrespasse.pt/wp-admin/. Pede-me para fazer login.
- Vai a Elementor → Ferramentas → separador **Modo de manutenção**, escolhe "Modo de manutenção" e uma página de manutenção, e guarda.
- Confirma numa janela anónima que o site mostra a página de manutenção.

### B2. Os ficheiros do WordPress
Já tenho os dois ficheiros exportados no meu computador:
- `portdb_nexsbt63.sql` — a base de dados;
- `mftp_zip_…_19_11_59.zip` — os uploads, num só ZIP.

1. Pergunta-me se exportei a base de dados **depois** de ligar o modo de manutenção.
   - Se não, pede-me para exportar o SQL outra vez, para não se perder nada publicado entretanto. É rápido: phpMyAdmin → base de dados → Exportar → Rápido → SQL.
   - O ZIP dos uploads só precisa de ser refeito se tiverem entrado fotografias novas desde então.
2. Pede-me para carregar os dois ficheiros no Cloud Shell: menu ⋮ → **Upload** → escolher os dois.
3. Confirma que chegaram inteiros:

   ```bash
   ls -la ~/*.sql ~/*.zip
   ```

**Se o Upload do Cloud Shell falhar** (o ZIP é grande), usa um bucket temporário e privado:
1. No Cloud Shell, corre `gcloud storage buckets create gs://ID-DO-PROJETO-pdt-migracao --location=europe-west1 --uniform-bucket-level-access --public-access-prevention`.
2. Em https://console.cloud.google.com/storage/browser, abre esse bucket e pede-me para arrastar os dois ficheiros para lá.
3. Copia-os para o Cloud Shell: `gcloud storage cp 'gs://ID-DO-PROJETO-pdt-migracao/*' ~/`.
4. Apaga o bucket logo a seguir: `gcloud storage rm -r gs://ID-DO-PROJETO-pdt-migracao`.

### B3. Importar para a produção
```bash
mkdir -p ~/wp && mv ~/portdb_*.sql ~/*mftp_zip*.zip ~/wp/
cd ~/wp && unzip -oq *mftp_zip*.zip -x '__MACOSX/*' -d uploads-pasta
# a pasta que contém "uploads" (pode vir dentro de wp-content/ ou de outra pasta)
UP=$(dirname "$(find ~/wp/uploads-pasta -maxdepth 4 -type d -name uploads | awk "{ print length, \$0 }" | sort -n | head -1 | cut -d" " -f2-)")
echo "$UP"; ls "$UP/uploads" | head
cd ~/portal-do-trespasse
./deploy/gcp-import.sh ID-DO-PROJETO production ~/wp/portdb_nexsbt63.sql "$UP"
```

- Em `ls "$UP/uploads"` têm de aparecer as pastas dos anos (`2018`, `2019`, …). Se não aparecerem, mostra-me o resultado de `find ~/wp/uploads-pasta -maxdepth 3 -type d | head -20` e para.
- A importação tem de terminar com **"20/20 verificações passaram — migração confirmada"**. Copia-me também as linhas "AVISO".

### B4. Testar antes de mudar o domínio
Abre o endereço provisório (`….run.app`) e confirma:
- a página inicial tem anúncios com fotografias;
- um anúncio abre com fotografias;
- `/blog/` mostra artigos;
- aparece o aviso de cookies.

Depois pede-me para entrar em `/my-account/` com a minha conta de administrador do WordPress (mesma password) e confirma que `/admin/` abre.

**Para aqui e espera que eu escreva "OK, muda o domínio".**

### B5. Mudar o DNS na Cloudflare
1. Em DNS → Records, **apaga** os registos A, AAAA e CNAME do nome `@` (portaldotrespasse.pt) e do nome `www`. Só esses.
2. Cria os registos que o script mostrou no passo A2:
   - os A e AAAA do `@`;
   - o CNAME do `www` (`ghs.googlehosted.com`).
   - Todos com **Proxy status: DNS only (nuvem cinzenta)** e TTL Auto.
3. Não mexas em mais nada.

### B6. Esperar pelo certificado
Corre no Cloud Shell, de 5 em 5 minutos:

```bash
gcloud beta run domain-mappings describe --domain=portaldotrespasse.pt --region=europe-west1 --format='value(status.conditions[].type,status.conditions[].status)'
```

- O certificado está pronto quando todas as condições estiverem `True`. Normalmente demora entre 15 minutos e 1 hora.
- Entretanto o site pode mostrar um aviso de segurança. É normal, e o WordPress já está em manutenção.
- Faz o mesmo para `www.portaldotrespasse.pt`.

### B7. Confirmar
```bash
cd ~/portal-do-trespasse && node e2e/url-coverage.mjs https://portaldotrespasse.pt
```

Tem de dizer **"0 falham"**. Se falharem alguns endereços, copia-mos. Podem ser anúncios apagados no WordPress depois de 27/10, que também já não existem lá.

Depois confirma no browser:
- https://portaldotrespasse.pt abre o site novo;
- https://www.portaldotrespasse.pt redireciona para o endereço sem www;
- um anúncio antigo e um artigo antigo abrem.

### B8. Ajustes no back-office (pede-me para entrar)
Em https://portaldotrespasse.pt/admin/definicoes/, no campo "Emails da equipa que recebem avisos", escreve `geral@portaldotrespasse.pt` e guarda.

### B9. Google
Na Search Console (propriedade `portaldotrespasse.pt`) → Sitemaps → adiciona `https://portaldotrespasse.pt/sitemap.xml`.

### B10. Limpar
- Corre `rm -rf ~/wp`: os ficheiros têm dados pessoais.
- **Não** desligues o WordPress nem o alojamento antigo. Ficam em manutenção 30 dias como plano de recuo.

## Se algo correr mal depois do B5
Para e diz-me. O recuo é:
1. Na Cloudflare, repor os registos `@` e `www` com os valores que copiaste no A3.
2. No WordPress, desligar o modo de manutenção.

## No fim, dá-me um resumo com:
- o ID do projeto e o endereço provisório;
- a última linha da importação e os avisos;
- os registos DNS antigos e os novos;
- o resultado do teste dos endereços (B7);
- qualquer erro, com a mensagem exata.
