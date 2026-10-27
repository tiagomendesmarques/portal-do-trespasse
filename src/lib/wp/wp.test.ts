import { describe, expect, it } from "vitest";
import { maybeUnserialize, phpUnserialize } from "./php-unserialize";
import { parseDump } from "./sql-dump";

describe("phpUnserialize", () => {
  it("lê arrays do WordPress com strings UTF-8 (comprimento em bytes)", () => {
    expect(phpUnserialize('a:1:{s:5:"specs";s:15:"Renda 1.500 €";}')).toEqual({ specs: "Renda 1.500 €" });
  });
  it("lê listas, booleanos e horários do plugin", () => {
    expect(phpUnserialize("a:2:{i:0;i:2846;i:1;i:2848;}")).toEqual([2846, 2848]);
    const bhs = 'a:2:{i:1;a:2:{s:4:"open";b:1;s:5:"times";a:1:{i:0;a:2:{s:5:"start";s:5:"10:00";s:3:"end";s:5:"19:00";}}}i:0;a:1:{s:4:"open";b:0;}}';
    expect(phpUnserialize(bhs)).toEqual({ "1": { open: true, times: [{ start: "10:00", end: "19:00" }] }, "0": { open: false } });
  });
  it("devolve strings simples tal como estão", () => {
    expect(maybeUnserialize("b2b")).toBe("b2b");
    expect(maybeUnserialize("a:0:{}")).toEqual([]);
  });
});

describe("parseDump", () => {
  it("lê INSERTs com escapes do MySQL e ignora tabelas não pedidas", () => {
    const sql = `INSERT INTO \`wp_x\` (\`a\`) VALUES (1);
INSERT INTO \`wp_posts\` (\`ID\`, \`post_title\`, \`post_excerpt\`) VALUES
(1, 'Caf\\u00e9 d\\'Ouro', NULL),
(2, 'Linha\\nnova ''aspas''', '');`;
    const t = parseDump(sql, ["wp_posts"]).get("wp_posts")!;
    expect(t).toEqual([
      { ID: 1, post_title: "Cafu00e9 d'Ouro", post_excerpt: null },
      { ID: 2, post_title: "Linha\nnova 'aspas'", post_excerpt: "" },
    ]);
  });
});
