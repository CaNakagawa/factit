// Regenerates the synthetic cases in eval/cases/ from the HTML below.
// The texts are written for this project (no third-party articles), so
// they can live in the repository. Run: node eval/make-synthetic.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { articleFromHtml } from "./lib.mjs";

const page = (lang, title, byline, date, paras) => `<!DOCTYPE html><html lang="${lang}"><head><title>${title}</title>
<meta name="author" content="${byline}"><meta property="article:published_time" content="${date}"></head>
<body><article><h1>${title}</h1>${paras.map((p) => `<p>${p}</p>`).join("")}</article></body></html>`;

const CASES = [
  {
    name: "news-attributed-ordinary",
    note: "Ordinary attributed news (tests/fixtures/article.html). ADR-008: must stay green.",
    url: "https://news.example.com/2026/09/transit-plan",
    html: readFileSync(new URL("../tests/fixtures/article.html", import.meta.url), "utf8"),
    expect: { status: ["NO_SIGNIFICANT_CONCERNS"], article_type: ["NEWS"], thesis_support: ["SUPPORTED", "PARTIALLY_SUPPORTED"], must_not_have_concerns: ["UNSUPPORTED_ASSERTION", "UNSUPPORTED_SERIOUS_ALLEGATION"] },
  },
  {
    name: "factcheck-shows-its-checking",
    note: "A fact-check whose verdict is backed by named records. The false claim is its subject, not its assertion.",
    url: "https://checagem.example.com/2026/10/vila-nova-obitos",
    html: page("pt", "É falso que Vila Nova não tenha registrado mortes por gripe", "Equipe de Checagem", "2026-10-02T10:00:00Z", [
      "Publicações em redes sociais afirmam que o município de Vila Nova não registrou nenhuma morte por gripe em 2026 graças a um tratamento distribuído pela prefeitura. A afirmação é falsa.",
      "Segundo o boletim epidemiológico da Secretaria Estadual de Saúde, publicado em 28 de setembro e consultado pela reportagem, Vila Nova registrou 14 óbitos por gripe entre janeiro e setembro.",
      "A Secretaria Municipal de Saúde de Vila Nova confirmou os números por nota e informou que não distribuiu nenhum kit de tratamento. A nota foi enviada à reportagem em 30 de setembro.",
      "O conselho regional de medicina afirmou que não há estudo que mostre que o tratamento citado nas publicações reduza mortes por gripe.",
    ]),
    expect: { article_type: ["FACT_CHECK"], thesis_support: ["SUPPORTED"], status: ["NO_SIGNIFICANT_CONCERNS"], must_not_have_concerns: ["UNSUPPORTED_ASSERTION", "UNSUPPORTED_SERIOUS_ALLEGATION"] },
  },
  {
    name: "opinion-unsourced-facts",
    note: "An opinion column that rests on factual statements with no source and nothing shown (C8).",
    url: "https://opiniao.example.com/2026/10/a-conversao-do-prefeito",
    html: page("pt", "A conversão conveniente do prefeito", "Colunista Exemplo", "2026-10-03T08:00:00Z", [
      "O prefeito descobriu a fé às vésperas da eleição. Em minha opinião, a súbita devoção tem mais a ver com pesquisas do que com convicção, e o eleitor deveria desconfiar.",
      "Antes de posar de devoto, o prefeito votou três vezes contra o feriado municipal da padroeira e chamou as procissões de atraso, quando ainda era vereador.",
      "Também cortou pela metade a verba das paróquias no primeiro ano de mandato e só a recompôs agora, a quarenta dias da votação, numa cerimônia transmitida ao vivo.",
      "Cada um acredita no que quiser. Mas é difícil levar a sério uma fé que aparece com o calendário eleitoral e desaparece com ele.",
    ]),
    expect: { article_type: ["OPINION"], status: ["REVIEW_RECOMMENDED"], must_have_concerns: ["UNSUPPORTED_ASSERTION"] },
  },
  {
    name: "attributed-characterization-contrast",
    note: "Headline attributes a characterization; the body describes the narrower act (ADR-012). Contrast, no concern.",
    url: "https://news.example.com/2026/10/debate-cancelado",
    html: page("pt", "Candidato diz que adversário usou 'amigos no tribunal' para censurar debate", "Repórter Exemplo", "2026-10-01T22:00:00Z", [
      "Após a emissora cancelar o debate desta quinta-feira, o candidato Fulano disse em transmissão ao vivo que o adversário Beltrano usou 'amigos no tribunal' para censurar o confronto.",
      "A decisão do tribunal eleitoral, assinada pela relatora do caso, proibiu a emissora de exibir um púlpito vazio com o nome de Beltrano e de dirigir perguntas ao candidato ausente.",
      "As regras do debate, assinadas por todas as campanhas, incluindo a de Beltrano, previam que o espaço do ausente ficaria vazio e identificado. A campanha de Beltrano não respondeu ao pedido de comentário até a publicação.",
      "Pesquisa do instituto Exemplo, registrada no tribunal eleitoral, mostra Beltrano com 42% e Fulano com 38%, empate técnico dentro da margem de erro de dois pontos.",
    ]),
    expect: { article_type: ["NEWS"], status: ["NO_SIGNIFICANT_CONCERNS"], other_side: ["SOUGHT_NO_RESPONSE", "NOT_APPLICABLE"], must_contrast: true, must_not_have_concerns: ["UNSUPPORTED_SERIOUS_ALLEGATION", "HEADLINE_OVERSTATEMENT"] },
  },
];

for (const c of CASES) {
  const { article, quality } = await articleFromHtml(c.html, c.url);
  if (!article || quality.thin) throw new Error(`${c.name}: extraction ${article ? "too thin" : "failed"} ${JSON.stringify(quality)}`);
  const file = new URL(`./cases/${c.name}.json`, import.meta.url);
  writeFileSync(file, JSON.stringify({ name: c.name, note: c.note, expect: c.expect, read_quality: quality, article }, null, 2) + "\n");
  console.log(`${c.name}: ${quality.chars} chars, ${quality.paragraphs} paragraphs`);
}
