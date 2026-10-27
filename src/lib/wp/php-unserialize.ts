/**
 * unserialize() do PHP para os valores que o WordPress guarda em meta.
 * Trabalha sobre bytes: os comprimentos "s:N" do PHP contam bytes UTF-8, não caracteres.
 * Arrays com chaves 0..n-1 viram arrays JS; os restantes viram objetos.
 */
export type PhpValue = null | boolean | number | string | PhpValue[] | { [k: string]: PhpValue };

export function phpUnserialize(input: string): PhpValue {
  const buf = Buffer.from(input, "utf8");
  let i = 0;
  const readUntil = (ch: string) => {
    const end = buf.indexOf(ch, i);
    if (end < 0) throw new Error(`esperava "${ch}" na posição ${i}`);
    const s = buf.toString("utf8", i, end);
    i = end + 1;
    return s;
  };
  const expect = (ch: string) => {
    if (String.fromCharCode(buf[i]) !== ch) throw new Error(`esperava "${ch}" na posição ${i}`);
    i++;
  };
  const value = (): PhpValue => {
    const type = String.fromCharCode(buf[i]);
    i += 2; // tipo + ":" (ou ";" no caso de N)
    switch (type) {
      case "N":
        return null;
      case "b":
        return readUntil(";") === "1";
      case "i":
        return parseInt(readUntil(";"), 10);
      case "d":
        return parseFloat(readUntil(";"));
      case "s": {
        const len = parseInt(readUntil(":"), 10);
        expect('"');
        const s = buf.toString("utf8", i, i + len);
        i += len;
        expect('"');
        expect(";");
        return s;
      }
      case "a": {
        const n = parseInt(readUntil(":"), 10);
        expect("{");
        const entries: [string | number, PhpValue][] = [];
        for (let k = 0; k < n; k++) {
          const key = value() as string | number;
          entries.push([key, value()]);
        }
        expect("}");
        const isList = entries.every(([k], idx) => k === idx);
        return isList ? entries.map(([, v]) => v) : Object.fromEntries(entries.map(([k, v]) => [String(k), v]));
      }
      default:
        throw new Error(`tipo PHP não suportado "${type}" na posição ${i - 2}`);
    }
  };
  return value();
}

/** Devolve o valor original se não for serializado (o WordPress guarda strings simples tal como estão). */
export function maybeUnserialize(v: string | null | undefined): PhpValue {
  if (v == null) return null;
  if (!/^(a|s|i|b|d|N)[:;]/.test(v)) return v;
  try {
    return phpUnserialize(v);
  } catch {
    return v;
  }
}
