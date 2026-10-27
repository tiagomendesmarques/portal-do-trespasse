// Texto inicial das páginas institucionais (pt-PT), revisto a partir do site WordPress.
// O seed copia-o para a tabela "pages"; depois edita-se no back-office.

export type SeedPage = { slug: string; title: string; seoDescription: string; contentHtml: string };

export const FAQ: [string, string][] = [
  ["O que é o Portal do Trespasse?", "É um site de classificados dedicado a negócios: quem quer passar ou vender o seu negócio anuncia aqui, e quem procura uma oportunidade pesquisa por setor, localização e preço."],
  ["Como anuncio a venda do meu negócio?", "Crie uma conta gratuita, confirme o email e carregue em \"Publicar anúncio\". Indique a localização, o setor, o valor, a renda e a faturação, e destaque os pontos fortes do negócio. O anúncio fica visível depois de revisto pela equipa, normalmente em menos de 48 horas."],
  ["Quanto custa anunciar?", "Publicar é gratuito. No futuro poderá haver opções pagas para destacar anúncios, sempre opcionais."],
  ["O Portal do Trespasse trata da venda?", "Não. O portal é um serviço de anúncios e não participa no negócio entre comprador e vendedor, nem se responsabiliza por acordos feitos entre as partes."],
  ["Como contacto um anunciante?", "Na página do anúncio, inicie sessão para ver o telefone ou enviar uma mensagem. A mensagem chega ao email do anunciante, que lhe responde diretamente."],
  ["Como pesquiso negócios?", "Use a pesquisa da página inicial ou a página de anúncios, onde pode filtrar por tipo, categoria, distrito, concelho, preço, renda e faturação."],
  ["Que tipos de negócio posso encontrar?", "Restauração, comércio, saúde e estética, turismo, serviços, construção e outros, em 13 categorias, de trespasses a venda de empresas, aluguer de ativos e procura de investidores."],
  ["Como mantenho a venda confidencial?", "Partilhe no anúncio só o essencial e envie os dados financeiros detalhados apenas a interessados que assinem um acordo de confidencialidade."],
  ["Há apoio ao cliente?", "Sim. Para dúvidas ou problemas técnicos, escreva-nos pela página de Contactos."],
  ["Como atualizo ou removo o meu anúncio?", "Entre na sua conta e abra \"Os meus anúncios\": pode editar, marcar como vendido, renovar ou apagar. As alterações voltam a ser revistas antes de ficarem visíveis."],
];

const ol = (items: [string, string][]) => `<ol>${items.map(([t, d]) => `<li><strong>${t}</strong> ${d}</li>`).join("")}</ol>`;

