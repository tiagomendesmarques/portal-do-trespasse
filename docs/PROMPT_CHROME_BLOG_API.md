# Prompt para o Claude no Chrome: ligar a API de artigos

Copiar tudo o que está abaixo da linha para o Claude no Chrome. Fazer depois de o código da API estar no ramo
`dev` (para testar) ou no `main` (para a produção). O script liga os dois ambientes de uma vez.

---

Preciso que me ajudes a ligar a API de artigos do site **portaldotrespasse.pt**, que corre no Google Cloud. O código já está feito; falta criar a chave e ligá-la ao site, com um script do repositório https://github.com/tiagomendesmarques/portal-do-trespasse.

## Regras
1. **A chave da API é uma password:** nunca a escrevas, copies ou mostres no chat. Quando for preciso vê-la, pede-me para correr eu o comando e copiá-la.
2. **Se algo falhar, copia-me a mensagem de erro exata e para.**

## Passos
1. Abre https://console.cloud.google.com, escolhe o projeto do Portal do Trespasse e anota o **ID do projeto**. Nos comandos é `ID-DO-PROJETO`.
2. Abre o Cloud Shell (ícone `>_`) e corre:

   ```bash
   [ -d ~/portal-do-trespasse ] || git clone https://github.com/tiagomendesmarques/portal-do-trespasse.git ~/portal-do-trespasse
   cd ~/portal-do-trespasse && git fetch && git checkout dev && git pull
   ./deploy/gcp-blog-api.sh ID-DO-PROJETO
   ```

   Tem de dizer "API de artigos ligada em portal-do-trespasse-dev" e o mesmo para "portal-do-trespasse-producao".
3. Testa que a API responde (deve dar `401`, porque o pedido vai sem chave):

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://portaldotrespasse.pt/api/v1/artigos/contexto/
   ```

   Faz o mesmo com `https://dev.portaldotrespasse.pt/api/v1/artigos/contexto/`.
4. **Pede-me para fazer eu este passo:** correr `gcloud secrets versions access latest --secret=pdt-blog-api-token` e copiar a chave para as definições do ambiente do Claude Code, como `PDT_BLOG_TOKEN`.

## No fim, dá-me um resumo com:
- o resultado do script;
- os códigos do teste do passo 3;
- qualquer erro, com a mensagem exata.
