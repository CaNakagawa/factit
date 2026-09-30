// Fact It - interface language (V1.4).
//
// Classic script; exposes FactIt.i18n. Loaded before derive/top-bar/panel in
// content scripts and before options.js on the settings page.
//
// Keys are the English source strings, so untranslated text degrades to
// English instead of showing an identifier. `{name}` placeholders are
// interpolated from the second argument.
//
// This only translates Fact It's own interface. The analysis text (summary,
// rationale, claims, notes) is written by the model in the language of the
// article and is never translated here.
//
// chrome.i18n is not used: it follows the browser's UI language and cannot
// be overridden by a setting, which is what this needs to support.

(function (root) {
  const LANGUAGES = Object.freeze([
    { code: "auto", label: "Automatic (browser language)", native: "Automático (idioma do navegador)" },
    { code: "en", label: "English", native: "English" },
    { code: "pt", label: "Portuguese", native: "Português" },
  ]);

  const PT = {
    // ---------------------------------------------------------- status
    "No significant concerns": "Nenhuma preocupação relevante",
    "Review recommended": "Revisão recomendada",
    "Significant concerns": "Preocupações relevantes",
    "No significant misleading or problematic signals were detected in the analyzed content. This is not a statement that the article is true.":
      "Nenhum sinal relevante de conteúdo enganoso ou problemático foi detectado. Isto não afirma que o artigo seja verdadeiro.",
    "There are concrete reasons for caution in the analyzed content. Review the concerns below.":
      "Há motivos concretos de cautela no conteúdo analisado. Veja as preocupações abaixo.",
    "The analyzed content conflicts with itself or with what it presents. Review the concerns below before relying on it.":
      "O conteúdo analisado se contradiz ou conflita com o que ele mesmo apresenta. Veja as preocupações antes de confiar nele.",

    // ------------------------------------------------- claim vocabulary
    "Supported within article": "Sustentado dentro do artigo",
    "Partially supported within article": "Parcialmente sustentado dentro do artigo",
    "Attributed reporting": "Relato atribuído",
    "Allegation reported, attributed": "Acusação relatada, com atribuição",
    "Unsupported within article": "Sem sustentação no artigo",
    "Contradicted within article": "Contradito dentro do artigo",
    "Unclear from the article": "Não dá para julgar pelo artigo",

    Clear: "Clara",
    Unclear: "Pouco clara",
    None: "Nenhuma",

    "Primary document": "Documento primário",
    "Official record": "Registro oficial",
    "Named source": "Fonte identificada",
    "Direct quote": "Citação direta",
    "Secondary source": "Fonte secundária",
    "Anonymous source": "Fonte anônima",
    "Unidentified report": "Relato não identificado",
    "Article's own assertion": "Afirmação do próprio artigo",
    "No evidence shown": "Nenhuma evidência apresentada",
    "Not stated": "Não informado",

    "Headline contradicts body": "Título contradiz o texto",
    "Internal contradiction": "Contradição interna",
    "Numbers do not add up": "Os números não fecham",
    "Serious allegation presented as fact": "Acusação grave apresentada como fato",
    "Source does not support the claim": "A fonte não sustenta a afirmação",
    "Conclusion conflicts with evidence": "A conclusão conflita com as evidências",
    "Invalid citation": "Citação inválida",
    "Headline overstates the body": "Título exagera em relação ao texto",
    "Ambiguous attribution": "Atribuição ambígua",
    "Questionable statistic": "Estatística questionável",
    "Material context missing": "Falta contexto relevante",
    "Opinion presented as fact": "Opinião apresentada como fato",
    "Selective evidence": "Evidência seletiva",
    "Extraordinary claim without support": "Afirmação extraordinária sem sustentação",
    "Possibly outdated": "Possivelmente desatualizado",
    "Potentially misleading framing": "Enquadramento possivelmente enganoso",

    "Significant concern": "Preocupação relevante",
    Concern: "Preocupação",
    "No concern": "Sem preocupação",

    // --------------------------------------------------------- tags
    CONTRADICTION: "CONTRADIÇÃO",
    SUSPICIOUS: "SUSPEITO",
    "NEEDS REVIEW": "REVISAR",
    UNSOURCED: "SEM FONTE",
    ALLEGATION: "ACUSAÇÃO",
    OPINION: "OPINIÃO",
    UNCLEAR: "INCERTO",
    DOCUMENTED: "DOCUMENTADO",
    SOURCED: "COM FONTE",
    REPORTED: "RELATADO",
    "The article conflicts with itself or with what it presents": "O artigo se contradiz ou conflita com o que apresenta",
    "A significant signal that this passage may mislead": "Sinal relevante de que este trecho pode enganar",
    "A concrete reason for caution in this passage": "Motivo concreto de cautela neste trecho",
    "Asserted as fact with nothing shown and no source named": "Afirmado como fato, sem nada apresentado e sem fonte identificada",
    "An accusation the article reports and attributes to someone else": "Acusação que o artigo relata e atribui a outra pessoa",
    "A judgment presented in the article, not a factual statement": "Um juízo apresentado no artigo, não uma afirmação factual",
    "Cannot be judged from the article's own content": "Não dá para julgar pelo conteúdo do próprio artigo",
    "Backed by a document or official record shown in the article": "Apoiado em documento ou registro oficial apresentado no artigo",
    "Attributed to a named source or a direct quote in the article": "Atribuído a uma fonte identificada ou citação direta no artigo",
    "Ordinary reporting; nothing in the content raises a concern": "Relato comum; nada no conteúdo levanta preocupação",

    // ------------------------------------------------------- two boxes
    "What it leads you to believe": "O que leva você a acreditar",
    "What it actually says": "O que de fato diz",
    Stated: "Afirma",
    Shown: "Mostra",
    "Not shown": "Não mostra",
    "This is the claim as the article puts it; nothing further is implied.":
      "Esta é a afirmação como o artigo a coloca; nada além disso é sugerido.",

    // ------------------------------------------------------------- bar
    "Not analyzed": "Não analisado",
    Analyze: "Analisar",
    "Analyzing…": "Analisando…",
    "No article detected on this page": "Nenhum artigo detectado nesta página",
    "AI preliminary · not externally verified": "IA preliminar · sem verificação externa",
    "AI preliminary": "IA preliminar",
    Details: "Detalhes",
    Retry: "Tentar de novo",
    "Open settings": "Abrir configurações",
    "Hide Fact It on this page": "Ocultar o Fact It nesta página",
    "Hide Fact It bar": "Ocultar a barra do Fact It",
    "Analysis failed ({kind}): {message}": "Falha na análise ({kind}): {message}",
    "Unknown error": "Erro desconhecido",
    "No verifiable claims found": "Nenhuma afirmação verificável encontrada",
    "from cache": "do cache",
    "from cache · {detail}": "do cache · {detail}",
    "{n} concern": "{n} preocupação",
    "{n} concerns": "{n} preocupações",
    "{n} issue": "{n} problema",
    "{n} issues": "{n} problemas",
    "{word} confidence": "confiança {word}",
    high: "alta",
    moderate: "moderada",
    low: "baixa",
    "{label} - the strength of warning signals found in the content; not a truth verdict":
      "{label} - a força dos sinais de alerta encontrados no conteúdo; não é um veredito sobre a verdade",

    // ----------------------------------------------------------- panel
    "Fact It": "Fact It",
    "Fact It — Detailed analysis": "Fact It — Análise detalhada",
    "← Summary": "← Resumo",
    Close: "Fechar",
    "Close analysis": "Fechar a análise",
    Status: "Situação",
    "{label} detected": "{label} detectada",
    "The analyzed content did not contain claims Fact It could inspect.":
      "O conteúdo analisado não trouxe afirmações que o Fact It pudesse inspecionar.",
    "Analysis confidence: {pct} ({word})": "Confiança da análise: {pct} ({word})",
    "claims analyzed": "afirmações analisadas",
    "significant concerns": "preocupações relevantes",
    observations: "observações",
    contradictions: "contradições",
    "AI PRELIMINARY · NO EXTERNAL VERIFICATION PERFORMED": "IA PRELIMINAR · NENHUMA VERIFICAÇÃO EXTERNA REALIZADA",
    "This analysis evaluates the content and evidence presented by the article. External sources were not independently verified. That is metadata about Fact It, not a concern about the article.":
      "Esta análise avalia o conteúdo e as evidências apresentadas pelo artigo. Fontes externas não foram verificadas de forma independente. Isso é um dado sobre o Fact It, não uma preocupação sobre o artigo.",
    "Key findings": "Principais achados",
    "No significant concerns detected. Claims are internally consistent and, where it matters, attributed.":
      "Nenhuma preocupação relevante detectada. As afirmações são coerentes entre si e, onde importa, atribuídas.",
    "Nothing to report.": "Nada a relatar.",
    "+{n} more in the detailed analysis.": "+{n} na análise detalhada.",
    "Source transparency": "Transparência das fontes",
    "Named author": "Autoria identificada",
    "Publication date": "Data de publicação",
    "Named sources for important claims": "Fontes identificadas para as afirmações importantes",
    "Primary references (advisories, filings, studies)": "Referências primárias (boletins, processos, estudos)",
    "Direct quotations": "Citações diretas",
    "Observable sourcing characteristics of the text. They do not verify the sources and do not rate the publication.":
      "Características observáveis de fontes no texto. Não verificam as fontes nem avaliam a publicação.",
    "Possible framing": "Enquadramento possível",
    "Possible {type} framing · {strength} · confidence {pct}": "Enquadramento {type} possível · {strength} · confiança {pct}",
    "No notable framing observed.": "Nenhum enquadramento relevante observado.",
    "Framing is reported separately and does not affect the status.":
      "O enquadramento é relatado à parte e não afeta a situação.",
    "Inspect claims ({n})": "Inspecionar afirmações ({n})",
    "Detailed analysis": "Análise detalhada",
    "Re-analyze (uses tokens)": "Analisar de novo (consome tokens)",
    "Shown from local cache · no tokens were used to display this.":
      "Exibido do cache local · nenhum token foi usado para mostrar isto.",

    Overview: "Visão geral",
    Claims: "Afirmações",
    Evidence: "Evidências",
    Framing: "Enquadramento",
    About: "Sobre",

    "Analysis confidence {pct} · AI preliminary · external verification not performed (metadata, not a concern).":
      "Confiança da análise {pct} · IA preliminar · sem verificação externa (dado informativo, não uma preocupação).",
    Summary: "Resumo",
    "No summary provided.": "Nenhum resumo fornecido.",
    Highlights: "Destaques",
    "Concerns ({n})": "Preocupações ({n})",
    "No concerns were found in the content.": "Nenhuma preocupação foi encontrada no conteúdo.",
    "Ordinary reporting, no concern ({n})": "Relato comum, sem preocupação ({n})",
    "Every claim carries a concern.": "Todas as afirmações carregam alguma preocupação.",
    "+{n} more in Claims": "+{n} em Afirmações",
    "\"No concern\" means Fact It found no concrete signal in the content; it is not a statement that the claim is true.":
      "\"Sem preocupação\" significa que o Fact It não encontrou sinal concreto no conteúdo; não afirma que a afirmação seja verdadeira.",

    "Claims ({n})": "Afirmações ({n})",
    "No verifiable claims were identified.": "Nenhuma afirmação verificável foi identificada.",
    "Article-level concerns ({n})": "Preocupações sobre o artigo ({n})",
    "Within the article": "Dentro do artigo",
    Type: "Tipo",
    Attribution: "Atribuição",
    "Article evidence": "Evidência no artigo",
    "Evidence type": "Tipo de evidência",
    Concerns: "Preocupações",
    "What is missing": "O que falta",
    "Possible reader inference": "Inferência possível do leitor",
    "External verification": "Verificação externa",
    "Not performed (metadata; not a concern)": "Não realizada (dado informativo; não é uma preocupação)",
    "None shown": "Nada apresentado",
    Allegation: "Acusação",
    Opinion: "Opinião",
    "Factual claim": "Afirmação factual",

    "Evidence presented by the article": "Evidências apresentadas pelo artigo",
    "No claims to profile.": "Nenhuma afirmação para perfilar.",
    "These describe the support the article shows, not whether it is true. External verification: not performed.":
      "Isto descreve o apoio que o artigo mostra, não se ele é verdadeiro. Verificação externa: não realizada.",
    "Side by side: claims with concerns ({n})": "Lado a lado: afirmações com preocupações ({n})",
    "No claim carries a concern, so there is nothing to put side by side. Ordinary reporting is not listed here.":
      "Nenhuma afirmação carrega preocupação, então não há nada para comparar lado a lado. Relatos comuns não aparecem aqui.",
    "No claims to compare.": "Nenhuma afirmação para comparar.",
    "The left box is what the passage invites a reader to take away; the right box is what the text states and shows. Both are observations about the text, not claims about the author's intent or about readers.":
      "A caixa da esquerda é o que o trecho convida o leitor a concluir; a da direita é o que o texto afirma e mostra. Ambas são observações sobre o texto, não afirmações sobre a intenção do autor ou sobre os leitores.",

    "Possible {type} framing": "Enquadramento {type} possível",
    "{strength} · Confidence: {pct}": "{strength} · Confiança: {pct}",
    "Strength unknown": "Intensidade desconhecida",
    "Observed characteristics": "Características observadas",
    "What this means": "O que isto significa",
    "Framing describes observable characteristics of the text: which sources are chosen, what is emphasized or ordered first, which counterarguments are absent, which terms carry a charge. It says nothing about the author's or the publication's ideology, and nothing about whether the claims are true.":
      "O enquadramento descreve características observáveis do texto: quais fontes são escolhidas, o que é enfatizado ou vem primeiro, quais contra-argumentos faltam, quais termos são carregados. Não diz nada sobre a ideologia do autor ou da publicação, nem sobre a veracidade das afirmações.",
    "Framing is reported separately and does not affect the status. A subject being political, commercial or controversial is not framing.":
      "O enquadramento é relatado à parte e não afeta a situação. Um tema ser político, comercial ou controverso não é enquadramento.",
    Political: "Político",
    Ideological: "Ideológico",
    Religious: "Religioso",
    Commercial: "Comercial",
    Activist: "Ativista",
    Cultural: "Cultural",
    Other: "Outro",
    Low: "Baixa",
    Moderate: "Moderada",
    High: "Alta",

    "About this analysis": "Sobre esta análise",
    "Verification level": "Nível de verificação",
    "Not performed (metadata; never counted as a concern)": "Não realizada (dado informativo; nunca contada como preocupação)",
    Provider: "Provedor",
    Model: "Modelo",
    "Prompt version": "Versão do prompt",
    "Schema version": "Versão do esquema",
    Analyzed: "Analisado em",
    unknown: "desconhecido",
    Tokens: "Tokens",
    "{input} input · {output} output": "{input} de entrada · {output} de saída",
    "not reported by the provider": "não informado pelo provedor",
    "Estimated cost": "Custo estimado",
    "set prices in Fact It settings": "defina os preços nas configurações do Fact It",
    Source: "Origem",
    "local cache": "cache local",
    "this session": "esta sessão",
    Note: "Observação",
    "Analyzed with schema {version} under the older, verification-centric prompt; shown in the current layout. Re-analyze for the concern-based analysis.":
      "Analisado com o esquema {version} sob o prompt antigo, centrado em verificação; exibido no formato atual. Analise de novo para a análise baseada em preocupações.",
    "The article was cut for length; only the first part was analyzed.":
      "O artigo foi cortado por tamanho; apenas a primeira parte foi analisada.",
    "{n} item(s) from the model were dropped because they did not match the schema.":
      "{n} item(ns) do modelo foram descartados por não corresponderem ao esquema.",
    "This analysis evaluates the content and evidence presented by the article. External sources were not independently verified. Fact It does not decide what is true; it exposes claims, the support shown for them, gaps and possible framing so you can inspect them.":
      "Esta análise avalia o conteúdo e as evidências apresentadas pelo artigo. Fontes externas não foram verificadas de forma independente. O Fact It não decide o que é verdade; ele expõe afirmações, o apoio mostrado para elas, lacunas e possíveis enquadramentos para você inspecionar.",

    // -------------------------------------------------- settings page
    "Know what you're reading.": "Saiba o que você está lendo.",
    "Interface language": "Idioma da interface",
    "Fact It's own interface only. The analysis text follows the language of the article.":
      "Apenas a interface do Fact It. O texto da análise segue o idioma do artigo.",
    "AI provider": "Provedor de IA",
    "Fact It sends the extracted article text directly from your browser to the provider you choose, using your own API key (bring your own key). Fact It operates no servers and never sees your key or your articles.":
      "O Fact It envia o texto extraído do artigo direto do seu navegador para o provedor que você escolher, usando a sua própria chave de API. O Fact It não opera servidores e nunca vê sua chave nem seus artigos.",
    "Where to get a key, model names and base URLs for each provider:":
      "Onde obter uma chave, nomes de modelos e URLs base de cada provedor:",
    "provider reference": "referência de provedores",
    "Base URL": "URL base",
    "Chat Completions endpoint root. Plain http is only allowed for localhost.":
      "Raiz do endpoint Chat Completions. http simples só é permitido para localhost.",
    "API key": "Chave de API",
    "Price per 1M input tokens (USD)": "Preço por 1M de tokens de entrada (USD)",
    "Price per 1M output tokens (USD)": "Preço por 1M de tokens de saída (USD)",
    "Optional. Used only to estimate the cost of each analysis; leave empty to see token counts only.":
      "Opcional. Usado apenas para estimar o custo de cada análise; deixe vazio para ver só a contagem de tokens.",
    Save: "Salvar",
    "Test connection": "Testar conexão",
    "Remove key": "Remover chave",
    Usage: "Uso",
    "Reset counters": "Zerar contadores",
    "Local analysis cache": "Cache local de análises",
    "Analyses are kept in this browser profile, keyed by a hash of the article text, so revisiting an unchanged article costs no tokens. Article text itself is not stored.":
      "As análises ficam neste perfil do navegador, indexadas por um hash do texto do artigo, então revisitar um artigo inalterado não consome tokens. O texto do artigo não é armazenado.",
    "Clear analysis cache": "Limpar cache de análises",
    "About your API key": "Sobre a sua chave de API",
    "The key is stored in this browser profile's extension storage. That storage is not encrypted: anyone who can read your browser profile can read the key. Use a key with a spending limit and revoke it if you stop using Fact It.":
      "A chave fica no armazenamento da extensão neste perfil do navegador. Esse armazenamento não é criptografado: quem puder ler o seu perfil pode ler a chave. Use uma chave com limite de gastos e revogue-a se parar de usar o Fact It.",
    Version: "Versão",
    Settings: "Configurações",
    "Fact It - Settings": "Fact It - Configurações",
    Provider: "Provedor",
    "Saved.": "Salvo.",
    "API key removed.": "Chave de API removida.",
    "Saving and testing…": "Salvando e testando…",
    "Required. Stored locally, never shown again.": "Obrigatória. Guardada localmente, nunca mostrada de novo.",
    "Optional for local servers. Stored locally, never shown again.":
      "Opcional para servidores locais. Guardada localmente, nunca mostrada de novo.",
    "(saved - leave empty to keep)": "(salva - deixe vazio para manter)",
    "Leave empty to use {model}.": "Deixe vazio para usar {model}.",
    "Required. Use the model name your server expects.": "Obrigatório. Use o nome de modelo que o seu servidor espera.",
    "model name": "nome do modelo",
    "List price for {model}: ${input} in / ${output} out per 1M tokens (pre-filled; edit if your plan differs).":
      "Preço de tabela de {model}: ${input} entrada / ${output} saída por 1M de tokens (pré-preenchido; ajuste se o seu plano for outro).",
    "Optional. Used only to estimate the cost of each analysis; leave empty to see token counts only. Check your provider's pricing page.":
      "Opcional. Usado apenas para estimar o custo de cada análise; deixe vazio para ver só a contagem de tokens. Consulte a página de preços do seu provedor.",
    "Connected: {provider} / {model} replied \"{sample}\".{cost}": "Conectado: {provider} / {model} respondeu \"{sample}\".{cost}",
    " Cost ≈ {cost}.": " Custo ≈ {cost}.",
    "Failed ({kind}): {message}": "Falhou ({kind}): {message}",
    "Failed: {message}": "Falhou: {message}",
    "unknown error": "erro desconhecido",
    "No response from background.": "Sem resposta do serviço em segundo plano.",
    "No requests yet.": "Nenhuma requisição ainda.",
    "{n} request": "{n} requisição",
    "{n} requests": "{n} requisições",
    "{requests}{since}: {input} input + {output} output tokens, estimated {cost}.":
      "{requests}{since}: {input} tokens de entrada + {output} de saída, estimativa {cost}.",
    "Only requests made with prices set are counted in the estimate.":
      "Só entram na estimativa as requisições feitas com preços definidos.",
    " since {date}": " desde {date}",
    "{n} cached analysis.": "{n} análise em cache.",
    "{n} cached analyses.": "{n} análises em cache.",
    "Removed {n} cached analysis.": "{n} análise removida do cache.",
    "Removed {n} cached analyses.": "{n} análises removidas do cache.",
  };

  const DICTIONARIES = { pt: PT };

  function resolve(preference) {
    if (preference === "en" || preference === "pt") return preference;
    const nav = (root.navigator && (root.navigator.language || (root.navigator.languages || [])[0])) || "en";
    return String(nav).toLowerCase().startsWith("pt") ? "pt" : "en";
  }

  let current = "en";

  /** @param {"auto"|"en"|"pt"} preference */
  function setLanguage(preference) {
    current = resolve(preference);
    return current;
  }

  /**
   * @param {string} source the English string (also the dictionary key)
   * @param {object} [vars] values for {name} placeholders
   */
  function t(source, vars) {
    if (typeof source !== "string") return "";
    const dict = DICTIONARIES[current];
    let out = (dict && Object.prototype.hasOwnProperty.call(dict, source) && dict[source]) || source;
    if (vars) {
      out = out.replace(/\{(\w+)\}/g, (match, name) =>
        Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match);
    }
    return out;
  }

  root.FactIt = Object.assign(root.FactIt || {}, {
    i18n: { t, setLanguage, resolve, LANGUAGES, get language() { return current; } },
  });
})(globalThis);
