import { describe, expect, it } from "vitest";
import { ImageError, imageSource, postImage, unsplashSized } from "./images";

describe("imagens dos artigos", () => {
  it("Pexels é copiado, Unsplash fica em ligação, o resto é recusado", () => {
    expect(imageSource("https://images.pexels.com/photos/1/pexels-photo-1.jpeg?w=1260").mode).toBe("copy");
    expect(imageSource("https://images.unsplash.com/photo-123?ixid=abc").mode).toBe("link");
    expect(() => imageSource("https://exemplo.com/foto.jpg")).toThrow(ImageError);
    expect(() => imageSource("http://images.pexels.com/x.jpg")).toThrow(/Só são aceites/);
    expect(() => imageSource("http://127.0.0.1/admin")).toThrow(ImageError);
    expect(() => imageSource("não é um endereço")).toThrow(/inválido/);
  });

  it("Unsplash: pede o tamanho ao próprio Unsplash e mantém os parâmetros deles", () => {
    const u = new URL(unsplashSized("https://images.unsplash.com/photo-123?ixid=abc&w=4000", 800));
    expect(u.searchParams.get("w")).toBe("800");
    expect(u.searchParams.get("ixid")).toBe("abc");
  });

  it("imagem de destaque: do site ou do Unsplash", () => {
    expect(postImage({ featuredImageKey: "blog/api/x", featuredImageUrl: null }, 800)?.src).toBe("/media/blog/api/x-800.webp");
    expect(postImage({ featuredImageKey: null, featuredImageUrl: "https://images.unsplash.com/photo-1" }, 400)?.src).toContain("w=400");
    expect(postImage({ featuredImageKey: null, featuredImageUrl: null }, 400)).toBeNull();
  });
});
