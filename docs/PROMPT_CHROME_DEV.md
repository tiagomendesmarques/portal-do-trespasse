# Prompt para o Claude no Chrome: pôr dev.portaldotrespasse.pt a funcionar

Copiar tudo o que está abaixo da linha para o Claude no Chrome.

---

Preciso que me ajudes a pôr o site de testes do Portal do Trespasse no ar, em **https://dev.portaldotrespasse.pt**, no Google Cloud, com deploy automático a partir do ramo `dev` do GitHub. O código e os scripts já estão prontos no repositório público https://github.com/tiagomendesmarques/portal-do-trespasse (ramo `dev`); o teu trabalho é correr os scripts no Cloud Shell e fazer os cliques no Google Cloud, no GitHub e na Cloudflare.

## Regras (importante)
1. **Passwords:** nunca escrevas nem leias passwords. Quando o Cloud Shell pedir uma password (email `geral@portaldotrespasse.pt` ou password do site de testes), para e pede-me para a escrever eu.
2. **Cloudflare — o site atual continua no WordPress:**
   - Só podes **adicionar** os registos indicados abaixo: um TXT de verificação e o registo `dev`.
   - **Não alteres nem apagues** nenhum registo existente: `@`/raiz, `www`, MX, SPF, DKIM ou outros.
3. **Não corras nada com `production`.** É só o ambiente `dev`.
4. **Se aparecer um pedido para confirmar uma conta de faturação ou custos, pergunta-me antes.** O mesmo para dar acesso a outra conta Google ou GitHub.
5. **Se um comando falhar:** copia-me a mensagem de erro exata e para. Não improvises alternativas.
6. **Se o Cloud Shell desligar:** volta a abri-lo, faz `cd ~/portal-do-trespasse` e repete o último comando. Os scripts podem ser repetidos sem problema.

## Passos

### 1. Projeto Google Cloud
- Abre https://console.cloud.google.com.
- Pergunta-me qual é o projeto do Portal do Trespasse. Se não houver, cria um chamado `portal-do-trespasse` e confirma comigo a conta de faturação.
- Anota o **ID do projeto** (ex.: `portal-do-trespasse-123456`). Nos comandos abaixo é `ID-DO-PROJETO`.

### 2. Cloud Shell: criar o ambiente
Abre o Cloud Shell (ícone `>_` no topo). Se pedir para autorizar, autoriza. Corre:

```bash
git clone https://github.com/tiagomendesmarques/portal-do-trespasse.git
cd portal-do-trespasse && git checkout dev
./deploy/gcp-setup.sh ID-DO-PROJETO dev
```

O script vai perguntar:
- **Password do email `geral@portaldotrespasse.pt`:** pede-me para a escrever.
- **Password para entrar no site de testes:** pede-me para a escrever.
- **Que emails podem receber mensagens a sério:** pergunta-me. A sugestão é `geral@portaldotrespasse.pt`.

A primeira vez demora cerca de 20 minutos (só a base de dados leva uns 10). Espera até aparecer "Pronto (dev)".

### 3. Ligar o GitHub ao Cloud Build (só se o script o pedir)
Se o resultado disser "falta ligar o GitHub ao Cloud Build":
1. Abre o link que o script mostrou.
2. Escolhe **GitHub (Cloud Build GitHub App)** e autentica no GitHub. Se for preciso entrar no GitHub, pede-me.
3. Instala a app só no repositório `tiagomendesmarques/portal-do-trespasse`.
4. Liga o repositório. **Não** cries gatilho aí: o script cria-o.

### 4. Verificar o domínio (só se o script o pedir)
Se o resultado disser que é preciso provar que o domínio é seu:
1. No Cloud Shell, corre `gcloud domains verify portaldotrespasse.pt` e abre o link da Search Console que aparece.
2. Escolhe o método de verificação por registo **TXT** do fornecedor de domínio e copia o valor (`google-site-verification=…`).
3. Na Cloudflare (https://dash.cloudflare.com → `portaldotrespasse.pt` → DNS → Records), **Add record**:
   - Tipo `TXT`
   - Nome `@`
   - Conteúdo: o valor copiado
   - TTL `Auto`
   - Guardar.
   Este registo não afeta o site atual.
4. Volta à Search Console e clica **Verificar**. Pode demorar alguns minutos; tenta de novo se falhar.

### 5. Correr o script outra vez
Se fizeste o passo 3 ou o 4:

```bash
cd ~/portal-do-trespasse && ./deploy/gcp-setup.sh ID-DO-PROJETO dev
```

Agora não pede passwords. No fim deve dizer:
- "Gatilho criado: cada push no ramo dev faz deploy de portal-do-trespasse-dev";
- e mostrar os registos DNS para `dev.portaldotrespasse.pt`.

### 6. Registo DNS do dev na Cloudflare
Cria o registo que o script mostrou. Normalmente é este:
- Tipo `CNAME`
- Nome `dev`
- Destino `ghs.googlehosted.com`
- **Proxy status: DNS only (nuvem cinzenta)**
- TTL `Auto`

Se o script mostrar outros valores, usa os do script. O certificado HTTPS demora entre 15 minutos e 1 hora a ficar pronto.

### 7. Importar os dados do WordPress
1. Pede-me para carregar os ficheiros no Cloud Shell (menu ⋮ → **Upload**) para uma pasta `~/wp`:
   - o dump da base de dados: `portdb_….sql.zip`, ou um `.sql` mais recente;
   - os 13 ZIPs dos uploads: `…-part01-of13.zip` a `…-part13-of13.zip`.
2. Quando eu disser que acabou, descompacta. Cada parte é um ZIP completo e vão todas para a mesma pasta:

   ```bash
   mkdir -p ~/wp && mv ~/*.zip ~/*.sql ~/wp/ 2>/dev/null   # o Upload põe os ficheiros na pasta pessoal
   cd ~/wp && ls -la
   unzip -o *.sql.zip -x '__MACOSX/*' 2>/dev/null; ls *.sql
   for f in *part*-of13.zip; do unzip -oq "$f" -d uploads-pasta; done
   ls uploads-pasta/uploads | head
   ```

   Em `uploads-pasta/uploads` têm de aparecer as pastas dos anos (`2018`, `2019`, …). Se faltar alguma das 13 partes, avisa-me.
3. Importa:

   ```bash
   cd ~/portal-do-trespasse
   ./deploy/gcp-import.sh ID-DO-PROJETO dev ~/wp/NOME-DO-DUMP.sql ~/wp/uploads-pasta
   ```

   Tem de terminar com **"20/20 verificações passaram — migração confirmada"**.
4. Apaga os ficheiros, que têm dados pessoais: `rm -rf ~/wp`.

### 8. Confirmar que funciona
- Abre o endereço provisório que o script mostrou (`https://portal-do-trespasse-dev-….run.app`). Quando o certificado estiver pronto, abre https://dev.portaldotrespasse.pt.
- Pede utilizador e password: o utilizador é `equipa`; pede-me para escrever a password.
- Confirma:
  - a página inicial mostra anúncios com fotografias;
  - um anúncio abre;
  - `/blog/` mostra artigos.
- Não entres no back-office por mim.

### 9. GitHub (pergunta-me antes)
Em https://github.com/tiagomendesmarques/portal-do-trespasse/settings, muda o **Default branch** para `main`.

## No fim, dá-me um resumo com:
- o ID do projeto e o endereço provisório (`….run.app`);
- se o gatilho de deploy automático ficou criado;
- os registos que adicionaste na Cloudflare (tipo, nome e destino);
- a última linha da importação;
- qualquer erro que tenha aparecido, com a mensagem exata.
