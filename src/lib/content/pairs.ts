export interface TitleMessagePair {
  title: string;
  message?: string;
}

export const TITLE_MESSAGE_PAIRS: TitleMessagePair[] = [
  { title: "The night we said yes", message: "And the sky held its breath with us." },
  { title: "Under a billion stars", message: "We promised forever." },
  { title: "The sky remembers", message: undefined },
  { title: "Where we began", message: "Two stars, one orbit." },
  { title: "Midnight in Lisbon", message: "The stars aligned and so did we." },
  { title: "The evening everything changed", message: undefined },
  { title: "Our first dance", message: "Beneath the constellation you love." },
  { title: "When the world went quiet", message: "Only the moon was watching." },
  { title: "Stars over Santorini", message: "You said yes before I finished asking." },
  { title: "The night sky wore your name", message: undefined },
  { title: "Forever started here", message: "Under Polaris, our north star." },
  { title: "When the stars whispered", message: "And we listened." },
  { title: "A sky full of yes", message: undefined },
  { title: "The constellation of us", message: "Mapped across the heavens." },
  { title: "Moonlight on our vows", message: "The night swore us in." },
  { title: "Where time stood still", message: "And the sky kept turning." },
  { title: "The night we became", message: undefined },
  { title: "Beneath Orion's watch", message: "Three stars for three words." },
  { title: "Our sky, our story", message: "Written in starlight." },
  { title: "The stars were our witnesses", message: undefined },
  { title: "When the universe conspired", message: "It brought us here." },
  { title: "A midnight to remember", message: "The sky sang in gold." },
  { title: "Under the same stars", message: "Different night, same us." },
  { title: "The night asked, we answered", message: undefined },
  { title: "Starlight, steady and sure", message: "Like your hand in mine." },
  { title: "The sky wrote our names", message: "In constellations only we could read." },
  { title: "When the moon smiled", message: "We knew it was right." },
  { title: "Our beginning, written above", message: undefined },
  { title: "The night the stars agreed", message: "Every single one." },
  { title: "Beneath a velvet sky", message: "We found our forever." },
  { title: "The moment the sky held still", message: undefined },
  { title: "Where the stars led us", message: "To each other, again." },
  { title: "A toast to the night", message: "And the sky that kept our secret." },
  { title: "When the heavens celebrated", message: "They threw a meteor shower." },
  { title: "Our north star found", message: undefined },
  { title: "The night sky as our altar", message: "Vows written in stardust." },
  { title: "When the cosmos smiled", message: "We said I do." },
  { title: "Stars like diamonds", message: "On the night we became one." },
  { title: "The evening the stars wept", message: "Tears of joy, like ours." },
  { title: "Under Cassiopeia's crown", message: undefined },
  { title: "The night the universe nodded", message: "And the stars applauded." },
  { title: "When the sky was ours alone", message: "Every star a secret." },
  { title: "A constellation for two", message: undefined },
  { title: "The stars knew before we did", message: "They were always pointing here." },
  { title: "Beneath the Milky Way", message: "We found our way to each other." },
  { title: "The night the sky sang", message: undefined },
  { title: "When the stars spelled yes", message: "We just followed their lead." },
  { title: "Our sky, that night", message: "Frozen in starlight forever." },
  { title: "The moon was our officiant", message: "The stars our congregation." },
  { title: "Where forever began", message: undefined },
];

export function pickRandomPair(): TitleMessagePair {
  return TITLE_MESSAGE_PAIRS[
    Math.floor(Math.random() * TITLE_MESSAGE_PAIRS.length)
  ];
}