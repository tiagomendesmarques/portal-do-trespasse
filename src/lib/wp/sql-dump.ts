/**
 * Lê os INSERT de um dump SQL do phpMyAdmin/mysqldump, só das tabelas pedidas.
 * Devolve linhas como objetos { coluna: valor }.
 */
export type Row = Record<string, string | number | null>;

const ESC: Record<string, string> = { "0": "\0", n: "\n", r: "\r", t: "\t", Z: "\x1a", b: "\b" };

export function parseDump(sql: string, tables: string[]): Map<string, Row[]> {
  const want = new Set(tables);
  const out = new Map<string, Row[]>(tables.map((t) => [t, []]));
  const re = /INSERT INTO `(\w+)` \(([^)]*)\) VALUES\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1];
    const cols = m[2].split(",").map((c) => c.trim().replace(/`/g, ""));
    let i = re.lastIndex;
    const rows = want.has(table) ? out.get(table)! : null;
    // Percorre os tuplos até ao ";" final, mesmo para tabelas ignoradas (para avançar no ficheiro).
    for (;;) {
      while (" \n\r\t,".includes(sql[i])) i++;
      if (sql[i] === ";") { i++; break; }
      if (sql[i] !== "(") throw new Error(`dump inesperado em ${i}: ${sql.slice(i, i + 40)}`);
      i++;
      const vals: (string | number | null)[] = [];
      for (;;) {
        while (" \n\r\t".includes(sql[i])) i++;
        if (sql[i] === "'") {
          i++;
          let s = "";
          for (;;) {
            const j = sql.slice(i).search(/['\\]/) + i;
            s += sql.slice(i, j);
            i = j;
            if (sql[i] === "\\") { s += ESC[sql[i + 1]] ?? sql[i + 1]; i += 2; }
            else if (sql[i + 1] === "'") { s += "'"; i += 2; }
            else { i++; break; }
          }
          vals.push(s);
        } else {
          let j = i;
          while (sql[j] !== "," && sql[j] !== ")") j++;
          const tok = sql.slice(i, j).trim();
          i = j;
          vals.push(tok === "NULL" ? null : Number.isNaN(Number(tok)) ? tok : Number(tok));
        }
        while (" \n\r\t".includes(sql[i])) i++;
        if (sql[i] === ",") { i++; continue; }
        if (sql[i] === ")") { i++; break; }
      }
      rows?.push(Object.fromEntries(cols.map((c, k) => [c, vals[k]])));
    }
    re.lastIndex = i;
  }
  return out;
}