export const PAGES: SeedPage[] = [
  {
    slug: "faq",
    title: "Perguntas frequentes",
    seoDescription: "Respostas sobre como anunciar, pesquisar e contactar anunciantes no Portal do Trespasse.",
    contentHtml: FAQ.map(([q, a]) => `<h2>${q}</h2><p>${a}</p>`).join("\n"),
  },
  {
    slug: "como-vender-o-seu-negocio",
    title: "Como vender o seu negócio",
    seoDescription: "Dicas práticas para anunciar o trespasse ou a venda do seu negócio e atrair compradores qualificados.",
    contentHtml: `<p>Um anúncio claro e completo faz toda a diferença para atrair interessados qualificados e fechar um bom negócio. Siga estas dicas:</p>
${ol([
  ["Faça um anúncio completo.", "Indique a localização, o setor, o valor, a renda, a faturação e a rentabilidade. Destaque a clientela, as vantagens competitivas e o potencial de crescimento. Seja transparente sobre o motivo da venda."],
  ["Use boas fotografias.", "Mostre a fachada, o interior e o equipamento, com boa luz. Anúncios com fotografias recebem muito mais contactos."],
  ["Destaque os benefícios para o comprador.", "Clientes fiéis, contratos de longa duração, parcerias, equipa experiente ou uma localização com muita passagem."],
  ["Proteja a informação sensível.", "Comece por um resumo e partilhe os números detalhados só com interessados que assinem um acordo de confidencialidade."],
  ["Prepare as respostas.", "Tenha à mão o contrato de arrendamento, as licenças, a faturação dos últimos anos e a lista do que está incluído no trespasse."],
  ["Conte com profissionais.", "Um contabilista e um advogado ajudam a avaliar o negócio, preparar a documentação e redigir o contrato de trespasse."],
])}
<p><a href="/post-an-ad/">Publicar o meu anúncio</a></p>`,
  },
  {
    slug: "o-nosso-programa-de-ajuda",
    title: "O nosso programa de ajuda",
    seoDescription: "Apoio a quem quer comprar um negócio: análise de rentabilidade, acompanhamento da transação e primeiros passos.",
    contentHtml: `<p>O Programa de Assistência na Aquisição de Negócios ajuda quem quer comprar um negócio a decidir com informação e a dar os primeiros passos com segurança, com ou sem experiência no setor.</p>
${ol([
  ["Análise de rentabilidade.", "Avaliamos as perspetivas financeiras, as tendências do setor e as projeções de receita do negócio que está a considerar."],
  ["Acompanhamento da transação.", "Da negociação das condições à assinatura do contrato, estamos disponíveis para esclarecer dúvidas."],
  ["Primeiros passos.", "Dicas práticas de gestão, marketing, equipa e fidelização de clientes para os primeiros meses."],
  ["Orientação para quem começa.", "Recursos introdutórios e sessões informativas para quem nunca teve um negócio."],
])}
<p><a href="/contact/">Fale connosco</a> para saber mais e inscrever-se no programa.</p>`,
  },
  {
    slug: "promove-o-teu-anuncio",
    title: "Promova o seu anúncio",
    seoDescription: "Opções para dar mais visibilidade ao seu anúncio no Portal do Trespasse.",
    contentHtml: `<p>Publicar no Portal do Trespasse é gratuito. Estamos a preparar opções para dar ainda mais visibilidade aos anúncios:</p>
${ol([
  ["Anúncio em destaque.", "Aparece no topo da página inicial e dos resultados de pesquisa."],
  ["Anúncio premium.", "Destaque mais posições privilegiadas nas categorias relevantes."],
  ["Etiqueta de venda urgente.", "Assinala anúncios de quem precisa de vender depressa."],
  ["Divulgação nas redes sociais.", "Partilha do anúncio nas páginas do Portal do Trespasse."],
])}
<p>Quer ser avisado quando estiverem disponíveis? <a href="/contact/">Contacte-nos</a>.</p>`,
  },
  {
    slug: "como-manter-me-seguro",
    title: "Como manter-me seguro",
    seoDescription: "Cuidados a ter ao comprar ou vender um negócio através de anúncios online.",
    contentHtml: `<p>A sua segurança é a nossa prioridade. Siga estes cuidados ao contactar anunciantes e negociar:</p>
${ol([
  ["Confirme que o anúncio é real.", "Pesquise o negócio, visite o espaço pessoalmente e confirme quem é o proprietário antes de decidir."],
  ["Proteja os seus dados.", "Nunca envie dados bancários, de cartão ou documentos de identificação sem ter a certeza de com quem está a falar."],
  ["Não pague antecipadamente.", "Desconfie de pedidos de sinal ou pagamento antes de visitar o negócio e de ver a documentação."],
  ["Encontre-se em segurança.", "Marque visitas no próprio espaço ou em locais públicos e, se possível, vá acompanhado."],
  ["Peça a documentação.", "Contrato de arrendamento, autorização do senhorio, licenças e faturação. Um advogado deve rever o contrato de trespasse."],
  ["Confie no seu instinto.", "Se o negócio parece bom demais para ser verdade, provavelmente é."],
  ["Denuncie.", "Use \"Denunciar abuso\" em qualquer anúncio suspeito. A equipa revê todas as denúncias."],
])}`,
  },
  {
    slug: "termos-e-condicoes",
    title: "Termos e Condições",
    seoDescription: "Termos e condições de utilização do Portal do Trespasse.",
    contentHtml: `<p>Ao utilizar o Portal do Trespasse aceita estes termos, que regem o serviço de anúncios de negócios. Leia-os com atenção.</p>
<h2>1. Aceitação</h2><p>1.1 Ao aceder ao site e ao utilizá-lo, aceita ficar vinculado a estes termos. 1.2 Se não concordar com algum ponto, não deve utilizar o serviço.</p>
<h2>2. Serviço</h2><p>2.1 O Portal do Trespasse é uma plataforma online onde os utilizadores anunciam a venda dos seus negócios e os visitantes pesquisam negócios. 2.2 O portal apenas disponibiliza o espaço para os anúncios e não intervém na transação entre comprador e vendedor, nem é responsável por acordos feitos entre as partes.</p>
<h2>3. Responsabilidades dos utilizadores</h2><p>3.1 Cada anunciante é o único responsável pelo conteúdo dos seus anúncios; o portal não garante a exatidão, legalidade ou veracidade da informação publicada. 3.2 O anunciante garante que tem o direito de anunciar o negócio e de usar as imagens e textos publicados. 3.3 Os utilizadores comprometem-se a usar o portal de forma ética e de acordo com a lei. 3.4 Os anúncios são revistos antes de publicados e podem ser recusados ou removidos se não cumprirem estes termos.</p>
<h2>4. Propriedade intelectual</h2><p>4.1 Os direitos sobre o Portal do Trespasse e os seus conteúdos pertencem ao Portal do Trespasse ou aos seus licenciadores. 4.2 Não é permitido copiar, reproduzir ou distribuir conteúdos do portal sem autorização escrita.</p>
<h2>5. Limitação de responsabilidade</h2><p>5.1 O Portal do Trespasse não é responsável por danos resultantes da utilização ou da impossibilidade de utilização do serviço. 5.2 O portal não garante a exatidão, atualidade ou integridade da informação dos anúncios.</p>
<h2>6. Alterações</h2><p>6.1 Estes termos podem ser alterados, com aviso prévio aos utilizadores. 6.2 Continuar a usar o serviço depois de uma alteração significa aceitá-la.</p>
<h2>7. Disposições gerais</h2><p>7.1 Estes termos constituem o acordo completo entre o utilizador e o Portal do Trespasse. 7.2 Se alguma disposição for considerada inválida, as restantes mantêm-se em vigor. 7.3 Estes termos regem-se pela lei portuguesa.</p>
<p>Dúvidas sobre estes termos? <a href="/contact/">Contacte-nos</a>.</p>`,
  },
  {
    slug: "politica-de-privacidade",
    title: "Política de Privacidade",
    seoDescription: "Que dados pessoais o Portal do Trespasse recolhe, para quê, e como os protege.",
    contentHtml: `<p>A sua privacidade é importante para nós. Esta política explica que dados recolhemos, como os usamos e como os protegemos.</p>
<h2>1. Dados que recolhemos</h2><p>1.1 Dados de conta: nome de utilizador, email e, se os indicar, telefone e outros contactos. 1.2 Dados dos anúncios: descrição, preço, localização, fotografias e contactos do negócio. 1.3 Mensagens enviadas a anunciantes ou através da página de contactos.</p>
<h2>2. Para que os usamos</h2><p>2.1 Gerir a sua conta, publicar e gerir os seus anúncios, responder a pedidos e prestar apoio. 2.2 Enviar emails sobre a sua conta e os seus anúncios (confirmação, aprovação, expiração, mensagens recebidas).</p>
<h2>3. Partilha</h2><p>3.1 Não vendemos nem partilhamos dados pessoais com terceiros, exceto com o seu consentimento, por obrigação legal, ou com prestadores que nos ajudam a operar o site (alojamento e envio de emails), sujeitos a contrato. 3.2 O telefone e o nome público do anunciante são mostrados a utilizadores com sessão iniciada.</p>
<h2>4. Proteção</h2><p>4.1 Usamos ligações encriptadas, passwords guardadas de forma irreversível e acesso restrito aos dados.</p>
<h2>5. Cookies</h2><p>5.1 Usamos cookies essenciais para manter a sessão iniciada. 5.2 Cookies de estatística só são usados com o seu consentimento.</p>
<h2>6. Os seus direitos</h2><p>6.1 Pode aceder, corrigir e apagar os seus dados em "Editar conta", incluindo apagar a conta e todos os anúncios. 6.2 Para outros pedidos, use a página de <a href="/contact/">Contactos</a>.</p>
<h2>7. Alterações</h2><p>7.1 Podemos atualizar esta política; as alterações relevantes são comunicadas no site ou por email.</p>`,
  },
];
