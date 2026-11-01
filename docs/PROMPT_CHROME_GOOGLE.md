# Prompt para o Claude no Chrome: ligar o "Continuar com o Google"

Copiar tudo o que está abaixo da linha para o Claude no Chrome. O código já está no site: o botão aparece em
`/my-account/` assim que estes passos estiverem feitos (primeiro no dev; na produção quando o código chegar ao `main`).

---

Preciso que me ajudes a ligar o login com o Google no site **portaldotrespasse.pt**, que corre no Google Cloud. O código já está feito; falta criar as credenciais OAuth na consola do Google Cloud e guardá-las com um script do repositório https://github.com/tiagomendesmarques/portal-do-trespasse.

## Regras (importante)
1. **O Client secret é uma password:** nunca o escrevas, copies ou leias em voz alta no chat. Quando aparecer, pede-me para o copiar eu, e para o colar eu no Cloud Shell quando o script o pedir. O Client ID não é secreto e podes copiá-lo.
2. **Não carregues logótipo no ecrã de consentimento:** obriga a uma verificação do Google que pode demorar semanas. Só nome e links.
3. **Não peças mais autorizações (scopes) além de `openid`, `email` e `profile`.**
4. **Se aparecer um pedido de faturação, verificação ou custos, pergunta-me antes.**
5. **Se algo falhar, copia-me a mensagem exata e para.**

## Passos

### 1. Projeto
Abre https://console.cloud.google.com e escolhe o projeto do Portal do Trespasse (o mesmo onde está o Cloud Run). Anota o **ID do projeto**: nos comandos é `ID-DO-PROJETO`.

### 2. Ecrã de consentimento (Google Auth Platform)
1. Abre https://console.cloud.google.com/auth/overview (no projeto certo).
2. Se aparecer **"Get started"**, preenche:
   - App name: `Portal do Trespasse`
   - User support email: `geral@portaldotrespasse.pt` (se não estiver na lista, pergunta-me qual usar)
   - Audience: **External**
   - Contact information: `geral@portaldotrespasse.pt`
   - Aceita a política de dados e clica **Create**.
3. Em **Branding** (menu à esquerda):
   - Application home page: `https://portaldotrespasse.pt`
   - Application privacy policy link: `https://portaldotrespasse.pt/politica-de-privacidade/`
   - Application terms of service link: `https://portaldotrespasse.pt/termos-e-condicoes/`
   - Authorized domains: `portaldotrespasse.pt`
   - **Sem logótipo.** Guarda.
4. Em **Audience**: se o estado for "Testing", clica **Publish app** e confirma. Com os scopes básicos não é precisa verificação. Em "Testing", só contas de teste conseguiriam entrar.

### 3. Cliente OAuth
1. Em **Clients** (menu à esquerda): **Create client**.
2. Preenche:
   - Application type: **Web application**
   - Name: `Portal do Trespasse (site)`
   - Authorized JavaScript origins: deixa vazio.
   - **Authorized redirect URIs**, adiciona os dois, exatamente assim, com a barra no fim:
     - `https://portaldotrespasse.pt/api/auth/google/callback/`
     - `https://dev.portaldotrespasse.pt/api/auth/google/callback/`
3. Clica **Create**. Aparece uma janela com o **Client ID** e o **Client secret**.
   - Copia o Client ID para o chat.
   - **Para e pede-me para copiar eu o Client secret** (botão de copiar, ou "Download JSON"). Ele só é mostrado uma vez.

### 4. Guardar no Google Cloud
Abre o Cloud Shell (ícone `>_`) e corre:

```bash
[ -d ~/portal-do-trespasse ] || git clone https://github.com/tiagomendesmarques/portal-do-trespasse.git ~/portal-do-trespasse
cd ~/portal-do-trespasse && git fetch && git checkout dev && git pull
./deploy/gcp-google-login.sh ID-DO-PROJETO
```

O script pede duas coisas:
- o **Client ID**: podes colá-lo tu;
- o **Client secret**: pede-me para o colar eu (não aparece no ecrã).

No fim tem de dizer "Login com o Google ligado em portal-do-trespasse-dev" e o mesmo para "portal-do-trespasse-producao".

### 5. Testar no dev
1. Abre https://dev.portaldotrespasse.pt/my-account/ e pede-me o utilizador e a password do site de testes.
2. Tem de aparecer o botão **"Continuar com o Google"**. Clica e pede-me para escolher a minha conta Google.
3. Tem de voltar ao site com sessão iniciada ("Olá, …").

### 6. Política de privacidade (pede-me para entrar no back-office)
Em https://portaldotrespasse.pt/admin/paginas/, abre "Política de Privacidade" e acrescenta, no fim da secção sobre os dados recolhidos, este parágrafo:

> Se entrar com a sua conta Google, recebemos do Google o seu nome, o seu email e um identificador da conta. Não recebemos a sua password nem acesso a mais nada da sua conta Google.

Guarda.

## No fim, dá-me um resumo com:
- o Client ID (o secret não);
- o resultado do script;
- se o teste no dev funcionou;
- qualquer erro, com a mensagem exata.
