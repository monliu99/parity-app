import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Entertainment",
  "Shopping",
  "Health",
  "Housing",
  "Travel",
  "Income",
  "Subscriptions",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export async function categorizeTransaction(
  merchant: string,
  amount: number
): Promise<Category> {
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      system: `You are a transaction categorizer. Given a merchant name and amount, respond with ONLY one of these exact categories (no punctuation, no explanation):
${CATEGORIES.join(", ")}

Rules:
- Groceries: supermarkets, grocery stores (Whole Foods, Trader Joe's, Kroger, Costco)
- Dining: restaurants, cafes, fast food, delivery (DoorDash, Uber Eats)
- Transport: gas, Uber, Lyft, parking, airlines, car services
- Entertainment: streaming (Netflix, Spotify, Hulu), movies, concerts, games
- Shopping: retail, Amazon, Target, Walmart, clothing
- Health: pharmacies, doctors, gyms, dentists
- Housing: rent, mortgage, utilities, home improvement
- Travel: hotels, Airbnb, vacation expenses
- Income: salary, payroll, deposits, transfers in
- Subscriptions: recurring software, services (not streaming)
- Other: anything that doesn't fit`,
      messages: [
        {
          role: "user",
          content: `Merchant: ${merchant}\nAmount: $${amount}`,
        },
      ],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const matched = CATEGORIES.find(
      (c) => c.toLowerCase() === text.toLowerCase()
    );
    return matched ?? "Other";
  } catch {
    return "Other";
  }
}
