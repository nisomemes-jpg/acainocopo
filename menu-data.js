// Cardápio físico fornecido pelo estabelecimento em 26/09/2026.
const sections = [
  {
    id: "acai-copo", name: "Açaí no copo", kicker: "MONTE DO SEU JEITO",
    products: [
      { id: "copo-200", name: "Açaí 200 ml", description: "1 creme, até 2 acompanhamentos e 1 cobertura. Sem recheio.", price: 8, image: "foto-copo-colorido.jpeg", filling: "none", customize: { creams: 1, accompaniments: 2, toppings: 1, extras: true } },
      { id: "copo-300", name: "Açaí 300 ml", description: "1 creme, até 3 acompanhamentos e 1 cobertura. Com recheio.", price: 12, image: "foto-copo-joca.jpeg", filling: "included", customize: { creams: 1, accompaniments: 3, toppings: 1, extras: true } },
      { id: "copo-400", name: "Açaí 400 ml", description: "Até 2 cremes, 3 acompanhamentos e 1 cobertura. Com recheio.", price: 15, image: "foto-copo-trufado.jpeg", filling: "included", customize: { creams: 2, accompaniments: 3, toppings: 1, extras: true } },
      { id: "copo-500", name: "Açaí 500 ml", description: "Até 2 cremes, 3 acompanhamentos e 1 cobertura. Com recheio.", price: 18, image: "foto-copo-banana.jpeg", filling: "included", customize: { creams: 2, accompaniments: 3, toppings: 1, extras: true } },
      { id: "isopor-700", name: "Açaí 700 ml", description: "Até 2 cremes, 3 acompanhamentos e 1 cobertura. R$ 26 sem recheio ou R$ 29 com recheio.", price: 26, filledPrice: 29, image: "foto-pote-joca.jpeg", filling: "optional", customize: { creams: 2, accompaniments: 3, toppings: 1, extras: true } },
      { id: "isopor-900", name: "Açaí 900 ml", description: "Até 2 cremes, 3 acompanhamentos e 1 cobertura. R$ 32 sem recheio ou R$ 35 com recheio.", price: 32, filledPrice: 35, image: "foto-pote-fundo-preto.jpeg", filling: "optional", customize: { creams: 2, accompaniments: 3, toppings: 1, extras: true } },
    ],
  },
  {
    id: "acai-zero", name: "Açaí zero açúcar", kicker: "PREÇO POR 100 ML",
    products: [
      { id: "zero-100", name: "Açaí zero açúcar — 100 ml", description: "R$ 8 por 100 ml. Cada unidade na sacola corresponde a 100 ml. Adicionais cobrados à parte.", price: 8, visual: "100 ml", label: "ZERO AÇÚCAR", customize: { creams: 0, accompaniments: 0, toppings: 0, extras: true } },
    ],
  },
  {
    id: "guarana", name: "Guaraná do Amazonas", kicker: "ESCOLHA SUA COBERTURA",
    products: [
      { id: "guarana-330", name: "Guaraná do Amazonas 330 ml", description: "Xarope de guaraná, farinha de castanha, Neston, amendoim, leite em pó e cobertura a escolher.", price: 10, visual: "330 ml", tone: "gold", customize: { creams: 0, accompaniments: 0, toppings: 1 } },
      { id: "guarana-500", name: "Guaraná do Amazonas 500 ml", description: "Xarope de guaraná, farinha de castanha, Neston, amendoim, leite em pó e cobertura a escolher.", price: 13, visual: "500 ml", tone: "gold", customize: { creams: 0, accompaniments: 0, toppings: 1 } },
    ],
  },
  {
    id: "sorvetes", name: "Sorvetes e gelados", kicker: "MAIS OPÇÕES",
    products: [
      { id: "sorvete-200", name: "Sorvete 200 ml", description: "Informe o sabor desejado. Disponibilidade confirmada pela loja.", price: 5, visual: "200 ml", label: "SORVETE", tone: "pink", customize: { flavor: true } },
      { id: "sorvete-300", name: "Sorvete 300 ml", description: "Informe o sabor desejado. Disponibilidade confirmada pela loja.", price: 8, visual: "300 ml", label: "SORVETE", tone: "pink", customize: { flavor: true } },
      { id: "sorvete-500", name: "Sorvete 500 ml", description: "Informe o sabor desejado. Disponibilidade confirmada pela loja.", price: 12, visual: "500 ml", label: "SORVETE", tone: "pink", customize: { flavor: true } },
      { id: "picole", name: "Picolé Chapinha cremoso", description: "Informe o sabor desejado. Disponibilidade confirmada pela loja.", price: 2.5, visual: "Picolé", label: "CHAPINHA", tone: "pink", customize: { flavor: true } },
      { id: "cremosinho", name: "Cremosinho", description: "Informe o sabor desejado. Disponibilidade confirmada pela loja.", price: 2.5, visual: "Geladinho", label: "CREMOSINHO", tone: "pink", customize: { flavor: true } },
      { id: "suco", name: "Suco batido na hora", description: "Informe o sabor desejado. Disponibilidade confirmada pela loja.", price: 5, visual: "Suco", label: "FEITO NA HORA", tone: "gold", customize: { flavor: true } },
    ],
  },
];

const choices = {
  creams: [
    { id: "acai", name: "Açaí", price: 0 },
    { id: "cupuacu", name: "Cupuaçu", price: 0 },
    { id: "oreo-creme", name: "Oreo (chocobiscoito)", price: 0 },
    { id: "ninho-trufado", name: "Ninho trufado", price: 0 },
    { id: "chocolate-belga", name: "Chocolate belga", price: 0 },
    { id: "chocomalte", name: "Chocomalte", price: 0 },
    { id: "cafe", name: "Café", price: 0 },
    { id: "maracuja", name: "Maracujá", price: 0 },
    { id: "amendoim", name: "Amendoim (mix energético)", price: 0 },
    { id: "abacaxi", name: "Abacaxi", price: 0 },
    { id: "morango-trufado", name: "Morango trufado", price: 0 },
    { id: "tapioca-coco", name: "Tapioca com coco", price: 0 },
    { id: "banana-caramelizada", name: "Banana caramelizada", price: 0 },
    { id: "pistache", name: "Creme de pistache", price: 3 },
  ],
  accompaniments: ["Granola", "Leite em pó", "Ovomaltine", "Farinha Láctea", "Cereal Chocoboll", "Confete (MM)", "Paçoquinha", "Jujuba", "Marshmallow", "Gota de chocolate", "Amendoim granulado", "Aveia em flocos"].map((name, index) => ({ id: `acomp-${index}`, name, price: 0 })),
  toppings: ["Leite condensado", "Chocolate", "Morango", "Uva", "Caramelo", "Pedacinho do céu"].map((name, index) => ({ id: `cobertura-${index}`, name, price: 0 })),
  extras: [
    { id: "chocoball-grande", name: "Chocoboll grande", price: 1 },
    { id: "creme-avela", name: "Creme de avelã", price: 4 },
    { id: "doce-leite", name: "Doce de leite", price: 3 },
    { id: "coco-ralado", name: "Coco ralado", price: 1 },
    { id: "oreo", name: "Biscoito Oreo", price: 2 },
    { id: "banana", name: "Banana", price: 1 },
    { id: "morango-extra", name: "Morango", price: 4 },
    { id: "kiwi", name: "Kiwi", price: 4 },
    { id: "uvas-pretas", name: "Uva sem semente", price: 3 },
  ],
};
